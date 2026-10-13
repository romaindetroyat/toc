import { expect, type Page, test } from "@playwright/test";
import { etatParam } from "./position.ts";

// The animations of the knights (plan 01-19): durations, order and sounds of the stable exit, the
// walk, the backward 4, a capture on the final cell and in the middle of a 7, the Valet swap, the
// home entry and the party of the fourth knight, then fast mode and reduced motion. The positions
// are made by hand with the `etat` debug parameter and played at normal speed (no `vitesse=test`).
//
// Every Web Animation on a knight is recorded by a requestAnimationFrame loop installed before the
// page loads: which knight, which inner group, its duration, delay and the moment it begins. The
// sounds come from window.__tocDebug.audio.cues (debug builds), read by id and by time.

type Rec = {
  pawn: string | null;
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
      const owner = target.closest("[data-pawn], [data-particles]");
      if (owner === null) continue;
      known.add(animation);
      const timing = animation.effect?.getTiming();
      const duration = Number(timing?.duration);
      const delay = Number(timing?.delay ?? 0);
      const iterations = Number(timing?.iterations ?? 1);
      const begins = Number(animation.startTime) + delay;
      w.__anims.push({
        pawn: owner.getAttribute("data-pawn"),
        role: target.getAttribute("data-role") ?? "particle",
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
 * Freezes every knight animation at step time `at` (ms after the step started, lead included),
 * takes the screenshot and lets them run on. For the human check of plan 01-22.
 */
async function shoot(page: Page, name: string, at: number) {
  await page.evaluate((time) => {
    const w = window as unknown as TocWindow;
    w.__paused = [];
    for (const animation of document.getAnimations()) {
      const target = animation.effect && (animation.effect as KeyframeEffect).target;
      if (!(target instanceof Element) || !target.closest("[data-pawn], [data-particles]"))
        continue;
      if (animation.playState !== "running") continue;
      animation.pause();
      animation.currentTime = time;
      w.__paused.push(animation);
    }
  }, at);
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
