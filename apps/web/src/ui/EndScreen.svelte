<script lang="ts">
  import { COLORS, type Team, teamOf } from "@toc/engine";
  import { onMount } from "svelte";
  import type { GameStats } from "../game/GameController.ts";
  import { game } from "../i18n/fr/game.ts";
  import SeatChip from "./SeatChip.svelte";

  type Props = {
    /** Whether the human's team won. */
    won: boolean;
    /** The team that brought its eight knights home. */
    winner: Team;
    /** The deals played and the knights eaten, read once when the game ends. */
    stats: () => GameStats;
    /** « Rejouer »: a new game with the same colour. */
    onreplay: () => void;
    /** « Changer de couleur »: back to the launch screen. */
    onchange: () => void;
  };

  let { won, winner, stats, onreplay, onchange }: Props = $props();

  const result = $derived(stats());
  const winners = COLORS.filter((color) => teamOf(color) === winner);

  let replay = $state<HTMLButtonElement>();
  let change = $state<HTMLButtonElement>();
  let panel = $state<HTMLElement>();

  // Focus lands on « Rejouer » (UI-SPEC), inside the panel.
  onMount(() => replay?.focus());

  // The game screen behind is inert while the panel is up (Game.svelte); anything else that could still
  // take the focus (the toast) gives it back to the panel, as Sheet does.
  function onWindowFocusin(event: FocusEvent) {
    if (panel && event.target instanceof Node && !panel.contains(event.target)) replay?.focus();
  }

  /** Tab stays on the panel: the board behind it is dimmed and not playable. */
  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    (document.activeElement === replay ? change : replay)?.focus();
  }
</script>

<svelte:window onfocusin={onWindowFocusin} />

<!-- End of game (UI-SPEC): the board stays visible behind walnut at 70 %, with a centred panel. -->
<div class="scrim" data-end-screen data-result={won ? "win" : "loss"}>
  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="end-title"
    tabindex="-1"
    bind:this={panel}
    {onkeydown}
  >
    <h2 id="end-title" class="title">{won ? game.end.win : game.end.loss}</h2>
    <div class="chips">
      {#each winners as color (color)}
        <SeatChip {color} />
      {/each}
    </div>
    <p class="sentence">{won ? game.end.winText : game.end.lossText}</p>
    <div class="stats">
      <p data-stat="deals">{game.end.deals(result.dealsPlayed)}</p>
      <p data-stat="captures">{game.end.captures(result.captured.nous, result.captured.eux)}</p>
    </div>
    <div class="buttons">
      <button type="button" class="btn btn-primary" bind:this={replay} onclick={onreplay}>
        {game.end.replay}
      </button>
      <button type="button" class="btn btn-secondary" bind:this={change} onclick={onchange}>
        {game.end.changeColour}
      </button>
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: var(--space-md);
    background: rgb(43 29 18 / 0.7);
    overflow-y: auto;
  }

  .panel {
    width: min(100%, 400px);
    padding: var(--space-lg);
    border-radius: var(--radius-sheet);
    background: var(--bois-sombre);
    color: var(--creme);
    text-align: center;
  }

  .panel p {
    margin: 0;
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--display-size);
    font-weight: 700;
    line-height: var(--display-line);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-sm);
    margin-top: var(--space-md);
  }

  .sentence {
    margin-top: var(--space-md);
    font-size: var(--body-size);
    line-height: var(--body-line);
  }

  .stats {
    margin-top: var(--space-md);
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .buttons {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-top: var(--space-lg);
  }
</style>
