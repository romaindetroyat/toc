<script lang="ts">
  import type { Color } from "@toc/engine";
  import { launch } from "../i18n/fr/launch.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import SeatChip from "./SeatChip.svelte";

  type Props = {
    color: Color;
    selected: boolean;
    /** This colour is the partner of the selected one. */
    partner?: boolean;
    /** Roving tabindex: 0 on the selected tile, -1 on the others. */
    tabindex: 0 | -1;
    el?: HTMLButtonElement;
    onselect: () => void;
    onkeydown?: (event: KeyboardEvent) => void;
  };

  let {
    color,
    selected,
    partner = false,
    tabindex,
    el = $bindable(),
    onselect,
    onkeydown,
  }: Props = $props();

  const tagId = $derived(`tile-tag-${color}`);
</script>

<!-- One radio of the colour choice. Oak surface, the knight of that colour in a 64 px slot (a disc
     in the pawn body colour until plan 01-08 draws the knight there), the seat chip. -->
<button
  bind:this={el}
  type="button"
  role="radio"
  class="tile"
  class:selected
  class:partner
  aria-checked={selected}
  aria-label={seats[color].name}
  aria-describedby={partner ? tagId : undefined}
  {tabindex}
  data-color={color}
  onclick={onselect}
  {onkeydown}
>
  <span class="visual" aria-hidden="true">
    <span class="disc"></span>
  </span>
  <SeatChip {color} />
  {#if partner}
    <span class="tag" id={tagId}>{launch.partner}</span>
  {/if}
</button>

<style>
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 128px;
    min-height: 128px;
    padding: 16px 8px;
    border: 3px solid transparent;
    border-radius: 12px;
    /* Light oak with a faint horizontal grain, drawn in CSS (the board art stays untouched). */
    background:
      repeating-linear-gradient(
        180deg,
        rgb(74 47 26 / 0.07) 0,
        rgb(74 47 26 / 0.07) 1px,
        transparent 1px,
        transparent 5px
      ),
      linear-gradient(180deg, #dfcfba 0%, #d8c6b0 55%, #cfbba3 100%);
    color: #2b1d12;
    font: inherit;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .tile.selected {
    border-color: var(--ambre);
  }

  .tile.partner {
    outline: 3px dashed var(--creme);
    outline-offset: 2px;
  }

  .tile:hover:not(.selected) {
    filter: brightness(1.05);
  }

  .visual {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
  }

  .disc {
    width: 48px;
    height: 48px;
    border: 3px solid #2b1d12;
    border-radius: 50%;
    background: var(--tile-pawn);
  }

  .tile[data-color="bleu"] {
    --tile-pawn: var(--pawn-bleu);
  }
  .tile[data-color="jaune"] {
    --tile-pawn: var(--pawn-jaune);
  }
  .tile[data-color="rouge"] {
    --tile-pawn: var(--pawn-rouge);
  }
  .tile[data-color="vert"] {
    --tile-pawn: var(--pawn-vert);
  }

  .tag {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 0 8px;
    border-radius: 999px;
    background: #2b1d12;
    color: var(--creme);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.4;
  }
</style>
