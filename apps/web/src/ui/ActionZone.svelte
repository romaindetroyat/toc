<script lang="ts">
  import {
    COLORS,
    type Color,
    PARTNER,
    type PawnId,
    type PlayerView,
    pawnColor,
    rankOf,
    type Reason,
  } from "@toc/engine";
  import { fade } from "svelte/transition";
  import type { BotPlay } from "../game/session.svelte.ts";
  import type { TurnUiState } from "../game/turnUi.ts";
  import { cardName, cardWithArticle } from "../i18n/fr/cards.ts";
  import { clavier } from "../i18n/fr/clavier.ts";
  import { botLine, game } from "../i18n/fr/game.ts";
  import { settings, updateSettings } from "../settings/store.svelte.ts";
  import Icon from "./Icon.svelte";
  import KeyHint from "./KeyHint.svelte";
  import PawnTray from "./PawnTray.svelte";

  type Props = {
    ui: TurnUiState;
    view: PlayerView;
    human: Color;
    names: Record<Color, string>;
    /** The reason a tapped card cannot be played, or « illegal ». */
    hint: Reason | "illegal" | null;
    /** A tap on the board missed every lit knight. */
    missed: boolean;
    thinking: Color | null;
    lastPlay: BotPlay | null;
    onconfirm: () => void;
    oncancel: () => void;
    onchangeCard: () => void;
    ongive: () => void;
    onpose: () => void;
    onexit: () => void;
    onadvance: () => void;
    ontrayPick: (pawn: PawnId) => void;
    ontrayClose: () => void;
    /**
     * In the computer's bottom bar: the zone fills its column (no 72 / 160 px bounds), the prompt on
     * top (Body 16, up to three lines, then it scrolls) and the buttons right-aligned under it.
     */
    bar?: boolean;
    /**
     * In the compact bar of a phone held sideways (plan 01-37): one row, the prompt at the left in
     * Label 14 (three lines in the 64 px row, two in the 56 px row, a longer one scrolls inside) and
     * the state's buttons side by side at the right, in an area of --band-buttons (about 184 px)
     * kept in every state.
     */
    band?: boolean;
  };

  let {
    ui,
    bar = false,
    band = false,
    view,
    human,
    names,
    hint,
    missed,
    thinking,
    lastPlay,
    onconfirm,
    oncancel,
    onchangeCard,
    ongive,
    onpose,
    onexit,
    onadvance,
    ontrayPick,
    ontrayClose,
  }: Props = $props();

  const partner = $derived(PARTNER[human]);

  // « Échange fait » follows the exchange until the player picks a card of his own (D-21).
  let exchanged = $state(false);
  $effect(() => {
    if (ui.kind === "exchangeWaiting") exchanged = true;
    else if (
      ui.kind === "cardSelected" ||
      ui.kind === "modeChoice" ||
      ui.kind === "jackPick" ||
      ui.kind === "jackTarget" ||
      ui.kind === "preview" ||
      ui.kind === "exchange"
    ) {
      exchanged = false;
    }
  });
  const doneLine = $derived(
    exchanged && view.phase === "play" && view.received !== null && view.hand.includes(view.received)
      ? game.exchange.done(cardWithArticle(view.received), names[partner])
      : null,
  );

  /** The other three players with their exchange state: a check once chosen, an hourglass until then. */
  const givers = $derived(
    COLORS.filter((color) => color !== human).map((color) => ({
      color,
      name: names[color],
      done: view.hasGiven[color],
    })),
  );

  /** The sentence(s) of the zone: a list of lines, the first one is the prompt. */
  const lines = $derived.by((): string[] => {
    if (hint === "illegal") return [game.illegal];
    if (hint !== null) return [game.reasons[hint]];
    const done = doneLine === null ? [] : [doneLine];
    switch (ui.kind) {
      case "waiting":
      case "empty":
      case "posed": {
        const after = ui.kind === "posed" ? [game.dead.after] : [];
        if (view.phase === "won") return [];
        if (thinking !== null) return [...done, ...after, game.bot.thinking(names[thinking])];
        if (lastPlay !== null) {
          const line = botLine(names[lastPlay.seat], lastPlay.events);
          return line === "" ? [...done, ...after] : [...done, ...after, line];
        }
        return [...done, ...after];
      }
      case "idle":
        return [...done, game.turn.ownTurn];
      case "finishedPrompt":
        return [game.finished(names[partner]), game.turn.ownTurn];
      case "cardSelected": {
        if (missed) return [game.turn.chooseLit];
        // A lone knight never gets here: its card opens the preview by itself (recette 3, test 27).
        return [game.turn.chooseHorse];
      }
      case "modeChoice":
        return [game.turn.modeQuestion];
      case "jackPick":
        return [missed ? game.turn.chooseLit : game.turn.jackFirst];
      case "jackTarget":
        return [missed ? game.turn.chooseLit : game.turn.jackSecond];
      case "tray":
      case "sevenBuilding":
        return [];
      case "preview": {
        const out = [describe(ui)];
        if (ui.captured.length > 0) out.push(captureLine(ui));
        if (ui.partnerCapture) out.push(game.preview.partnerCapture);
        return out;
      }
      case "exchange":
        return [game.exchange.choose(names[partner])];
      case "exchangeWaiting":
        return [game.exchange.waiting(ui.pending.map((color) => names[color]))];
      case "deadHand":
        return [game.dead.message, game.dead.body];
    }
  });

  function describe(state: Extract<TurnUiState, { kind: "preview" }>): string {
    const d = state.description;
    if (d.verb === "exit") return game.preview.exit;
    if (d.verb === "swap") return game.preview.swap(pawnColor(d.target ?? d.pawn));
    const main = d.verb === "back" ? game.preview.back : game.preview.advance(cardName(state.card), d.steps);
    return d.entersHome ? `${main} ${game.preview.home}` : main;
  }

  function captureLine(state: Extract<TurnUiState, { kind: "preview" }>): string {
    const victims = state.captured;
    if (victims.length > 1) return game.preview.captureMany(victims.length);
    return game.preview.captureOne(pawnColor(victims[0] as PawnId));
  }

  // One key per displayed state, so the zone cross-fades (150 ms, none under reduced motion).
  const key = $derived(`${ui.kind}|${hint ?? ""}|${missed}|${thinking ?? ""}|${lines.join("/")}`);
  const fadeMs = $derived(settings.reduceMotion ? 0 : 150);
  const showFast = $derived(
    (ui.kind === "waiting" || ui.kind === "empty" || ui.kind === "posed") && view.phase !== "won",
  );
</script>

<!-- Action zone (UI-SPEC): one state at a time, an aria-live region, prompt lines never truncated. -->
<section class="zone" class:bar class:band aria-live="polite" data-action-zone data-state={ui.kind}>
  {#key key}
    <div class="content" in:fade={{ duration: fadeMs }}>
      {#if lines.length > 0}
        <!-- In the band the givers of the exchange take the prompt's place: the sentence stays for
             screen readers only. -->
        <div class="text" class:spoken={band && ui.kind === "exchangeWaiting"}>
          {#each lines as line, i (i)}
            <p class:prompt={i === 0}>{line}</p>
          {/each}
        </div>
      {/if}

      {#if ui.kind === "exchangeWaiting"}
        <ul class="givers" data-givers>
          {#each givers as giver (giver.color)}
            <li data-giver={giver.color} data-done={giver.done}>
              <Icon name={giver.done ? "check" : "hourglass"} size={16} />
              <span>{giver.name}</span>
            </li>
          {/each}
        </ul>
      {:else if ui.kind === "modeChoice"}
        <div class="buttons modes">
          <button
            type="button"
            class="btn btn-primary hinted"
            data-mode="exit"
            aria-label={game.turn.exitButton}
            aria-keyshortcuts="S"
            onclick={onexit}
          >
            {game.turn.exitButton}
            <KeyHint label={clavier.keys.exit} />
          </button>
          <button
            type="button"
            class="btn btn-primary hinted"
            data-mode="advance"
            aria-label={game.turn.advanceButton(rankOf(ui.card))}
            aria-keyshortcuts="A"
            onclick={onadvance}
          >
            {game.turn.advanceButton(rankOf(ui.card))}
            <KeyHint label={clavier.keys.advance} />
          </button>
        </div>
      {:else if ui.kind === "tray"}
        <PawnTray options={ui.options} {band} onpick={ontrayPick} onclose={ontrayClose} />
      {:else if ui.kind === "cardSelected" || ui.kind === "jackPick" || ui.kind === "jackTarget"}
        <!-- « Changer de carte » and « Annuler ce coup » show no key: they drop the card in one go, while
             Échap only goes back one step (UI-SPEC addendum, key hints). -->
        <div class="buttons">
          <button type="button" class="btn btn-secondary" onclick={onchangeCard}>
            {game.buttons.changeCard}
          </button>
        </div>
      {:else if ui.kind === "preview"}
        <div class="buttons">
          <button type="button" class="btn btn-secondary" onclick={oncancel}>
            {game.buttons.cancel}
          </button>
          <button
            type="button"
            class="btn btn-primary play hinted"
            aria-label={ui.partnerCapture ? game.buttons.playAnyway : game.buttons.play}
            aria-keyshortcuts="Enter"
            onclick={onconfirm}
          >
            {ui.partnerCapture ? game.buttons.playAnyway : game.buttons.play}
            <KeyHint label={clavier.keys.enter} />
          </button>
        </div>
      {:else if ui.kind === "exchange"}
        <div class="buttons">
          <button
            type="button"
            class="btn btn-primary play hinted"
            disabled={ui.selected === undefined}
            aria-label={game.exchange.pass}
            aria-keyshortcuts="Enter P"
            onclick={ongive}
          >
            {game.exchange.pass}
            <KeyHint label={clavier.keys.enter} />
          </button>
        </div>
      {:else if ui.kind === "deadHand"}
        <div class="buttons">
          <button
            type="button"
            class="btn btn-primary play hinted"
            aria-label={game.dead.pose}
            aria-keyshortcuts="P Enter"
            onclick={onpose}
          >
            {game.dead.pose}
            <KeyHint label={clavier.keys.pass} />
          </button>
        </div>
      {/if}
    </div>
  {/key}

  {#if showFast}
    <button
      type="button"
      class="fast"
      aria-pressed={settings.fast}
      aria-label={game.fast}
      onclick={() => updateSettings({ fast: !settings.fast })}
    >
      <Icon name="fast-forward" />
      <span class="fast-label">{game.fast}</span>
    </button>
  {/if}
</section>

<style>
  .zone {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    min-height: 72px;
    max-height: 160px;
    padding: var(--space-sm) var(--space-md);
    overflow: visible;
  }

  /* The prompt and its buttons share a row when they fit (72 px), and stack when they do not. */
  .content {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .text {
    flex: 1 1 140px;
    min-width: 0;
  }

  .text p {
    margin: 0;
    color: var(--creme);
    font-size: var(--body-size);
    line-height: var(--body-line);
    /* Up to three lines, never cut: the zone grows instead. */
    overflow-wrap: anywhere;
  }

  .text p:not(.prompt) {
    color: var(--creme-attenuee);
  }

  /* One row per player: a check once he has chosen, an hourglass until then. */
  .givers {
    flex: 1 1 100%;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs) var(--space-md);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .givers li {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    font-weight: 700;
    line-height: var(--label-line);
  }

  .givers li[data-done="true"] {
    color: var(--creme);
  }

  .buttons {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-left: auto;
    gap: var(--space-sm);
  }

  .play {
    min-width: 120px;
  }

  /* A button with a key hint: the badge is placed from its edges, the button keeps its size. */
  .hinted {
    position: relative;
  }

  /* « Sortir un cheval » and « Avancer de n » side by side, each 48 px high. */
  .modes {
    flex: 1 1 100%;
    flex-wrap: nowrap;
    margin-left: 0;
  }

  .modes .btn {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 var(--space-sm);
  }

  /* « Avance rapide »: a 44 x 44 toggle, with its label from 600 px up. */
  .fast {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    min-width: var(--touch);
    min-height: var(--touch);
    padding: 0 var(--space-sm);
    border: 2px solid var(--creme);
    border-radius: var(--radius-button);
    background: transparent;
    color: var(--creme);
    font-size: var(--label-size);
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .fast[aria-pressed="true"] {
    background: var(--creme);
    color: var(--noyer);
  }

  .fast-label {
    display: none;
  }

  /* The bottom bar (computers): one column, the prompt on top and the buttons under it at the right. */
  .zone.bar {
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    height: 100%;
    min-height: 0;
    max-height: none;
    padding: var(--space-sm) 0;
  }

  .bar .content {
    flex: 0 1 auto;
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
    justify-content: center;
    min-height: 0;
  }

  /* Three lines of Body 16 (24 px each), then the text scrolls inside. */
  .bar .text {
    flex: 0 1 auto;
    min-height: 0;
    max-height: calc(3 * var(--body-size) * var(--body-line));
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .bar .givers {
    flex: none;
  }

  .bar .buttons {
    flex: none;
    flex-wrap: nowrap;
    align-self: flex-end;
    margin-left: 0;
  }

  .bar .modes {
    align-self: stretch;
  }

  .bar .fast {
    align-self: flex-end;
  }

  /*
   * The compact bar (a phone held sideways): the zone is its row (64 or 56 px). The prompt is at the
   * left and the buttons' area of --band-buttons at the right, the same in every state, so a prompt
   * never moves when the buttons change. « Avance rapide » takes that area while the computer plays.
   */
  .zone.band {
    height: 100%;
    min-height: 0;
    max-height: none;
    padding: 0;
    gap: 0;
  }

  .band .content {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--band-buttons, 184px);
    align-items: center;
    column-gap: var(--space-sm);
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  /* Label 14; three lines in the 64 px row, two in the 56 px row, then the text scrolls inside. */
  .band .text {
    grid-column: 1;
    grid-row: 1;
    align-self: center;
    max-height: 100%;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .band .text p {
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .band .text.spoken {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .band .givers {
    grid-column: 1;
    grid-row: 1;
    gap: 0 var(--space-sm);
    max-height: 100%;
    overflow-y: auto;
  }

  .band .buttons {
    grid-column: 2;
    grid-row: 1;
    flex-wrap: nowrap;
    justify-content: flex-end;
    margin-left: 0;
    gap: var(--space-sm);
  }

  /* Label 14 bold on two lines at most, at least 44 px high. */
  .band .buttons .btn {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 var(--space-sm);
    font-size: var(--label-size);
    line-height: 1.2;
    text-align: center;
  }

  .band .play {
    min-width: 0;
  }

  .band .modes {
    flex-wrap: nowrap;
  }

  .band .fast {
    position: absolute;
    top: 50%;
    right: 0;
    width: var(--band-buttons, 184px);
    transform: translateY(-50%);
  }

  .band .fast-label {
    display: inline;
  }

  @media (min-width: 600px) {
    .fast {
      min-width: 120px;
    }

    .fast-label {
      display: inline;
    }
  }
</style>
