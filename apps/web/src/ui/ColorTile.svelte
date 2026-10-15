<script lang="ts">
  import type { Color } from "@toc/engine";
  import { launch } from "../i18n/fr/launch.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import Icon from "./Icon.svelte";
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
    /**
     * The compact launch layouts (03-UI-SPEC « compact tiles »): 88 high, as wide as its grid cell
     * (96 in the 2 x 2, a quarter of the column in one row), a 40 px knight, the « Partenaire » tag
     * visually hidden but kept as the tile's description; the dashed partner outline stays.
     */
    compact?: boolean;
  };

  let {
    color,
    selected,
    partner = false,
    tabindex,
    el = $bindable(),
    onselect,
    onkeydown,
    compact = false,
  }: Props = $props();

  const tagId = $derived(`tile-tag-${color}`);
</script>

<!-- One radio of the colour choice. Oak surface, the knight of that colour in a 64 px slot (the
     symbol from KnightDefs, mounted once in App.svelte), the seat chip. -->
<button
  bind:this={el}
  type="button"
  role="radio"
  class="tile"
  class:selected
  class:partner
  class:compact
  aria-checked={selected}
  aria-label={seats[color].name}
  aria-describedby={partner ? tagId : undefined}
  {tabindex}
  data-color={color}
  onclick={onselect}
  {onkeydown}
>
  <span class="visual" aria-hidden="true">
    <svg
      viewBox="0 0 110 190"
      width={compact ? 23 : 37}
      height={compact ? 40 : 64}
      focusable="false"
    >
      <use href={`#knight-${color}`} />
    </svg>
  </span>
  <SeatChip {color} />
  {#if selected}
    <span class="check" aria-hidden="true"><Icon name="check" size={16} /></span>
  {/if}
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
    padding: 28px 8px 16px;
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

  .check {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #2b1d12;
    color: var(--creme);
  }

  /* Compact: 8 from the outer edge (3 of border, 5 of padding), knight 40, 4, chip 28 = 88. */
  .tile.compact {
    width: 100%;
    min-width: var(--touch);
    height: 88px;
    min-height: 0;
    gap: var(--space-xs);
    padding: 5px;
  }

  .compact .visual {
    width: 40px;
    height: 40px;
  }

  .compact .check {
    top: var(--space-xs);
    right: var(--space-xs);
  }

  /* The tag's text stays the tile's accessible description (aria-describedby), out of sight. */
  .compact .tag {
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
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
