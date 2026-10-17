import { expect, type Locator, type Page, test } from "@playwright/test";
import { etatParam } from "./position.ts";

// A seeded game (the `graine` debug parameter fixes the deck and the bots) at test speed (no think
// delay, no motion), and positions made by hand for the dead hand and the end of the game.
const SEED = "1234567890abcdef1234567890abcdef";

const zone = (page: Page) => page.locator("[data-action-zone]");

async function openGame(page: Page, query: string) {
  await page.goto("/");
  await page.goto(`/#/partie?${query}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

/**
 * Checks the info bar: on a computer the bar itself; on a phone held sideways (the compact mode of
 * plan 01-47) the info is a pill whose sheet « Infos de la partie » holds the same bar, so the sheet
 * is opened, checked and closed.
 */
async function checkInfo(page: Page, check: (info: Locator) => Promise<void>) {
  const pill = page.locator('[data-info-bar][data-form="pill"]');
  if ((await pill.count()) === 0) {
    await check(page.locator("[data-info-bar]"));
    return;
  }
  await pill.click();
  const sheet = page.locator("[data-info-sheet]");
  await expect(sheet).toBeVisible();
  await check(sheet.locator("[data-info-bar]"));
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
}

/**
 * The end plank (plan 01-50), once its entrance is over: it lies wholly inside the window and never
 * scrolls.
 */
async function plankInView(page: Page): Promise<Locator> {
  const plank = page.locator("[data-end-plank]");
  await expect(plank).toBeVisible();
  await plank.evaluate((el) =>
    Promise.all(
      (el.closest("[data-end-screen]") ?? el)
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    ),
  );
  const box = await plank.boundingBox();
  const viewport = page.viewportSize();
  expect(box, "the plank has a box").not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box === null || viewport === null) return plank;
  const where = `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)} x ${Math.round(box.height)} in ${viewport.width} x ${viewport.height}`;
  expect(box.x, where).toBeGreaterThanOrEqual(0);
  expect(box.y, where).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, where).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height, where).toBeLessThanOrEqual(viewport.height);
  const scroll = await plank.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(scroll, "the plank does not scroll").toBeLessThanOrEqual(0);
  return plank;
}

/** Chooses the first card of the hand and passes it to the partner. */
async function exchange(page: Page) {
  await expect(zone(page)).toHaveAttribute("data-state", "exchange");
  await page.locator("[data-hand] [data-card]").first().click();
  await page.getByRole("button", { name: "Passer cette carte" }).click();
}

/**
 * Plays the game forward until it is the player's turn with a card he can play: the exchange of every
 * deal is made with the first card, a dead hand is posed. The bots play by themselves.
 */
async function untilOwnTurn(page: Page) {
  for (let i = 0; i < 300; i++) {
    const state = await zone(page).getAttribute("data-state");
    if (state === "idle" || state === "finishedPrompt") return;
    if (state === "exchange") await exchange(page);
    else if (state === "deadHand")
      await page.getByRole("button", { name: "Poser mes cartes" }).click();
    else await page.waitForTimeout(50);
  }
  throw new Error("the player's turn never came");
}

test("l’échange : choisir, passer, attendre, recevoir une carte bordée de la couleur du partenaire", async ({
  page,
}) => {
  await openGame(page, `graine=${SEED}&vitesse=test`);

  // The info bar names the dealer and the deal; the felt shows the talon and the empty défausse.
  await checkInfo(page, async (info) => {
    await expect(info).toContainText("Donneur");
    await expect(info).toContainText("Donne 1 sur 3");
    await expect(info.locator("[data-team-us]")).toContainText("Nous 0/8");
    await expect(info.locator("[data-team-them]")).toContainText("Eux 0/8");
  });
  await expect(page.locator("[data-talon]")).toHaveAttribute("data-talon", "32");
  await expect(page.locator("[data-discard]")).toHaveAttribute("data-discard", "0");
  await expect(page.locator("[data-felt-last]")).toHaveCount(0);
  await expect(page.locator("[data-felt]")).toHaveAttribute("aria-label", "Sur le tapis");

  // Every card can be passed: the button waits for a choice.
  await expect(zone(page)).toContainText("Choisis la carte à passer à");
  const pass = page.getByRole("button", { name: "Passer cette carte" });
  await expect(pass).toBeDisabled();
  const given = await page.locator("[data-hand] [data-card]").first().getAttribute("data-card");
  await page.locator("[data-hand] [data-card]").first().click();
  await expect(pass).toBeEnabled();
  await pass.click();

  // The partner's card arrives: « Échange fait », and the received card wears a thick border of the
  // partner's colour, no text (Romain, 2026-10-17: « Juste un liseré coloré »); its name says
  // whom it comes from, the partner named in the prompt.
  await expect(zone(page)).toContainText("Échange fait. Tu as reçu");
  await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  await expect(page.locator("[data-hand] [data-card]").first()).toBeVisible();
  const got = page.locator("[data-hand] [data-card][data-received]");
  await expect(got).toHaveCount(1);
  await expect(got).toBeVisible();
  await expect(page.getByText("Reçue", { exact: true })).toHaveCount(0);
  const from = /, reçue (?:de |d’)(.+)$/.exec((await got.getAttribute("aria-label")) ?? "")?.[1];
  expect(from, "the received card's name says whom it comes from").toBeTruthy();
  await expect(zone(page)).toContainText(`${from}.`);
  const seat = (await got.getAttribute("data-received")) ?? "";
  const colours: Record<string, string> = {
    bleu: "rgb(31, 79, 168)",
    jaune: "rgb(227, 169, 12)",
    rouge: "rgb(195, 39, 29)",
    vert: "rgb(31, 138, 60)",
  };
  await expect(got.locator(".border")).toHaveCSS("border-top-color", colours[seat] ?? "none");
  await expect(got.locator(".border")).toHaveCSS("border-top-width", "6px");
  await expect(page.locator(`[data-hand] [data-card="${given}"]`)).toHaveCount(0);
  await checkInfo(page, (info) => expect(info).toContainText("Donneur"));
});

test("un coup simple : carte, cheval, aperçu, rien ne bouge seul, « Jouer », la carte sur le tapis", async ({
  page,
}) => {
  await openGame(page, `graine=${SEED}&vitesse=test`);
  await untilOwnTurn(page);

  // A card that moves a knight: not the 7 nor the Valet, which come with later plans.
  const card = page
    .locator('[data-hand] [data-state="playable"]:not([data-card^="7"]):not([data-card^="11"])')
    .first();
  await expect(card).toBeVisible();
  const played = await card.getAttribute("data-card");
  await card.click();

  // The knights that can play it are lit; tap one.
  const halo = page.locator("[data-halo]").first();
  await expect(halo).toBeVisible();
  const pawn = await halo.getAttribute("data-halo");
  await page.locator(`[data-hit="${pawn}"]`).click({ force: true });
  await expect(page.locator("[data-ghost]")).toBeVisible();
  const play = page.getByRole("button", { name: /^Jouer/ });
  await expect(play).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler ce coup" })).toBeVisible();

  const places = () =>
    page
      .locator('[data-pawn^="bleu"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-place")));
  const before = await places();

  // Two seconds later nothing has moved: the game never plays for the player (D-19).
  await page.waitForTimeout(2000);
  expect(await places()).toEqual(before);
  await expect(play).toBeVisible();

  await play.click();
  await expect.poll(places).not.toEqual(before);

  // The card lies on the felt in front of his place.
  await expect(page.locator('[data-felt-last="bleu"]')).toBeVisible();
  await expect(page.locator(`[data-felt-last="bleu"] [data-felt-card="${played}"]`)).toBeVisible();
});

// R-14.2 (packages/engine/scenarios/fin.ts) with a Jaune hand that can play: in the fixture itself the
// other hands are empty, so the next deal starts the moment Bleu lays his cards down and the posed
// hand would not stay on the felt long enough to be seen. Bleu holds a 2, a 4 and a Valet with every
// knight in its stable: nothing can be played.
const DEAD_HAND = {
  turn: "bleu",
  hands: { bleu: ["2S", "4S", "11S"], jaune: ["2H", "3H", "5H"] },
  pawns: { jaune: [{ p: 5 }, "S", "S", "S"] },
};

test("main injouable : rien ne se pose seul, « Poser mes cartes » étale la main sur le tapis", async ({
  page,
}) => {
  await openGame(page, `etat=${etatParam(DEAD_HAND)}`);

  await expect(zone(page)).toHaveAttribute("data-state", "deadHand");
  await expect(zone(page)).toContainText("Aucune carte ne peut être jouée.");
  const pose = page.getByRole("button", { name: "Poser mes cartes" });
  await expect(pose).toBeVisible();
  await expect(page.locator('[data-hand] [data-state="unplayable"]')).toHaveCount(3);

  // Two seconds later the hand is still in the hand zone: the game never poses it for the player (D-20).
  await page.waitForTimeout(2000);
  await expect(page.locator("[data-hand] [data-card]")).toHaveCount(3);
  await expect(page.locator("[data-felt-posed]")).toHaveCount(0);

  await pose.click();
  await expect(page.locator('[data-felt-posed="bleu"] [data-felt-card]')).toHaveCount(3);
  await expect(zone(page)).toContainText("Tu attends la prochaine donne.");
  await expect(page.locator("[data-hand] [data-card]")).toHaveCount(0);
  await expect(page.locator("[data-hand-empty]")).toContainText("Plus de cartes");
  await expect(page.locator("[data-hand-empty]")).toContainText(
    "Attends la prochaine donne : les autres joueurs finissent leur tour.",
  );
});

test("fin de partie : « Victoire ! », les chiffres, « Changer de couleur » revient au départ", async ({
  page,
}, testInfo) => {
  // R-16.4: Bleu's four knights are home and the 5 brings Rouge's last knight home (RULE-17, RULE-18).
  await openGame(page, "scenario=R-16.4&vitesse=test");
  // The partner is a horse picked at random: « ceux de Marengo » or « ceux d’Ourasi ».
  await expect(zone(page)).toContainText(
    /Tes quatre chevaux sont rentrés\. Tu joues avec ceux d(e |’)\S+\./,
  );
  await checkInfo(page, (info) => expect(info.locator("[data-team-us]")).toContainText("Nous 7/8"));

  await page.getByRole("button", { name: "5 de pique, jouable" }).click();
  // The partner's last knight is the only one to play the 5: it is chosen by itself and its move
  // shown (recette 3, test 27); « Jouer » plays it.
  await expect(page.locator('[data-selected="rouge3"]')).toBeVisible();
  await page.getByRole("button", { name: "Jouer", exact: true }).click();

  const end = page.locator("[data-end-screen]");
  await expect(end).toBeVisible();
  await expect(end).toHaveAttribute("data-result", "win");
  await expect(end.getByRole("heading", { name: "Victoire !" })).toBeVisible();
  await expect(end).toContainText("Ton équipe a rentré ses 8 chevaux.");
  await expect(end).toContainText(/Donnes jouées\s*: 0/);
  await expect(end).toContainText(/Chevaux mangés\s*: nous 0, eux 0/);
  await expect(page.getByRole("button", { name: "Rejouer" })).toBeFocused();

  // The plank (plan 01-50): the score « nous – eux », 8 for us; Bleu (« Toi ») and Rouge, each on its
  // disc with Romain's knight; the two buttons; all of it inside the window, phone and computer.
  const plank = await plankInView(page);
  await expect(plank).toHaveAttribute("role", "dialog");
  const score = plank.locator("[data-end-score]");
  await expect(score.locator('[data-score="nous"] .number')).toHaveText("8");
  await expect(score.locator('[data-score="eux"] .number')).toHaveText("0");
  await expect(score).toContainText("Nous");
  await expect(score).toContainText("Eux");
  await expect(score).toContainText(/Score\s*: nous 8 chevaux rentrés sur 8, eux 0 sur 8/);
  const knights = plank.locator("[data-end-knight]");
  await expect(knights).toHaveCount(2);
  await expect(knights.nth(0)).toHaveAttribute("data-end-knight", "bleu");
  await expect(knights.nth(0).locator("figcaption")).toHaveText("Toi");
  await expect(knights.nth(1)).toHaveAttribute("data-end-knight", "rouge");
  await expect(knights.nth(1).locator("figcaption")).not.toHaveText("Toi");
  for (const color of ["bleu", "rouge"]) {
    const img = plank.locator(`[data-end-knight="${color}"] img`);
    await expect(img).toHaveAttribute("src", `./cavaliers/${color}.webp`);
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(
      true,
    );
  }
  await expect(plank.getByText("L’équipe adverse", { exact: true })).toHaveCount(0);
  await expect(plank.getByRole("button", { name: "Rejouer" })).toBeVisible();
  await expect(plank.getByRole("button", { name: "Changer de couleur" })).toBeVisible();
  await page.screenshot({ path: `test-results/fin-victoire-${testInfo.project.name}.png` });

  // The game behind the panel is inert: none of its controls can take the focus, and after a tap on
  // the dimmed board Tab stays in the panel.
  await expect(page.locator("[data-layout]")).toHaveAttribute("inert", "");
  const behind = await page.evaluate(() => {
    const gear = document.querySelector<HTMLElement>("[data-layout] button");
    gear?.focus();
    return gear !== null && document.activeElement === gear;
  });
  expect(behind, "a button of the game behind takes the focus").toBe(false);
  await page.mouse.click(4, 4);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    const inPanel = await page.evaluate(
      () => document.activeElement?.closest("[data-end-screen]") !== null,
    );
    expect(inPanel, `Tab ${i + 1} stays in the end screen`).toBe(true);
  }

  await page.getByRole("button", { name: "Changer de couleur" }).click();
  await expect(page).toHaveURL(/#\/ordinateur$/);
  await expect(page.getByRole("button", { name: "Jouer la partie" })).toBeVisible();
});

test("fin de partie : « Défaite », l’équipe adverse et son score, la planche dans chaque fenêtre", async ({
  page,
}, testInfo) => {
  // Bleu holds only a 2 with two knights in the stable: the hand is dead and is posed. Vert then plays
  // the 5 that brings its last knight home; Jaune is home already, so Jaune and Vert win. Bleu and
  // Rouge have 2 + 3 knights home: the score reads 5 – 8. Reduced motion: the plank only fades in.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const position = {
    pawns: {
      bleu: [{ h: 2 }, { h: 3 }, "S", "S"],
      rouge: [{ h: 0 }, { h: 1 }, { h: 2 }, { p: 30 }],
      jaune: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
      vert: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 66 }],
    },
    hands: { bleu: ["2S"], vert: ["5S"] },
    turn: "bleu",
  };
  await openGame(page, `etat=${etatParam(position)}&vitesse=test`);
  await expect(zone(page)).toHaveAttribute("data-state", "deadHand");
  await page.getByRole("button", { name: "Poser mes cartes" }).click();

  const end = page.locator("[data-end-screen]");
  await expect(end).toBeVisible();
  await expect(end).toHaveAttribute("data-result", "loss");
  await expect(end.getByRole("heading", { name: "Défaite" })).toBeVisible();
  await expect(end).toContainText("L’équipe adverse a rentré ses 8 chevaux.");
  await expect(page.getByRole("button", { name: "Rejouer" })).toBeFocused();

  // With reduced motion, a 150 ms fade and nothing that moves.
  const motion = await page.locator("[data-end-plank]").evaluate((el) =>
    el.getAnimations().map((animation) => ({
      duration: animation.effect?.getTiming().duration,
      moves: (animation.effect as KeyframeEffect | null)
        ?.getKeyframes()
        .some((frame) => frame.transform !== undefined && frame.transform !== "none"),
    })),
  );
  expect(motion.length).toBeGreaterThan(0);
  for (const animation of motion) expect(animation).toEqual({ duration: 150, moves: false });

  const plank = await plankInView(page);
  await expect(plank.getByText("L’équipe adverse", { exact: true })).toBeVisible();
  const knights = plank.locator("[data-end-knight]");
  await expect(knights).toHaveCount(2);
  for (const color of ["jaune", "vert"]) {
    const knight = plank.locator(`[data-end-knight="${color}"]`);
    await expect(knight.locator("img")).toHaveAttribute("src", `./cavaliers/${color}.webp`);
    await expect(knight.locator("figcaption")).not.toHaveText("Toi");
    await expect(knight.locator("figcaption")).not.toHaveText("");
  }
  const score = plank.locator("[data-end-score]");
  await expect(score.locator('[data-score="nous"] .number')).toHaveText("5");
  await expect(score.locator('[data-score="eux"] .number')).toHaveText("8");
  await expect(score).toContainText(/Score\s*: nous 5 chevaux rentrés sur 8, eux 8 sur 8/);
  await expect(plank).toContainText(/Donnes jouées\s*: 0/);
  await page.screenshot({ path: `test-results/fin-defaite-${testInfo.project.name}.png` });

  // The smallest phone held sideways, and back: the plank still fits, Tab still stays in it.
  await page.setViewportSize({ width: 480, height: 320 });
  await plankInView(page);
  await page.screenshot({ path: `test-results/fin-defaite-480x320-${testInfo.project.name}.png` });
  await expect(page.locator("[data-layout]")).toHaveAttribute("inert", "");
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    const inPanel = await page.evaluate(
      () => document.activeElement?.closest("[data-end-plank]") !== null,
    );
    expect(inPanel, `Tab ${i + 1} stays on the plank`).toBe(true);
  }
});

test("fin de partie : « Rejouer » ouvre une nouvelle partie avec la même couleur", async ({
  page,
}) => {
  // R-16.1: Rouge plays the 5 that brings his last knight home, which wins for Bleu and Rouge.
  await openGame(page, "scenario=R-16.1&vitesse=test");
  const turns = await page.locator("[data-board]").getAttribute("data-k");
  expect(turns).not.toBe("0");

  await page.getByRole("button", { name: "5 de pique, jouable" }).click();
  await page.locator('[data-hit="rouge3"]').click({ force: true });
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  await expect(page.locator("[data-end-screen]")).toBeVisible();

  await page.getByRole("button", { name: "Rejouer" }).click();
  await expect(page.locator("[data-end-screen]")).toHaveCount(0);
  await expect(page.locator("[data-board]")).toHaveAttribute("data-k", turns as string);
  await expect(zone(page)).toHaveAttribute("data-state", "exchange");
  await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  await checkInfo(page, async (info) => {
    await expect(info).toContainText("Donne 1 sur 3");
    await expect(info.locator("[data-team-us]")).toContainText("Nous 0/8");
  });
});
