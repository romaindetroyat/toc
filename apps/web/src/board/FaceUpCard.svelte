<script lang="ts">
  import { SCENE } from "@toc/board";
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
    /** The quarter turn that faces the card to its seat (0, 90, 180 or 270), added to the tilt. */
    angle?: number;
    /** Board units per screen pixel, so the outline stays 1 screen pixel wide. */
    px: number;
    /** Marks the card as lying on the felt (a card in flight is not part of the felt). */
    felt?: boolean;
    /** A fraction of the galet's card: 1 on a seat's place, SCENE.pile on the défausse. */
    scale?: number;
  };

  let { card, x = 0, y = 0, tilt = 0, angle = 0, px, felt = true, scale = 1 }: Props = $props();

  const WALNUT = "#2B1D12";
  const CW = $derived(SCENE.card.w * scale);
  const CH = $derived(SCENE.card.h * scale);
  /** The face was drawn for a 160-unit card: its corners, pip and offsets scale with the galet card. */
  const U = $derived(CW / 160);
  const face = $derived(cardFace(card));
</script>

{#snippet corner()}
  <text
    class="corner"
    x={-CW / 2 + 12 * U}
    y={-CH / 2 + 46 * U}
    font-size={44 * U}
    fill={face.colour}
  >
    {face.rankLabel}
  </text>
  <text
    class="corner"
    x={-CW / 2 + 12 * U}
    y={-CH / 2 + 86 * U}
    font-size={38 * U}
    fill={face.colour}
  >
    {face.suitGlyph}
  </text>
{/snippet}

<!-- A card lying face up on the galet's felt, facing its seat (angle) and tilted a few degrees (D-08). -->
<g transform={`translate(${x} ${y}) rotate(${angle + tilt})`} data-felt-card={felt ? card : undefined}>
  <title>{cardName(card)}</title>
  <rect
    x={-CW / 2}
    y={-CH / 2}
    width={CW}
    height={CH}
    rx={12 * U}
    fill="#FFFDF6"
    stroke={WALNUT}
    stroke-opacity="0.45"
    stroke-width={px}
  />
  {@render corner()}
  <text
    class="corner"
    x="0"
    y={34 * U}
    font-size={92 * U}
    text-anchor="middle"
    fill={face.colour}
  >
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
