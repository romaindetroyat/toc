<script lang="ts">
  import { CARD_SIZE } from "@toc/board";
  import type { CardId } from "@toc/engine";
  import { cardFace } from "../cards/faces.ts";
  import { cardName } from "../i18n/fr/cards.ts";

  type Props = {
    card: CardId;
    /** Centre of the card in board units. */
    x?: number;
    y?: number;
    /** Tilt in degrees. */
    tilt?: number;
    /** Board units per screen pixel, so the outline stays 1 screen pixel wide. */
    px: number;
    /** Marks the card as lying on the felt (a card in flight is not part of the felt). */
    felt?: boolean;
  };

  let { card, x = 0, y = 0, tilt = 0, px, felt = true }: Props = $props();

  const WALNUT = "#2B1D12";
  const { w: CW, h: CH } = CARD_SIZE;
  const face = $derived(cardFace(card));
</script>

{#snippet corner()}
  <text class="corner" x={-CW / 2 + 12} y={-CH / 2 + 46} font-size="44" fill={face.colour}>
    {face.rankLabel}
  </text>
  <text class="corner" x={-CW / 2 + 12} y={-CH / 2 + 86} font-size="38" fill={face.colour}>
    {face.suitGlyph}
  </text>
{/snippet}

<!-- A card lying face up, upright on the screen, tilted a few degrees (D-08). -->
<g transform={`translate(${x} ${y}) rotate(${tilt})`} data-felt-card={felt ? card : undefined}>
  <title>{cardName(card)}</title>
  <rect
    x={-CW / 2}
    y={-CH / 2}
    width={CW}
    height={CH}
    rx="12"
    fill="#FFFDF6"
    stroke={WALNUT}
    stroke-opacity="0.45"
    stroke-width={px}
  />
  {@render corner()}
  <text class="corner" x="0" y="34" font-size="92" text-anchor="middle" fill={face.colour}>
    {face.suitGlyph}
  </text>
  <g transform="rotate(180)">{@render corner()}</g>
</g>

<style>
  .corner {
    font-family: var(--font-ui);
    font-weight: 700;
    user-select: none;
  }
</style>
