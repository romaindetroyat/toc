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
     * The compact mode of a phone held sideways (plan 01-47): the short labels of the buttons (their
     * accessible names and their titles keep the full ones).
     */
    compact?: boolean;
    /**
     * What this instance draws. « all » (the computer's bar): the whole assistant. In the compact
     * mode, each part in its place beside the full-height galet: « line », the prompt row (« Reste n »,
     * then the plan or the instruction, one line); « chips », the selected knight's step chips in a
     * column of the left strip (the tray's chips while it is open); « buttons », « Retour »,
     * « Effacer » and « Jouer » stacked at the bottom of the right strip (« Autre cheval » while the
     * tray is open). The game screen wraps the three parts in the [data-seven-panel] region.
     */
    part?: "all" | "line" | "chips" | "buttons";
  };

  let {
    seven,
    bar = false,
    compact = false,
    part = "all",
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

  /** The prompt row's one line: « Reste n », then the instruction and the plan (or the tray's question). */
  const counterText = $derived(done ? game.seven.allSpread : game.seven.remaining(seven.remaining));
  const lineText = $derived(
    [counterText, ...(tray !== null ? [game.tray.question] : [...(prompt === null ? [] : [prompt]), ...rows])].join(
      " · ",
    ),
  );

  // The newest row is the one to see: the list scrolls down to it (sideways in the bar).
  let region = $state<HTMLElement | undefined>();
  $effect(() => {
    void rows.length;
    if (!region) return;
    region.scrollTop = region.scrollHeight;
    region.scrollLeft = region.scrollWidth;
  });
</script>

{#snippet undoButton()}
  <button
    type="button"
    class="btn btn-secondary undo"
    data-seven-undo
    disabled={seven.plan.length === 0}
    aria-label={game.seven.undo}
    aria-keyshortcuts="Backspace"
    title={compact ? game.seven.undo : undefined}
    onclick={onundo}
  >
    {compact ? game.compact.undo : game.seven.undo}
    <KeyHint label={clavier.keys.backspace} />
  </button>
{/snippet}

{#snippet resetButton()}
  <button
    type="button"
    class="btn btn-secondary reset"
    data-seven-reset
    aria-label={compact ? game.seven.reset : undefined}
    title={compact ? game.seven.reset : undefined}
    onclick={oncancelAll}
  >
    {compact ? game.compact.reset : game.seven.reset}
  </button>
{/snippet}

{#snippet playButton()}
  <button
    type="button"
    class="btn btn-primary play"
    data-seven-play
    disabled={!done}
    aria-label={game.seven.play}
    aria-keyshortcuts="Enter"
    title={compact ? game.seven.play : undefined}
    onclick={onconfirm}
  >
    {game.seven.play}
    <KeyHint label={clavier.keys.enter} />
  </button>
{/snippet}

{#snippet stepChips()}
  {#each chips as steps (steps)}
    <StepChip {steps} enabled={offered.includes(steps)} onpick={onpickSteps} />
  {/each}
{/snippet}

{#if part === "line"}
  <!-- The compact prompt row: « Reste n » in amber, then the instruction and the plan, one line. -->
  <div class="line-part" data-seven-line title={lineText}>
    <span class="line-text">
      <span
        class="counter-inline tabular"
        class:done
        data-remaining={seven.remaining}
        aria-live="polite">{counterText}</span
      >
      {#if tray !== null}
        <span class="line-prompt" role="status">{game.tray.question}</span>
      {:else}
        {#if prompt !== null}
          <span class="line-prompt" data-seven-prompt role="status">{prompt}</span>
        {/if}
        {#if rows.length > 0}
          <ol class="line-rows" data-seven-rows>
            {#each rows as row, i (i)}
              <li data-seven-row>{row}</li>
            {/each}
          </ol>
        {/if}
      {/if}
    </span>
  </div>
{:else if part === "chips"}
  <!-- The compact left strip: the step chips in a column (the tray's chips while it is open). -->
  {#if tray !== null}
    <PawnTray options={tray.options} part="chips" compact onpick={ontrayPick} onclose={ontrayClose} />
  {:else}
    <div class="chip-column" data-seven-chips>
      {@render stepChips()}
    </div>
  {/if}
{:else if part === "buttons"}
  <!-- The compact right strip: the three buttons stacked, « Jouer » lowest. -->
  {#if tray !== null}
    <PawnTray options={tray.options} part="close" compact onpick={ontrayPick} onclose={ontrayClose} />
  {:else}
    <div class="button-column" data-seven-buttons>
      {@render undoButton()}
      {@render resetButton()}
      {@render playButton()}
    </div>
  {/if}
{:else}
  <!-- 7 splitter panel (UI-SPEC, D-17): it replaces the action zone and the hand fan. -->
  <section
    class="panel"
    class:bar
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
          {counterText}
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
        <PawnTray options={tray.options} onpick={ontrayPick} onclose={ontrayClose} />
      </div>
    {:else}
      <!-- In the bar, the step chips and the buttons side by side, or on two rows. -->
      <div class="controls">
        <div class="chips" data-seven-chips>
          {@render stepChips()}
        </div>

        <div class="buttons">
          {@render undoButton()}
          {@render resetButton()}
          {@render playButton()}
        </div>
      </div>
    {/if}
  </section>
{/if}

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

  /* The compact mode's prompt row (plan 01-47): one line of Label 14, « Reste n » in amber, a
     longer text ending with « … » (its full text in the title). */
  .line-part {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-width: 0;
    padding: 0 var(--space-xs);
  }

  .line-text {
    min-width: 0;
    overflow: hidden;
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: var(--label-line);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .counter-inline {
    color: var(--ambre);
    font-weight: 700;
  }

  .line-prompt,
  .line-rows,
  .line-rows li {
    display: inline;
  }

  .line-prompt::before,
  .line-rows li::before {
    content: " · ";
    color: var(--creme-attenuee);
  }

  .line-rows {
    margin: 0;
    padding: 0;
    color: var(--creme);
    font-weight: 700;
    list-style: none;
  }

  /* The compact left strip: 44 x 44 chips, 4 px apart, in a column (the strip's slot scrolls). */
  .chip-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }

  .chip-column > :global(*) {
    flex: none;
  }

  /* The compact right strip: the buttons stacked 4 px apart (12 px with a computer's key badges),
     each --strip-button wide, at least 48 px high, two lines at most. */
  .button-column {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: var(--space-xs);
  }

  .button-column .btn {
    position: relative;
    width: var(--strip-button, 58px);
    min-width: 0;
    min-height: var(--button-height);
    padding: 2px 0;
    font-size: var(--label-size);
    letter-spacing: -0.01em;
    line-height: 1.2;
    text-align: center;
  }

  .button-column :global(.key-hint.corner) {
    right: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    .button-column {
      gap: 12px;
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
