<script lang="ts">
  import { type CardId, type PawnId, pawnColor } from "@toc/engine";
  import { cardFace } from "../cards/faces.ts";
  import { knightLetter, type TurnUiState } from "../game/turnUi.ts";
  import { cardName } from "../i18n/fr/cards.ts";
  import { clavier } from "../i18n/fr/clavier.ts";
  import { game } from "../i18n/fr/game.ts";
  import KeyHint from "./KeyHint.svelte";
  import PawnTray from "./PawnTray.svelte";
  import StepChip from "./StepChip.svelte";

  type Building = Extract<TurnUiState, { kind: "sevenBuilding" }>;
  type Tray = Extract<TurnUiState, { kind: "tray" }>;

  type Props = {
    seven: Building;
    /** Knights too close to tell apart: their chips take the place of the step chips. */
    tray: Tray | null;
    /** A tap on the board missed every lit knight. */
    missed: boolean;
    onpickSteps: (steps: number) => void;
    onundo: () => void;
    oncancelAll: () => void;
    onconfirm: () => void;
    ontrayPick: (pawn: PawnId) => void;
    ontrayClose: () => void;
    /**
     * In the computer's bottom bar, in place of the hand and the action zone: never taller than the
     * bar. The title, « Reste n » and the plan on one line (the plan scrolls sideways), then the step
     * chips and the buttons side by side when the width allows, else on two rows.
     */
    bar?: boolean;
    /**
     * In the compact bar of a phone held sideways (plan 01-37), in place of the hand and the action
     * zone: never taller than --band. From 640 px wide one row: at the left a 20 px line (the title,
     * « Reste n », the prompt and the plan, scrolling sideways) over the step chips (scrolling
     * sideways when narrower than 332 px), the three buttons at the right. Below 640 px the line
     * over the plan in the 56 px row, the chips and the buttons in the 64 px row. Its tray takes the
     * chips' place.
     */
    band?: boolean;
  };

  let {
    seven,
    bar = false,
    band = false,
    tray,
    missed,
    onpickSteps,
    onundo,
    oncancelAll,
    onconfirm,
    ontrayPick,
    ontrayClose,
  }: Props = $props();

  const face = $derived(cardFace(seven.card));
  const done = $derived(seven.remaining === 0);

  // The colour is named only when the plan holds knights of two colours (the partner's, G12).
  const mixed = $derived(new Set(seven.plan.map((entry) => pawnColor(entry.pawn))).size > 1);
  const rows = $derived(
    seven.plan.map((entry) =>
      mixed
        ? game.seven.planColour(knightLetter(entry.pawn), pawnColor(entry.pawn), entry.steps)
        : game.seven.plan(knightLetter(entry.pawn), entry.steps),
    ),
  );

  /** The sentence above the plan: the last refusal, else what to do next. */
  const prompt = $derived.by((): string | null => {
    if (seven.notice === "stepRefused") return game.seven.chipDisabled;
    if (seven.notice === "pickKnight" || missed) return game.turn.chooseHorse;
    if (seven.selected !== undefined) return game.seven.chooseSteps;
    if (seven.plan.length === 0) return game.turn.chooseHorse;
    return done ? null : game.seven.remainingHint(seven.remaining);
  });

  const chips = $derived(Array.from({ length: seven.remaining }, (_, i) => i + 1));
  const offered = $derived(seven.selected === undefined ? [] : (seven.steps[seven.selected] ?? []));

  // The newest row is the one to see: the list scrolls down to it (sideways in the bar).
  let region = $state<HTMLElement | undefined>();
  $effect(() => {
    void rows.length;
    if (!region) return;
    region.scrollTop = region.scrollHeight;
    region.scrollLeft = region.scrollWidth;
  });
</script>

<!-- 7 splitter panel (UI-SPEC, D-17): it replaces the action zone and the hand fan. -->
<section
  class="panel"
  class:bar
  class:band
  class:traying={tray !== null}
  data-seven-panel data-selected={seven.selected ?? ""} aria-label={game.seven.title}>
  <!-- In the bar, one line: the title with « Reste n », then the prompt and the plan. -->
  <div class="top">
    <header class="head">
      <span class="mini" data-seven-card style:color={face.colour} role="img" aria-label={game.seven.card(cardName(seven.card))}>
        <span class="rank">{face.rankLabel}</span><span>{face.suitGlyph}</span>
      </span>
      <h2 class="title">{game.seven.title}</h2>
      <p class="counter t-display tabular" class:done data-remaining={seven.remaining} aria-live="polite">
        {done ? game.seven.allSpread : game.seven.remaining(seven.remaining)}
      </p>
    </header>

    {#if tray === null}
      <div class="region" bind:this={region} data-seven-region>
        {#if prompt !== null}
          <p class="prompt" data-seven-prompt role="status">{prompt}</p>
        {/if}
        {#if rows.length > 0}
          <ol class="rows" data-seven-rows>
            {#each rows as row, i (i)}
              <li data-seven-row>{row}</li>
            {/each}
          </ol>
        {/if}
      </div>
    {/if}
  </div>

  {#if tray !== null}
    <div class="tray">
      <PawnTray options={tray.options} {band} onpick={ontrayPick} onclose={ontrayClose} />
    </div>
  {:else}
    <!-- In the bar, the step chips and the buttons side by side, or on two rows. -->
    <div class="controls">
      <div class="chips" data-seven-chips>
        {#each chips as steps (steps)}
          <StepChip {steps} enabled={offered.includes(steps)} onpick={onpickSteps} />
        {/each}
      </div>

      <div class="buttons">
        <button
          type="button"
          class="btn btn-secondary undo"
          data-seven-undo
          disabled={seven.plan.length === 0}
          aria-label={game.seven.undo}
          aria-keyshortcuts="Backspace"
          onclick={onundo}
        >
          {game.seven.undo}
          <KeyHint label={clavier.keys.backspace} />
        </button>
        <button type="button" class="btn btn-secondary reset" data-seven-reset onclick={oncancelAll}>
          {game.seven.reset}
        </button>
        <button
          type="button"
          class="btn btn-primary play"
          data-seven-play
          disabled={!done}
          aria-label={game.seven.play}
          aria-keyshortcuts="Enter"
          onclick={onconfirm}
        >
          {game.seven.play}
          <KeyHint label={clavier.keys.enter} />
        </button>
      </div>
    </div>
  {/if}
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    min-height: 200px;
    padding: var(--space-xs) var(--space-md) 6px;
    box-sizing: border-box;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-height: 34px;
  }

  /* The played 7, as a small card chip: it has left the hand for the panel. */
  .mini {
    flex: none;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 32px;
    border-radius: 4px;
    background: var(--creme);
    font-size: var(--label-size);
    font-weight: 700;
    line-height: 1;
  }

  .rank {
    font-size: 16px;
  }

  .title {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    color: var(--creme);
    font-size: 16px;
    font-weight: 700;
    line-height: var(--heading-line);
  }

  .counter {
    flex: none;
    margin: 0;
    color: var(--ambre);
    text-align: right;
    white-space: nowrap;
  }

  /* « Tout est réparti. » is longer than « Reste n »: smaller, so the header keeps its one line. */
  .counter.done {
    font-size: 20px;
  }

  /* The prompt and the plan share one region: three lines, then it scrolls. */
  .region {
    flex: none;
    height: 52px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .prompt,
  .rows {
    margin: 0;
    color: var(--creme);
    font-size: var(--label-size);
    line-height: 1.3;
  }

  .prompt {
    color: var(--creme-attenuee);
  }

  .rows {
    padding: 0;
    list-style: none;
    font-weight: 700;
  }

  /* Seven chips of 44 are 332 wide: on a 320 px phone they wrap to a second row. */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    min-height: var(--touch);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  /* Long labels wrap inside their 48 px button; the row stacks when they do not fit side by side. */
  .buttons .btn {
    position: relative;
    flex: 1 1 76px;
    min-width: 0;
    padding: 0 var(--space-xs);
    font-size: var(--label-size);
    line-height: 1.2;
    text-align: center;
  }

  .buttons .undo {
    flex: 1.5 1 100px;
  }

  .buttons .play {
    flex-basis: 72px;
  }

  .tray {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
  }

  /* Outside the bar the two groups lay their children out in the panel's own column. */
  .top,
  .controls {
    display: contents;
  }

  /* The bottom bar (computers): at most --bar high, two or three rows. */
  .panel.bar {
    justify-content: center;
    gap: var(--space-sm);
    height: 100%;
    min-height: 0;
    max-height: var(--bar, 160px);
    padding: var(--space-xs) 0;
  }

  .bar .top {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    min-width: 0;
  }

  .bar .head {
    flex: none;
  }

  .bar .title {
    flex: none;
  }

  /* The prompt and the plan on one line that scrolls sideways. */
  .bar .region {
    flex: 1 1 0;
    display: flex;
    align-items: center;
    gap: var(--space-md);
    min-width: 0;
    height: auto;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
  }

  .bar .rows {
    display: flex;
    gap: var(--space-md);
  }

  .bar .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm) var(--space-md);
  }

  .bar .chips {
    flex: none;
    flex-wrap: nowrap;
  }

  .bar .buttons {
    flex: none;
    flex-wrap: nowrap;
    margin-left: auto;
  }

  .bar .buttons .btn {
    flex: none;
    padding: 0 var(--space-md);
  }

  /*
   * The compact bar (a phone held sideways). One row of --band-row from 640 px wide: a grid whose
   * left column holds the 20 px line over the 44 px chips, and whose right column holds the three
   * buttons. The tray needs its 56 px chips: it takes the whole row and the line steps aside.
   */
  .panel.band {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: 20px var(--touch);
    align-content: center;
    gap: 0 var(--space-sm);
    height: 100%;
    min-height: 0;
    max-height: var(--band, 64px);
    padding: 0;
    overflow: hidden;
  }

  .band .top {
    grid-column: 1;
    grid-row: 1;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
    height: 20px;
  }

  .band .head {
    flex: none;
    min-height: 0;
    gap: var(--space-xs);
  }

  .band .mini {
    display: none;
  }

  .band .title,
  .band .counter {
    flex: none;
    font-size: var(--label-size);
    line-height: 20px;
  }

  .band .region {
    flex: 1 1 0;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
    height: 20px;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
  }

  .band .prompt,
  .band .rows {
    line-height: 20px;
  }

  .band .rows {
    display: flex;
    gap: var(--space-sm);
  }

  .band .controls {
    display: contents;
  }

  .band .chips {
    grid-column: 1;
    grid-row: 2;
    flex-wrap: nowrap;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .band .chips > :global(*) {
    flex: none;
  }

  .band .buttons {
    grid-column: 2;
    grid-row: 1 / -1;
    flex-wrap: nowrap;
    align-self: center;
  }

  /* Label 14 bold on two lines at most, 48 px high. */
  .band .buttons .btn {
    flex: none;
    width: 88px;
    padding: 0 var(--space-xs);
  }

  .band .buttons .undo {
    width: 96px;
  }

  .band .buttons .play {
    width: 72px;
  }

  .band.traying .top {
    display: none;
  }

  .band .tray {
    grid-column: 1 / -1;
    grid-row: 1 / -1;
    min-width: 0;
  }

  /* Below 640 px wide: the line and the plan in the 56 px row, the chips and the buttons in the
     64 px row under it; the tray takes the 64 px row. */
  @media (max-width: 639.98px) {
    .panel.band {
      grid-template-rows: 56px var(--band-row, 64px);
      align-content: stretch;
    }

    .band .top {
      grid-column: 1 / -1;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: var(--space-xs);
      height: auto;
    }

    .band .region {
      flex: none;
    }

    .band .chips {
      align-self: center;
    }

    .band .buttons {
      grid-row: 2;
    }

    .band.traying .top {
      display: flex;
    }

    .band .tray {
      grid-row: 2;
    }
  }

  @media (min-width: 360px) {
    .mini {
      display: flex;
    }

    .title {
      font-size: 18px;
    }

    .buttons .btn {
      padding: 0 var(--space-sm);
    }
  }
</style>
