<script lang="ts">
  import type { Color } from "@toc/engine";
  import { seats } from "../i18n/fr/seats.ts";

  type Props = {
    color: Color;
    /** Name next to the glyph; hidden chips keep the glyph and expose the name to screen readers. */
    showName?: boolean;
    /** A 20 px chip for the info bar, where two rows share 56 px. */
    small?: boolean;
  };

  let { color, showName = true, small = false }: Props = $props();

  const seat = $derived(seats[color]);
</script>

<!-- Seat chip (UI-SPEC): cream pill, 16 px glyph filled with the seat colour and a 2 px walnut
     stroke, name in walnut. Colour is never the only identifier: the glyph and the name carry it. -->
<span class="chip" class:small data-seat={color}>
  <svg class="glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    {#if color === "bleu"}
      <circle cx="8" cy="8" r="6" />
    {:else if color === "jaune"}
      <path d="M8 2 L14.5 13.5 L1.5 13.5 Z" />
    {:else if color === "rouge"}
      <rect x="2.5" y="2.5" width="11" height="11" />
    {:else}
      <path d="M8 1.5 L9.9 5.8 L14.5 6.2 L11 9.3 L12.1 13.9 L8 11.5 L3.9 13.9 L5 9.3 L1.5 6.2 L6.1 5.8 Z" />
    {/if}
  </svg>
  {#if showName}
    <span class="name">{seat.name}</span>
  {:else}
    <span class="sr-only">{seat.name}</span>
  {/if}
</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 8px;
    border-radius: 999px;
    background: #fff8e1;
    color: #2b1d12;
    white-space: nowrap;
  }

  .chip.small {
    height: 20px;
    padding: 0 4px;
  }

  .glyph {
    flex: none;
    fill: var(--chip-seat);
    stroke: #2b1d12;
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .chip[data-seat="bleu"] {
    --chip-seat: var(--seat-bleu);
  }
  .chip[data-seat="jaune"] {
    --chip-seat: var(--seat-jaune);
  }
  .chip[data-seat="rouge"] {
    --chip-seat: var(--seat-rouge);
  }
  .chip[data-seat="vert"] {
    --chip-seat: var(--seat-vert);
  }

  .name {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.4;
  }
</style>
