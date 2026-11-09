<script lang="ts">
  import type { HistoryGame } from "@toc/protocol";
  import { gameKey, rowOf } from "../results/format.ts";
  import Icon from "./Icon.svelte";

  // One game of « Mes résultats » (plan 05-01; 05-UI-SPEC Panel 1 « Historique »): a button of 64
  // that opens its detail sheet (plan 05-09), the kind's icon (users online, bot solo), line 1 « Victoire · 8 – 5 »
  // (knights home, own team first), line 2 the partner and the opponents (ellipsis, the whole line in
  // its title), at the right the end date and time. Its accessible name is the whole sentence
  // (results/format.ts). Text bindings only. Its hook is the game's key, never an account id.
  type Props = {
    game: HistoryGame;
    now: number;
    onopen?: (game: HistoryGame, button: HTMLButtonElement) => void;
  };

  let { game, now, onopen }: Props = $props();

  const text = $derived(rowOf(game, now));
</script>

<button
  type="button"
  class="row"
  data-game-row={gameKey(game)}
  aria-label={text.label}
  aria-haspopup="dialog"
  onclick={(event) => onopen?.(game, event.currentTarget)}
>
  <span class="icon"><Icon name={text.icon} size={20} /></span>
  <span class="lines">
    <span class="first" data-row-line="1">{text.line1}</span>
    <span class="second" data-row-line="2" title={text.line2}>{text.line2}</span>
  </span>
  <span class="when">
    <span>{text.date}</span>
    <span>{text.time}</span>
  </span>
</button>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    box-sizing: border-box;
    width: 100%;
    height: 64px;
    padding: var(--space-sm) 12px;
    border: 0;
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .icon {
    flex: none;
    display: flex;
  }

  .lines {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .first,
  .second {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .first {
    font-size: var(--body-size);
    font-weight: 700;
    line-height: 24px;
    font-variant-numeric: tabular-nums;
  }

  .second,
  .when {
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: 20px;
  }

  .when {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
