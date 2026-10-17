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
  import SeatChip from "./SeatChip.svelte";

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
     * The compact mode of a phone held sideways (plan 01-47): the zone is drawn in parts, each in its
     * place beside the full-height galet (see `part`). The buttons show short labels; their
     * accessible names and their titles keep the full ones.
     */
    compact?: boolean;
    /**
     * What this instance draws. « all » (the computer's bar): the prompt, the buttons and « Avance
     * rapide » together. In the compact mode: « prompt », the one-line prompt over the board (the
     * aria-live region, `data-action-zone`); « buttons », the state's buttons stacked at the bottom of
     * the right strip; « fast », « Avance rapide » as a 44 x 44 icon at the top of that strip.
     */
    part?: "all" | "prompt" | "buttons" | "fast";
  };

  let {
    ui,
    bar = false,
    compact = false,
    part = "all",
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

  /**
   * The compact prompt row holds one line: the lines follow each other and a longer text ends with
   * « … » (its full text stays in the region and in the title). The warning of a partner's capture
   * comes first there, so it is never the part that is cut. The « Lequel ? » chips stand in the left
   * strip, so the row asks the question.
   */
  const rowLines = $derived.by((): string[] => {
    if (ui.kind === "tray" && hint === null) return [game.tray.question];
    if (ui.kind === "preview" && ui.partnerCapture && hint === null) {
      return [game.preview.partnerCapture, ...lines.filter((line) => line !== game.preview.partnerCapture)];
    }
    return lines;
  });
  const rowText = $derived(rowLines.join(" "));

  /**
   * The line « {Nom} réfléchit… » while a computer player thinks, if shown: it starts with that
   * seat's glyph breathing in its ring (plan 03-09, « Pas assez visible »), on the computer's action
   * zone and in the phone's prompt row. The glyph is decorative: the line already names the seat.
   */
  const thinkingLine = $derived(
    thinking !== null && thinking !== human ? game.bot.thinking(names[thinking]) : null,
  );

  // One key per displayed state, so the zone cross-fades (150 ms, none under reduced motion).
  const key = $derived(`${ui.kind}|${hint ?? ""}|${missed}|${thinking ?? ""}|${lines.join("/")}`);
  const fadeMs = $derived(settings.reduceMotion ? 0 : 150);
  const showFast = $derived(
    (ui.kind === "waiting" || ui.kind === "empty" || ui.kind === "posed") && view.phase !== "won",
  );
</script>

{#snippet stateButtons()}
  {#if ui.kind === "modeChoice"}
    <div class="buttons modes">
      <button
        type="button"
        class="btn btn-primary hinted"
        data-mode="exit"
        aria-label={game.turn.exitButton}
        aria-keyshortcuts="S"
        title={compact ? game.turn.exitButton : undefined}
        onclick={onexit}
      >
        {compact ? game.compact.exit : game.turn.exitButton}
        <KeyHint label={clavier.keys.exit} />
      </button>
      <button
        type="button"
        class="btn btn-primary hinted"
        data-mode="advance"
        aria-label={game.turn.advanceButton(rankOf(ui.card))}
        aria-keyshortcuts="A"
        title={compact ? game.turn.advanceButton(rankOf(ui.card)) : undefined}
        onclick={onadvance}
      >
        {compact ? game.compact.advance(rankOf(ui.card)) : game.turn.advanceButton(rankOf(ui.card))}
        <KeyHint label={clavier.keys.advance} />
      </button>
    </div>
  {:else if ui.kind === "tray"}
    <PawnTray
      options={ui.options}
      part={compact ? "close" : "all"}
      {compact}
      onpick={ontrayPick}
      onclose={ontrayClose}
    />
  {:else if ui.kind === "cardSelected" || ui.kind === "jackPick" || ui.kind === "jackTarget"}
    <!-- « Changer de carte » and « Annuler ce coup » show no key: they drop the card in one go, while
         Échap only goes back one step (UI-SPEC addendum, key hints). -->
    <div class="buttons">
      <button
        type="button"
        class="btn btn-secondary"
        aria-label={compact ? game.buttons.changeCard : undefined}
        title={compact ? game.buttons.changeCard : undefined}
        onclick={onchangeCard}
      >
        {compact ? game.compact.changeCard : game.buttons.changeCard}
      </button>
    </div>
  {:else if ui.kind === "preview"}
    <div class="buttons">
      <button
        type="button"
        class="btn btn-secondary"
        aria-label={compact ? game.buttons.cancel : undefined}
        title={compact ? game.buttons.cancel : undefined}
        onclick={oncancel}
      >
        {compact ? game.compact.cancel : game.buttons.cancel}
      </button>
      <button
        type="button"
        class="btn btn-primary play hinted"
        aria-label={ui.partnerCapture ? game.buttons.playAnyway : game.buttons.play}
        aria-keyshortcuts="Enter"
        title={compact ? (ui.partnerCapture ? game.buttons.playAnyway : game.buttons.play) : undefined}
        onclick={onconfirm}
      >
        {compact
          ? game.buttons.play
          : ui.partnerCapture
            ? game.buttons.playAnyway
            : game.buttons.play}
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
        title={compact ? game.exchange.pass : undefined}
        onclick={ongive}
      >
        {compact ? game.compact.pass : game.exchange.pass}
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
        title={compact ? game.dead.pose : undefined}
        onclick={onpose}
      >
        {compact ? game.compact.pose : game.dead.pose}
        <KeyHint label={clavier.keys.pass} />
      </button>
    </div>
  {/if}
{/snippet}

{#snippet thinkingGlyph()}
  {#if thinking !== null}
    <span
      class="thinking-glyph respire"
      data-thinking-line={thinking}
      style:--respire-seat={`var(--seat-${thinking}-clair)`}
      aria-hidden="true"
    >
      <SeatChip color={thinking} showName={false} label={false} small />
    </span>
  {/if}
{/snippet}

{#snippet givingList()}
  <ul class="givers" data-givers>
    {#each givers as giver (giver.color)}
      {@const breathing = !giver.done && giver.color === thinking}
      <!-- The thinking sign (D-12, 03-09): the computer player choosing its card breathes, its
           hourglass swelling in a ring of its seat colour and its name fading; with reduced motion the
           ring stays still and a fixed « … » follows the name. -->
      <li data-giver={giver.color} data-done={giver.done} class:thinking={breathing}>
        <span
          class="giver-icon"
          class:respire={breathing}
          data-thinking={breathing ? giver.color : undefined}
          style:--respire-seat={breathing ? `var(--seat-${giver.color}-clair)` : undefined}
        >
          <Icon name={giver.done ? "check" : "hourglass"} size={16} />
        </span>
        <span class:respire-texte={breathing}>{giver.name}</span>
        {#if breathing}
          <span class="respire-mark" aria-hidden="true">…</span>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#if part === "fast"}
  <!-- The compact mode: « Avance rapide » at the top of the right strip, its icon only. -->
  {#if showFast}
    <button
      type="button"
      class="fast icon-only"
      aria-pressed={settings.fast}
      aria-label={game.fast}
      title={game.fast}
      data-fast
      onclick={() => updateSettings({ fast: !settings.fast })}
    >
      <Icon name="fast-forward" />
    </button>
  {/if}
{:else if part === "buttons"}
  <!-- The compact mode: the state's buttons, stacked at the bottom of the right strip, the primary
       one lowest. The prompt is read from the prompt row's live region. -->
  <div class="stack" data-action-buttons data-state={ui.kind}>
    {#key key}
      <div class="stack-content" in:fade={{ duration: fadeMs }}>
        {@render stateButtons()}
      </div>
    {/key}
  </div>
{:else}
  <!-- Action zone (UI-SPEC): one state at a time, an aria-live region, prompt lines never truncated
       (in the compact prompt row, one line: the full text stays in the region and in the title). -->
  <section
    class="zone"
    class:still={settings.reduceMotion}
    class:bar
    class:row={part === "prompt"}
    aria-live="polite"
    data-action-zone
    data-state={ui.kind}
  >
    {#key key}
      <div class="content" in:fade={{ duration: fadeMs }}>
        {#if part === "prompt"}
          {#if ui.kind === "exchangeWaiting"}
            <!-- The givers take the line's place; the sentence stays for screen readers only. -->
            <p class="spoken">{rowText}</p>
            {@render givingList()}
          {:else if rowLines.length > 0}
            <!-- The glyph stands before the line, outside it: the line clips its overflow. -->
            {#if thinkingLine !== null && rowLines.includes(thinkingLine)}
              {@render thinkingGlyph()}
            {/if}
            <p class="line" title={rowText} data-prompt-line>
              {#each rowLines as line, i (i)}{#if i > 0}{" "}{/if}<span class:prompt={i === 0}
                  >{line}</span
                >{/each}
            </p>
          {/if}
        {:else}
          {#if lines.length > 0}
            <!-- While a bot thinks, its glyph stands at the left of the text, outside it: the text
                 scrolls past three lines and would clip the glyph's ring. -->
            <div class="said">
              {#if thinkingLine !== null && lines.includes(thinkingLine)}
                {@render thinkingGlyph()}
              {/if}
              <div class="text">
                {#each lines as line, i (i)}
                  <p class:prompt={i === 0}>{line}</p>
                {/each}
              </div>
            </div>
          {/if}

          {#if ui.kind === "exchangeWaiting"}
            {@render givingList()}
          {:else}
            {@render stateButtons()}
          {/if}
        {/if}
      </div>
    {/key}

    {#if showFast && part === "all"}
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
{/if}

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

  .givers li[data-done="true"],
  .givers li.thinking {
    color: var(--creme);
  }

  /* The text, with the thinking glyph at its left while a bot thinks. */
  .said {
    flex: 1 1 140px;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .said .text {
    flex: 1 1 auto;
  }

  /* The glyph before « {Nom} réfléchit… », breathing in its ring, 6 px clear of its neighbours. */
  .thinking-glyph {
    flex: none;
    display: inline-flex;
    margin-left: 6px;
  }

  /* The giver's icon in its own box, so that it can breathe about its centre. */
  .giver-icon {
    flex: none;
    display: inline-flex;
    /* Room for the thinking ring (4 px out, swelling with the breath) clear of the name. */
    margin: 0 4px;
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
  .bar .said {
    flex: 0 1 auto;
    min-height: 0;
  }

  /* The bar's column clips at its edge: the ring and its glow need 16 px there. */
  .bar .thinking-glyph {
    margin-left: 16px;
  }

  .bar .text {
    flex: 0 1 auto;
    min-height: 0;
    max-height: calc(3 * var(--body-size) * var(--body-line));
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* Indented so that the thinking ring and its glow stay inside the action column, which clips. */
  .bar .givers {
    flex: none;
    padding-left: 12px;
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
   * The compact mode (a phone held sideways, plan 01-47). The prompt row: one line of Label 14 in
   * cream, centred over the board, a longer text ending with « … ».
   */
  .zone.row {
    display: block;
    height: 100%;
    min-height: 0;
    max-height: none;
    padding: 0 var(--space-xs);
  }

  .row .content {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .row .line {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: var(--label-line);
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row .thinking-glyph {
    margin: 0 4px 0 0;
    --respire-inset: 2px;
  }

  .row .line .prompt {
    color: var(--creme);
  }

  .row .spoken {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .row .givers {
    flex: 0 1 auto;
    flex-wrap: nowrap;
    min-width: 0;
    overflow: hidden;
    gap: 0 var(--space-md);
  }

  .row .givers li {
    flex: none;
  }

  /* The buttons' column: --strip-button wide (58 px: « Annuler » is 52.4 px in Label 14 bold),
     stacked 4 px apart at the bottom of the right strip, at least 48 px high each, Label 14 bold on
     two lines at most. A computer's key badges sit astride each button's top edge: 12 px apart then,
     so a badge never covers the button above. */
  .stack,
  .stack-content,
  .stack .buttons {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: var(--space-xs);
  }

  .stack .buttons {
    flex-wrap: nowrap;
    margin: 0;
  }

  .stack .btn {
    width: var(--strip-button, 58px);
    min-width: 0;
    min-height: var(--button-height);
    padding: 2px 0;
    font-size: var(--label-size);
    letter-spacing: -0.01em;
    line-height: 1.2;
    text-align: center;
    overflow-wrap: normal;
  }

  /* A computer's key badge stays over its button, never over the board beside the strip. */
  .stack :global(.key-hint.corner) {
    right: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    .stack,
    .stack-content,
    .stack .buttons {
      gap: 12px;
    }
  }

  .stack .play {
    min-width: 0;
  }

  /* « Avance rapide » at the top of the right strip: its icon only, 44 x 44. */
  .fast.icon-only {
    width: var(--touch);
    min-width: var(--touch);
    padding: 0;
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
