import { expect, type Page, test } from "@playwright/test";
import { etatParam } from "./position.ts";

// The animations of the knights (plan 01-19): durations, order and sounds of the stable exit, the
// walk, the backward 4, a capture on the final cell and in the middle of a 7, the Valet swap, the
// home entry and the party of the fourth knight, then fast mode and reduced motion. The positions
// are made by hand with the `etat` debug parameter and played at normal speed (no `vitesse=test`).
//
// Every Web Animation on a knight, a card in flight or a card of the hand is recorded by a
// requestAnimationFrame loop installed before the page loads: which knight, which inner group, its
// duration, delay and the moment it begins. The sounds come from window.__tocDebug.audio.cues (debug
// builds), read by id and by time.
//
// The cards (plan 01-22): a card in flight has the role `flight-deal`, `flight-play`,
// `flight-exchange` or `flight-lay`; a card of the hand that flips open or slides in has the role
// `hand-card`. Its `card` field is the card id (`back` for a face-down card).

type Rec = {
  pawn: string | null;
  card: string | null;
  role: string;
  duration: number;
  delay: number;
  iterations: number;
  begins: number;
  ends: number;
};
type Cue = { id: string; at: number; requestedAt: number };
type TocWindow = Window & {
  __anims: Rec[];
  __paused: Animation[];
  __armed?: Promise<void>;
  __tocDebug?: { audio: { cues?: Cue[]; scheduled: number[]; history: number[][] } };
};

function recorder() {
  const w = window as unknown as TocWindow;
  w.__anims = [];
  const known = new Set<Animation>();
  const tick = () => {
    for (const animation of document.getAnimations()) {
      if (known.has(animation) || animation.startTime === null) continue;
      const target = animation.effect && (animation.effect as KeyframeEffect).target;
      if (!(target instanceof Element)) continue;
      const owner = target.closest(
        "[data-pawn], [data-particles], [data-flight], [data-hand] [data-card]",
      );
      if (owner === null) continue;
      const flight = owner.getAttribute("data-flight");
      const role =
        target.getAttribute("data-role") ??
        (flight !== null
          ? `flight-${flight}`
          : owner.hasAttribute("data-card")
            ? "hand-card"
            : "particle");
      known.add(animation);
      const timing = animation.effect?.getTiming();
      const duration = Number(timing?.duration);
      const delay = Number(timing?.delay ?? 0);
      const iterations = Number(timing?.iterations ?? 1);
      const begins = Number(animation.startTime) + delay;
      w.__anims.push({
        pawn: owner.getAttribute("data-pawn"),
        card: owner.getAttribute("data-flight-card") ?? owner.getAttribute("data-card"),
        role,
        duration,
        delay,
        iterations,
        begins,
        ends: begins + duration * iterations,
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const near = (value: number, expected: number, tolerance = 3) =>
  expect(
    Math.abs(value - expected),
    `${value} should be ${expected} ± ${tolerance}`,
  ).toBeLessThanOrEqual(tolerance);

const records = (page: Page) =>
  page.evaluate(() => (window as unknown as TocWindow).__anims.slice());
const cues = (page: Page) =>
  page.evaluate(() => (window as unknown as TocWindow).__tocDebug?.audio.cues?.slice() ?? []);

/** The records of a knight's inner group, with the duration asked for (± 1 ms). */
function pick(all: Rec[], pawn: string, role: string, duration: number): Rec[] {
  return all.filter(
    (r) => r.pawn === pawn && r.role === role && Math.abs(r.duration - duration) <= 1,
  );
}

async function waitFor(page: Page, pawn: string, role: string, duration: number): Promise<Rec> {
  await expect
    .poll(async () => pick(await records(page), pawn, role, duration).length, {
      message: `an animation of ${duration} ms on ${pawn}/${role}`,
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  return pick(await records(page), pawn, role, duration)[0] as Rec;
}

async function openPosition(page: Page, etat: unknown) {
  await page.addInitScript(recorder);
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(etat)}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(page.locator("[data-action-zone]")).toHaveAttribute("data-state", "idle");
}

const placeOf = (page: Page, pawn: string) =>
  page.locator(`[data-pawn="${pawn}"]`).getAttribute("data-place");

/** Card, then the knight, then « Jouer ». */
async function playCard(page: Page, card: string, pawn: string, target?: string) {
  await page.getByRole("button", { name: `${card}, jouable` }).click();
  await page.locator(`[data-hit="${pawn}"]`).click({ force: true });
  if (target) await page.locator(`[data-hit="${target}"]`).click({ force: true });
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
}

/**
 * Freezes every animation that matches `selector` (the knights by default) at step time `at` (ms after
 * the step started, lead included), takes the screenshot and lets them run on. For the human check.
 */
async function shoot(
  page: Page,
  name: string,
  at: number,
  selector = "[data-pawn], [data-particles]",
  minimum = 1,
) {
  // Waits, frame by frame, until `minimum` animations of the selector are running, then freezes them
  // all in the same frame: a screenshot of cards in flight cannot be taken a poll too late.
  await page.evaluate(
    ([time, only, count]) =>
      new Promise<void>((resolve) => {
        const w = window as unknown as TocWindow;
        const attempt = () => {
          const running = document.getAnimations().filter((animation) => {
            const target = animation.effect && (animation.effect as KeyframeEffect).target;
            return (
              target instanceof Element &&
              target.closest(only as string) !== null &&
              animation.playState === "running" &&
              animation.startTime !== null
            );
          });
          if (running.length < (count as number)) {
            requestAnimationFrame(attempt);
            return;
          }
          w.__paused = running;
          for (const animation of running) {
            animation.pause();
            animation.currentTime = time as number;
          }
          resolve();
        };
        attempt();
      }),
    [at, selector, minimum] as const,
  );
  const project = test.info().project.name;
  await page.screenshot({ path: `test-results/anim-${name}-${project}.png` });
  await page.evaluate(() => {
    for (const animation of (window as unknown as TocWindow).__paused) animation.play();
  });
}

/**
 * Like `shoot`, for animations that are all running together only briefly (the deal: 300 ms): before the
 * page loads, `Element.animate` is wrapped so that `minimum` animations of the selector are frozen at
 * `at` in the very task that starts the last of them, however late the test or the frames come.
 * `shootArmed` then takes the screenshot and lets them run on.
 */
async function armShot(page: Page, selector: string, minimum: number, at: number) {
  await page.addInitScript(
    ([only, count, time]) => {
      const w = window as unknown as TocWindow;
      const original = Element.prototype.animate;
      w.__armed = new Promise<void>((resolve) => {
        let done = false;
        Element.prototype.animate = function (this: Element, ...args) {
          const animation = original.apply(this, args);
          if (!done && this.closest(only as string) !== null) {
            queueMicrotask(() => {
              if (done) return;
              const running = document.getAnimations().filter((a) => {
                const target = a.effect && (a.effect as KeyframeEffect).target;
                return (
                  target instanceof Element &&
                  target.closest(only as string) !== null &&
                  a.playState === "running"
                );
              });
              if (running.length < (count as number)) return;
              done = true;
              w.__paused = running;
              for (const a of running) {
                a.pause();
                a.currentTime = time as number;
              }
              resolve();
            });
          }
          return animation;
        } as typeof Element.prototype.animate;
      });
    },
    [selector, minimum, at] as const,
  );
}

async function shootArmed(page: Page, name: string) {
  await page.evaluate(() => (window as unknown as TocWindow).__armed);
  const project = test.info().project.name;
  await page.screenshot({ path: `test-results/anim-${name}-${project}.png` });
  await page.evaluate(() => {
    for (const animation of (window as unknown as TocWindow).__paused) animation.play();
  });
}

const LEAD = 60;

test("sortie : un seul bond de 600 ms jusqu’au losange, avec un hennissement au départ", async ({
  page,
}) => {
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: ["S", "S", "S", "S"] },
    hands: { bleu: ["1S"] },
  });
  await playCard(page, "As de pique", "bleu0");

  const mover = await waitFor(page, "bleu0", "mover", 600);
  const arc = await waitFor(page, "bleu0", "arc", 600);
  near(arc.begins, mover.begins, 5);
  await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:0");

  const sounds = await cues(page);
  expect(sounds.map((c) => c.id)).toContain("hennissement-sortie");
  const neigh = sounds.find((c) => c.id === "hennissement-sortie") as Cue;
  near(neigh.at - neigh.requestedAt, 0.06, 0.03);
});

test("4 à reculons : un demi-tour de la tête de 120 ms avant les quatre bonds", async ({
  page,
}) => {
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
    hands: { bleu: ["4S"] },
  });
  await playCard(page, "4 de pique", "bleu0");

  const turn = await waitFor(page, "bleu0", "facing", 120);
  const mover = await waitFor(page, "bleu0", "mover", 799);
  const arc = await waitFor(page, "bleu0", "arc", 799 / 4);
  expect(turn.begins).toBeLessThan(mover.begins);
  near(turn.begins + 120, mover.begins, 6);
  near(arc.begins, mover.begins, 5);
  expect(arc.iterations).toBe(4);
  await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:6");
});

test("prise sur la dernière case : la ruade (220 + 280 ms) puis l’éjection (700 ms) dans l’écurie", async ({
  page,
}) => {
  // R-11.1: Bleu's 3 stops on a Jaune knight.
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
    hands: { bleu: ["3S"] },
  });
  await playCard(page, "3 de pique", "bleu0");

  const mover = await waitFor(page, "bleu0", "mover", 666);
  const up = await waitFor(page, "bleu0", "rear", 220);
  const down = await waitFor(page, "bleu0", "rear", 280);
  const flight = await waitFor(page, "jaune0", "mover", 700);
  const bounce = await waitFor(page, "jaune0", "arc", 150);

  near(up.begins, mover.ends, 6);
  near(down.begins, up.ends, 3);
  near(flight.begins, down.ends, 3);
  near(bounce.begins, flight.ends, 3);

  await shoot(page, "ruade", LEAD + 666 + 220);
  await shoot(page, "ejection", LEAD + 666 + 500 + 350);

  await expect(page.locator('[data-pawn="jaune0"]')).toHaveAttribute(
    "data-place",
    "stable:jaune:0",
    {
      timeout: 10_000,
    },
  );
  await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:8");

  const sounds = await cues(page);
  const snort = sounds.find((c) => c.id === "hennissement-ruade") as Cue;
  const whinny = sounds.find((c) => c.id === "hennissement-plainte") as Cue;
  expect(snort).toBeDefined();
  expect(whinny).toBeDefined();
  near(whinny.at - snort.at, 0.5, 0.01);
  // The snort is at the arrival of the three hops, the whinny when the knight leaves.
  near(snort.at - snort.requestedAt, 0.06 + 0.666, 0.03);
});

test("le 7 : le cheval mangé en chemin part au moment où le mangeur passe, avant la fin du déplacement", async ({
  page,
}) => {
  // Bleu plays a 2; then Jaune, a bot whose only card is a 7, crosses a Rouge knight on cell 9
  // (third cell of seven) with its only knight.
  await openPosition(page, {
    turn: "bleu",
    pawns: {
      bleu: [{ p: 30 }, "S", "S", "S"],
      jaune: [{ p: 60 }, "S", "S", "S"],
      rouge: [{ p: 45 }, "S", "S", "S"],
    },
    hands: { bleu: ["2S"], jaune: ["7H"] },
  });
  await playCard(page, "2 de pique", "bleu0");

  const attacker = await waitFor(page, "jaune0", "mover", 1198);
  const victim = await waitFor(page, "rouge0", "mover", 700);
  const beat = (1198 / 7) * 3;
  near(victim.begins - attacker.begins, beat, 8);
  expect(victim.begins).toBeLessThan(attacker.ends);

  await shoot(page, "sept-prise", LEAD + beat + 300);

  await expect(page.locator('[data-pawn="rouge0"]')).toHaveAttribute(
    "data-place",
    "stable:rouge:0",
    {
      timeout: 10_000,
    },
  );
  await expect(page.locator('[data-pawn="jaune0"]')).toHaveAttribute("data-place", "ring:13");

  // No rearing: the attacker does not stop on the cell it passes.
  expect(pick(await records(page), "jaune0", "rear", 220)).toHaveLength(0);
  const whinny = (await cues(page)).find((c) => c.id === "hennissement-plainte") as Cue;
  near(whinny.at - whinny.requestedAt, 0.06 + beat / 1000, 0.04);
});

test("Valet : deux arcs qui se croisent, 900 ms, en même temps, avec un hennissement surpris", async ({
  page,
}) => {
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 5 }, "S", "S", "S"], vert: [{ p: 40 }, "S", "S", "S"] },
    hands: { bleu: ["11H"] },
  });
  const mine = await placeOf(page, "bleu0");
  const theirs = await placeOf(page, "vert0");
  await playCard(page, "Valet de cœur", "bleu0", "vert0");

  const a = await waitFor(page, "bleu0", "mover", 900);
  const b = await waitFor(page, "vert0", "mover", 900);
  near(a.begins, b.begins, 4);
  const arcA = await waitFor(page, "bleu0", "arc", 450);
  const arcB = await waitFor(page, "vert0", "arc", 450);
  expect(arcA.iterations).toBe(2);
  expect(arcB.iterations).toBe(2);

  await shoot(page, "echange", LEAD + 450);

  await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", theirs ?? "", {
    timeout: 10_000,
  });
  expect(await placeOf(page, "vert0")).toBe(mine);
  const neigh = (await cues(page)).find((c) => c.id === "hennissement-surpris") as Cue;
  expect(neigh).toBeDefined();
  near(neigh.at - neigh.requestedAt, 0.06, 0.03);
});

test("maison : un petit hennissement joyeux et un tassement de 150 ms pour les trois premiers", async ({
  page,
}) => {
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 66 }, "S", "S", "S"] },
    hands: { bleu: ["5S"] },
  });
  await playCard(page, "5 de pique", "bleu0");

  const settle = await waitFor(page, "bleu0", "squash", 150);
  const mover = await waitFor(page, "bleu0", "mover", 932);
  near(settle.begins, mover.ends, 6);
  await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "home:bleu:0", {
    timeout: 10_000,
  });
  const ids = (await cues(page)).map((c) => c.id);
  expect(ids).toContain("hennissement-joyeux");
  expect(ids).not.toContain("hennissement-fete");
  await expect(page.locator("[data-particles]")).toHaveCount(0);
});

test("le quatrième cheval : il se cabre 500 ms, 8 étoiles pendant 700 ms, le long hennissement", async ({
  page,
}) => {
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 66 }, { h: 1 }, { h: 2 }, { h: 3 }] },
    hands: { bleu: ["5S"] },
  });
  await playCard(page, "5 de pique", "bleu0");

  const mover = await waitFor(page, "bleu0", "mover", 932);
  const rise = await waitFor(page, "bleu0", "rear", 500);
  near(rise.begins, mover.ends, 6);
  await expect(page.locator("[data-particles]")).toHaveCount(1);
  await expect(page.locator("[data-particle]")).toHaveCount(8);
  await expect
    .poll(async () => (await records(page)).filter((r) => r.role === "particle").length)
    .toBe(8);
  const sparks = (await records(page)).filter((r) => r.role === "particle");
  for (const spark of sparks) {
    near(spark.duration, 700, 1);
    near(spark.begins, mover.ends, 25);
  }

  await shoot(page, "fete", LEAD + 932 + 300);

  await expect(page.locator("[data-particles]")).toHaveCount(0, { timeout: 10_000 });
  const ids = (await cues(page)).map((c) => c.id);
  expect(ids).toContain("hennissement-fete");
  expect(ids).not.toContain("hennissement-joyeux");
});

test.describe("Avance rapide : toutes les durées × 0,4", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("toc.settings.v1", JSON.stringify({ fast: true }));
    });
  });

  test("la sortie dure 240 ms, la ruade 88 + 112 ms, l’éjection 280 ms", async ({ page }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
      hands: { bleu: ["3S"] },
    });
    await playCard(page, "3 de pique", "bleu0");
    const mover = await waitFor(page, "bleu0", "mover", 666 * 0.4);
    const up = await waitFor(page, "bleu0", "rear", 88);
    await waitFor(page, "bleu0", "rear", 112);
    const flight = await waitFor(page, "jaune0", "mover", 280);
    near(up.begins, mover.ends, 6);
    expect(flight.begins).toBeGreaterThan(up.begins);
    await expect(page.locator('[data-pawn="jaune0"]')).toHaveAttribute(
      "data-place",
      "stable:jaune:0",
      { timeout: 10_000 },
    );
    // Hoof clops closer than 50 ms are never scheduled.
    const scheduled = await page.evaluate(
      () => (window as unknown as TocWindow).__tocDebug?.audio.history ?? [],
    );
    for (const clops of scheduled) {
      for (let i = 1; i < clops.length; i++) {
        expect((clops[i] as number) - (clops[i - 1] as number)).toBeGreaterThanOrEqual(49.9);
      }
    }
  });
});

test.describe("Réduire les animations : glissement, fondus, pas de ruade ni de particules", () => {
  test.use({ reducedMotion: "reduce" });

  test("un déplacement est un glissement de 180 ms avec un seul sabot", async ({ page }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
    });
    await playCard(page, "Dame de cœur", "bleu0");
    await waitFor(page, "bleu0", "mover", 180);
    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:22");
    const records_ = await records(page);
    expect(records_.filter((r) => r.pawn === "bleu0" && r.role === "arc")).toHaveLength(0);
    expect(records_.filter((r) => r.pawn === "bleu0" && r.role === "squash")).toHaveLength(0);
    const scheduled = await page.evaluate(
      () => (window as unknown as TocWindow).__tocDebug?.audio.scheduled,
    );
    expect(scheduled).toEqual([180]);
  });

  test("une prise : le cheval mangé disparaît en 150 ms et réapparaît 150 ms à l’écurie, sans ruade", async ({
    page,
  }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
      hands: { bleu: ["3S"] },
    });
    await playCard(page, "3 de pique", "bleu0");
    await waitFor(page, "jaune0", "mover", 300);
    await expect(page.locator('[data-pawn="jaune0"]')).toHaveAttribute(
      "data-place",
      "stable:jaune:0",
      { timeout: 10_000 },
    );
    const all = await records(page);
    expect(all.filter((r) => r.role === "rear")).toHaveLength(0);
    const sounds = (await cues(page)).map((c) => c.id);
    expect(sounds).toContain("hennissement-plainte");
    expect(sounds).not.toContain("hennissement-ruade");
  });

  test("le quatrième cheval ne se cabre pas et ne lance pas de particules", async ({ page }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 66 }, { h: 1 }, { h: 2 }, { h: 3 }] },
      hands: { bleu: ["5S"] },
    });
    await playCard(page, "5 de pique", "bleu0");
    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "home:bleu:0", {
      timeout: 10_000,
    });
    await expect(page.locator("[data-particles]")).toHaveCount(0);
    expect((await records(page)).filter((r) => r.role === "rear")).toHaveLength(0);
    expect((await cues(page)).map((c) => c.id)).toContain("hennissement-fete");
  });

  test("le Valet est un fondu enchaîné de 150 ms", async ({ page }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], vert: [{ p: 40 }, "S", "S", "S"] },
      hands: { bleu: ["11H"] },
    });
    await playCard(page, "Valet de cœur", "bleu0", "vert0");
    await waitFor(page, "bleu0", "mover", 150);
    await waitFor(page, "vert0", "mover", 150);
    const records_ = await records(page);
    expect(records_.filter((r) => r.role === "arc")).toHaveLength(0);
  });
});

// ---- The cards (plan 01-22) ------------------------------------------------------------------
// The deal, a played card, the exchange, a dead hand laid down and the win, at normal speed. The deal
// and the exchange are those of a seeded new game (`graine`, no `vitesse=test`, so the bots take
// their time); the other positions are made by hand.

const SEED = "00c0ffee00c0ffee1234567890abcdef";

/** The records of the cards in flight of one kind, in the order they begin. */
const flightsOf = (all: Rec[], kind: string) =>
  all.filter((r) => r.role === `flight-${kind}`).sort((a, b) => a.begins - b.begins);
const handCards = (all: Rec[]) =>
  all.filter((r) => r.role === "hand-card").sort((a, b) => a.begins - b.begins);

async function openSeeded(page: Page, init?: () => void) {
  await page.addInitScript(recorder);
  if (init) await page.addInitScript(init);
  await page.goto("/");
  await page.goto(`/#/partie?graine=${SEED}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

/** Opens a hand-made position that does not start on a playable hand (a dead hand, an exchange). */
async function openAny(page: Page, etat: unknown) {
  await page.addInitScript(recorder);
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(etat)}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

/** Plays the banner of the game screen: the moments it was put on the page and taken off it. */
function bannerWatch() {
  const w = window as unknown as { __banner: { on: number | null; off: number | null } };
  w.__banner = { on: null, off: null };
  new MutationObserver(() => {
    const present = document.querySelector("[data-deal-banner]") !== null;
    if (present && w.__banner.on === null) w.__banner.on = performance.now();
    if (!present && w.__banner.on !== null && w.__banner.off === null)
      w.__banner.off = performance.now();
  }).observe(document, { childList: true, subtree: true });
}

test("la donne : 20 cartes de 300 ms à 55 ms d’intervalle avec le bruit de la donne, puis la main se retourne", async ({
  page,
}) => {
  // The 20 cards are all in flight together for only 300 ms, until the first one lands: the freeze is
  // armed before the page loads, so a slow poll or frame cannot miss that moment.
  await armShot(page, "[data-flight]", 20, LEAD + 300);
  await openSeeded(page);
  await shootArmed(page, "donne");
  await expect
    .poll(async () => flightsOf(await records(page), "deal").length, { timeout: 10_000 })
    .toBe(20);
  // The freeze for the screenshot shifts the start of the cards the recorder saw only after it, so the
  // 55 ms interval is read from each card's own delay, in dealing order.
  const deal = flightsOf(await records(page), "deal").sort((a, b) => a.delay - b.delay);
  for (const [i, flight] of deal.entries()) {
    near(flight.duration, 300, 1);
    near(flight.delay - (deal[0] as Rec).delay, i * 55, 1);
    expect(flight.card).toBe("back");
  }

  const riffle = (await cues(page)).filter((c) => c.id === "carte-donne");
  expect(riffle).toHaveLength(1);
  near((riffle[0] as Cue).at - (riffle[0] as Cue).requestedAt, 0.06, 0.03);

  // The five cards of the player come face up one after the other, once the deal has landed.
  await expect.poll(async () => handCards(await records(page)).length).toBe(5);
  const flips = handCards(await records(page));
  for (const [i, flip] of flips.entries()) {
    near(flip.duration, 300, 1);
    near(flip.delay, i * 55, 1);
  }
  await expect(page.locator("[data-flight]")).toHaveCount(0);
  await expect(page.locator("[data-talon]")).toHaveAttribute("data-talon", "32");
  await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
});

test("la bannière de donne reste 1,2 s sur le plateau", async ({ page }) => {
  await openSeeded(page, bannerWatch);
  await expect(page.locator("[data-deal-banner]")).toBeVisible();
  await expect(page.locator("[data-deal-banner]")).toHaveCount(0, { timeout: 5_000 });
  const { on, off } = await page.evaluate(
    () => (window as unknown as { __banner: { on: number; off: number } }).__banner,
  );
  // 1.2 s on screen, then its 200 ms fade out.
  expect(off - on).toBeGreaterThanOrEqual(1190);
  expect(off - on).toBeLessThanOrEqual(1600);
});

test("une carte jouée vole 300 ms jusqu’à son emplacement du tapis avec le bruit de la carte, avant le cheval", async ({
  page,
}) => {
  // Bleu plays a 2; then Jaune, a bot whose only card is a 7, plays it with its only knight.
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 30 }, "S", "S", "S"], jaune: [{ p: 60 }, "S", "S", "S"] },
    hands: { bleu: ["2S"], jaune: ["7H"] },
  });
  await playCard(page, "2 de pique", "bleu0");

  await expect
    .poll(async () => flightsOf(await records(page), "play").length, { timeout: 15_000 })
    .toBe(2);
  const [mine, theirs] = flightsOf(await records(page), "play") as [Rec, Rec];
  expect([mine.card, theirs.card]).toEqual(["2S", "7H"]);
  near(mine.duration, 300, 1);
  near(theirs.duration, 300, 1);

  // The card lands, then the knight leaps (its own 60 ms lead after the card).
  const mover = await waitFor(page, "bleu0", "mover", 533);
  near(mover.begins - mine.ends, LEAD, 12);
  const seven = await waitFor(page, "jaune0", "mover", 1198);
  expect(seven.begins).toBeGreaterThan(theirs.ends - 8);

  const sounds = (await cues(page)).filter((c) => c.id === "carte-pose");
  expect(sounds.length).toBeGreaterThanOrEqual(2);
  near((sounds[0] as Cue).at - (sounds[0] as Cue).requestedAt, 0.06, 0.03);

  await expect(page.locator('[data-felt-last="bleu"] [data-felt-card="2S"]')).toBeVisible();
  await expect(page.locator('[data-felt-last="jaune"] [data-felt-card="7H"]')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("[data-flight]")).toHaveCount(0);
});

test("l’échange : quatre cartes se croisent en 300 ms avec le bruit de la glissade, la reçue entre dans la main", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openSeeded(page);
  await expect(page.locator("[data-hand]")).not.toHaveClass(/concealed/, { timeout: 10_000 });
  await expect(page.locator("[data-flight]")).toHaveCount(0);
  await page.locator("[data-hand] [data-card]").first().click();
  await page.getByRole("button", { name: "Passer cette carte" }).click();

  // The bots choose one by one; when the last has chosen, the four cards cross.
  await shoot(page, "cartes-echange", LEAD + 150, "[data-flight]", 4);
  const crossing = flightsOf(await records(page), "exchange");
  expect(crossing).toHaveLength(4);
  for (const flight of crossing) {
    near(flight.duration, 300, 1);
    near(flight.begins, (crossing[0] as Rec).begins, 6);
    expect(flight.card).toBe("back");
  }

  const slide = (await cues(page)).filter((c) => c.id === "carte-echange");
  expect(slide).toHaveLength(1);
  near((slide[0] as Cue).at - (slide[0] as Cue).requestedAt, 0.06, 0.03);

  // The received card slides into the hand when the crossing is over.
  await expect(page.getByText("Reçue", { exact: true })).toBeVisible();
  await expect.poll(async () => handCards(await records(page)).length).toBeGreaterThan(0);
  const arrival = handCards(await records(page)).at(-1) as Rec;
  near(arrival.delay, 360, 1);
  await expect(page.locator("[data-flight]")).toHaveCount(0);
});

test("main posée : les cartes se couchent 350 ms chacune, à 60 ms d’intervalle, face visible", async ({
  page,
}) => {
  await openAny(page, {
    turn: "bleu",
    hands: { bleu: ["2S", "4S", "11S"], jaune: ["2H", "3H", "5H"] },
    pawns: { jaune: [{ p: 5 }, "S", "S", "S"] },
  });
  await expect(page.locator("[data-action-zone]")).toHaveAttribute("data-state", "deadHand");
  await page.getByRole("button", { name: "Poser mes cartes" }).click();

  await shoot(page, "main-posee", LEAD + 120, "[data-flight]", 3);
  const laid = flightsOf(await records(page), "lay");
  expect(laid).toHaveLength(3);
  expect(laid.map((f) => f.card).sort()).toEqual(["11S", "2S", "4S"]);
  for (const [i, flight] of laid.entries()) {
    near(flight.duration, 350, 1);
    near(flight.begins - (laid[0] as Rec).begins, i * 60, 6);
  }

  const sounds = (await cues(page)).filter((c) => c.id === "carte-pose");
  expect(sounds).toHaveLength(1);
  await expect(page.locator('[data-felt-posed="bleu"] [data-felt-card]')).toHaveCount(3);
  await expect(page.locator("[data-flight]")).toHaveCount(0);
});

test("la victoire : les huit chevaux de l’équipe gagnante sautent une fois, 600 ms, avant l’écran de fin", async ({
  page,
}) => {
  // Bleu's 5 brings the last knight home: the team Bleu-Rouge has its eight knights home.
  await openPosition(page, {
    turn: "bleu",
    pawns: {
      bleu: [{ p: 66 }, { h: 1 }, { h: 2 }, { h: 3 }],
      rouge: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
    },
    hands: { bleu: ["5S"] },
  });
  await playCard(page, "5 de pique", "bleu0");

  const winners = ["bleu0", "bleu1", "bleu2", "bleu3", "rouge0", "rouge1", "rouge2", "rouge3"];
  const hops = [];
  for (const pawn of winners) hops.push(await waitFor(page, pawn, "arc", 600));
  for (const hop of hops) near(hop.begins, (hops[0] as Rec).begins, 8);
  // No other knight hops.
  const others = (await records(page)).filter(
    (r) => r.role === "arc" && Math.abs(r.duration - 600) <= 1 && !winners.includes(r.pawn ?? ""),
  );
  expect(others).toHaveLength(0);

  await expect(page.locator("[data-end-screen]")).toBeVisible({ timeout: 10_000 });
});

// ---- Fast, reduced and hidden-tab proof (plan 01-22, task 2) ---------------------------------

const DEAD_HAND = {
  turn: "bleu",
  hands: { bleu: ["2S", "4S", "11S"], jaune: ["2H", "3H", "5H"] },
  pawns: { jaune: [{ p: 5 }, "S", "S", "S"] },
};

/** The scheduled hoof clops of every move so far: milliseconds after the start of each move. */
const clopHistory = (page: Page) =>
  page.evaluate(() => (window as unknown as TocWindow).__tocDebug?.audio.history ?? []);

test.describe("Avance rapide : le bond de 4 cases, les cartes", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("toc.settings.v1", JSON.stringify({ fast: true }));
    });
  });

  test("un bond de 4 cases dure 320 ms, les sabots restent à 50 ms au moins l’un de l’autre, la carte jouée vole 120 ms", async ({
    page,
  }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["4S"] },
    });
    await playCard(page, "4 de pique", "bleu0");

    // The 4 goes backward: four bounds of 80 ms after a 48 ms volte-face.
    await expect
      .poll(async () => flightsOf(await records(page), "play").length, { timeout: 10_000 })
      .toBe(1);
    const card = flightsOf(await records(page), "play")[0] as Rec;
    near(card.duration, 120, 2);

    const mover = await waitFor(page, "bleu0", "mover", 320);
    near(mover.duration, 320, 2);
    const arc = await waitFor(page, "bleu0", "arc", 80);
    expect(arc.iterations).toBe(4);
    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:6");

    const history = await clopHistory(page);
    expect(history.length).toBeGreaterThan(0);
    for (const clops of history) {
      for (let i = 1; i < clops.length; i++) {
        expect((clops[i] as number) - (clops[i - 1] as number)).toBeGreaterThanOrEqual(49.9);
      }
    }
  });

  test("la donne : 20 cartes de 120 ms espacées de 22 ms, la main se retourne en 120 ms", async ({
    page,
  }) => {
    await openSeeded(page);
    await expect
      .poll(async () => flightsOf(await records(page), "deal").length, { timeout: 10_000 })
      .toBe(20);
    const deal = flightsOf(await records(page), "deal");
    for (const [i, flight] of deal.entries()) {
      near(flight.duration, 120, 2);
      near(flight.begins - (deal[0] as Rec).begins, i * 22, 6);
    }
    await expect.poll(async () => handCards(await records(page)).length).toBe(5);
    for (const flip of handCards(await records(page))) near(flip.duration, 120, 2);
    expect((await cues(page)).filter((c) => c.id === "carte-donne")).toHaveLength(1);
  });

  test("une main posée : 140 ms par carte, 24 ms d’intervalle", async ({ page }) => {
    await openAny(page, DEAD_HAND);
    await page.getByRole("button", { name: "Poser mes cartes" }).click();
    await expect.poll(async () => flightsOf(await records(page), "lay").length).toBe(3);
    const laid = flightsOf(await records(page), "lay");
    for (const [i, flight] of laid.entries()) {
      near(flight.duration, 140, 2);
      near(flight.begins - (laid[0] as Rec).begins, i * 24, 6);
    }
  });
});

test.describe("Réduire les animations : les cartes se fondent en 150 ms", () => {
  test.use({ reducedMotion: "reduce" });

  test("une carte jouée se fond en 150 ms, le cheval glisse en 180 ms avec un seul sabot, sans particules", async ({
    page,
  }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
    });
    await playCard(page, "Dame de cœur", "bleu0");
    await expect
      .poll(async () => flightsOf(await records(page), "play").length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    const card = flightsOf(await records(page), "play")[0] as Rec;
    near(card.duration, 150, 1);
    // A fade or a short slide: its keyframes never fly across the board.
    const mover = await waitFor(page, "bleu0", "mover", 180);
    near(mover.begins - card.ends, LEAD, 12);
    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:22");
    expect(await clopHistory(page)).toEqual([[180]]);
    const all = await records(page);
    expect(all.filter((r) => r.role === "particle")).toHaveLength(0);
    expect(all.filter((r) => r.role === "rear" || r.role === "arc")).toHaveLength(0);
    await expect(page.locator("[data-particles]")).toHaveCount(0);
  });

  test("une image chargée au départ du cheval ne le retarde pas : il glisse toujours 60 ms après la carte", async ({
    page,
  }) => {
    // The frame in which the knight is started is made 20 ms heavier, as on a slow phone. Left to the
    // compositor, its start would be the frame after (the commit misses its frame): it must still be
    // the frame in which the card landed.
    await page.addInitScript(heavyKnightStart, 20);
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
    });
    await playCard(page, "Dame de cœur", "bleu0");
    await expect
      .poll(async () => flightsOf(await records(page), "play").length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    const card = flightsOf(await records(page), "play")[0] as Rec;
    const mover = await waitFor(page, "bleu0", "mover", 180);
    near(mover.begins - card.ends, LEAD, 12);
    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:22");
  });

  test("la donne et l’échange : quatre cartes de 150 ms à la fois, la main se fond en 150 ms", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openSeeded(page);
    await expect
      .poll(async () => flightsOf(await records(page), "deal").length, { timeout: 10_000 })
      .toBe(4);
    const deal = flightsOf(await records(page), "deal");
    for (const flight of deal) {
      near(flight.duration, 150, 1);
      near(flight.begins, (deal[0] as Rec).begins, 6);
    }
    await expect.poll(async () => handCards(await records(page)).length).toBe(5);
    for (const fade of handCards(await records(page))) {
      near(fade.duration, 150, 1);
      near(fade.delay, 0, 1);
    }
    expect((await cues(page)).filter((c) => c.id === "carte-donne")).toHaveLength(1);

    await expect(page.locator("[data-flight]")).toHaveCount(0);
    await page.locator("[data-hand] [data-card]").first().click();
    await page.getByRole("button", { name: "Passer cette carte" }).click();
    await expect
      .poll(async () => flightsOf(await records(page), "exchange").length, { timeout: 30_000 })
      .toBe(4);
    for (const flight of flightsOf(await records(page), "exchange")) near(flight.duration, 150, 1);
    expect((await cues(page)).filter((c) => c.id === "carte-echange")).toHaveLength(1);
    expect(
      (await records(page)).filter((r) => r.role === "particle" || r.role === "arc"),
    ).toHaveLength(0);
  });

  test("une main posée : toutes les cartes en même temps, 150 ms", async ({ page }) => {
    await openAny(page, DEAD_HAND);
    await page.getByRole("button", { name: "Poser mes cartes" }).click();
    await expect.poll(async () => flightsOf(await records(page), "lay").length).toBe(3);
    const laid = flightsOf(await records(page), "lay");
    for (const flight of laid) {
      near(flight.duration, 150, 1);
      near(flight.begins, (laid[0] as Rec).begins, 6);
    }
    await expect(page.locator('[data-felt-posed="bleu"] [data-felt-card]')).toHaveCount(3);
  });
});

/** Keeps the main thread busy for `ms` each time a knight's slide is started (a heavy frame). */
function heavyKnightStart(ms: number) {
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
    if (this.getAttribute("data-role") === "mover") {
      const until = performance.now() + ms;
      while (performance.now() < until) {
        // Nothing else runs on the main thread meanwhile.
      }
    }
    return animate.apply(this, args);
  };
}

/** Makes the page believe it is hidden (or visible again), as a switch of tab does. */
async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (value ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

test("onglet caché : le coup en cours finit d’un coup, les suivants s’appliquent sans mouvement ni son, jusqu’au retour", async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Bleu plays a long move; the three bots each play their only card, then the next deal opens.
  await openPosition(page, {
    turn: "bleu",
    pawns: {
      bleu: [{ p: 10 }, "S", "S", "S"],
      jaune: [{ p: 20 }, "S", "S", "S"],
      rouge: [{ p: 20 }, "S", "S", "S"],
      vert: [{ p: 20 }, "S", "S", "S"],
    },
    hands: { bleu: ["12H"], jaune: ["3S"], rouge: ["2S"], vert: ["5S"] },
  });
  await playCard(page, "Dame de cœur", "bleu0");

  // 12 cells: 400 + 133 × 11 = 1863 ms. The tab is hidden half a second into the move.
  const mover = await waitFor(page, "bleu0", "mover", 1863);
  await page.waitForTimeout(500);
  const standing = {
    jaune: await placeOf(page, "jaune0"),
    rouge: await placeOf(page, "rouge0"),
    vert: await placeOf(page, "vert0"),
  };
  const before = {
    cues: (await cues(page)).length,
    clops: (await clopHistory(page)).length,
    animations: (await records(page)).length,
  };
  await setHidden(page, true);

  // The running move ends at once, long before its natural end.
  await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:22", {
    timeout: 800,
  });
  expect(mover.duration).toBeGreaterThan(1800);

  // The bots go on playing while the tab is hidden; the next deal opens: the exchange is asked of him.
  await expect(page.locator("[data-action-zone]")).toHaveAttribute("data-state", "exchange", {
    timeout: 30_000,
  });
  expect(await placeOf(page, "jaune0")).not.toBe(standing.jaune);
  expect(await placeOf(page, "rouge0")).not.toBe(standing.rouge);
  expect(await placeOf(page, "vert0")).not.toBe(standing.vert);
  await expect(page.locator('[data-felt-last="bleu"] [data-felt-card="12H"]')).toBeVisible();
  await expect(page.locator('[data-felt-last="vert"] [data-felt-card="5S"]')).toBeVisible();
  await expect(page.locator("[data-flight]")).toHaveCount(0);

  // Nothing moved and nothing sounded for the events that were skipped.
  expect((await cues(page)).length).toBe(before.cues);
  expect((await clopHistory(page)).length).toBe(before.clops);
  expect((await records(page)).length).toBe(before.animations);

  // Back on the page, the game moves and sounds again.
  await setHidden(page, false);
  await expect(page.locator("[data-hand]")).not.toHaveClass(/concealed/);
  await page.locator("[data-hand] [data-card]").first().click();
  await page.getByRole("button", { name: "Passer cette carte" }).click();
  await expect
    .poll(async () => (await cues(page)).some((c) => c.id === "carte-echange"), {
      timeout: 30_000,
    })
    .toBe(true);
  expect((await cues(page)).length).toBeGreaterThan(before.cues);
  // The cue is logged when the step is scheduled and the cards are recorded once they have taken off
  // (the recorder reads the running animations frame by frame): wait for them, do not read them once.
  await expect
    .poll(async () => flightsOf(await records(page), "exchange").length, { timeout: 10_000 })
    .toBe(4);
});
