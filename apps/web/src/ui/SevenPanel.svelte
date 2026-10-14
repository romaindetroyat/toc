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
  };

  let {
    seven,
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

  // The newest row is the one to see: the list scrolls down to it.
  let region = $state<HTMLElement | undefined>();
  $effect(() => {
    void rows.length;
    if (region) region.scrollTop = region.scrollHeight;
  });
</script>

<!-- 7 splitter panel (UI-SPEC, D-17): it replaces the action zone and the hand fan. -->
<section class="panel" data-seven-panel data-selected={seven.selected ?? ""} aria-label={game.seven.title}>
  <header class="head">
    <span class="mini" data-seven-card style:color={face.colour} role="img" aria-label={game.seven.card(cardName(seven.card))}>
      <span class="rank">{face.rankLabel}</span><span>{face.suitGlyph}</span>
    </span>
    <h2 class="title">{game.seven.title}</h2>
    <p class="counter t-display tabular" class:done data-remaining={seven.remaining} aria-live="polite">
      {done ? game.seven.allSpread : game.seven.remaining(seven.remaining)}
    </p>
  </header>

  {#if tray !== null}
    <div class="tray">
      <PawnTray options={tray.options} onpick={ontrayPick} onclose={ontrayClose} />
    </div>
  {:else}
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
