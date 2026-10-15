<script lang="ts">
  type Props = {
    /** Centre of the card in board units (the card is drawn inside the board's SVG). */
    x: number;
    y: number;
    /** Size in board units: 160 x 224 on the felt. */
    w?: number;
    h?: number;
    /** Tilt in degrees, fixed per card by the felt. */
    tilt?: number;
    /** Board units per screen pixel, so the inner border stays 2 screen pixels wide. */
    px?: number;
    /** Without the knight and its filter: for the cards in flight, which move many at a time. */
    plain?: boolean;
  };

  let { x, y, w = 160, h = 224, tilt = 0, px = 3, plain = false }: Props = $props();

  const WALNUT = "#2B1D12";
  const OAK = "#D8C6B0";
  const BORDER = "#A46F2A";
  const inset = $derived(Math.max(8, w * 0.07));
  // The knight stands in the middle, 40 % of the card width, in the proportions of its sprite.
  const knightW = $derived(w * 0.44);
  const knightH = $derived((knightW * 190) / 110);
</script>

<!-- Card back (UI-SPEC): oak surface, a 2 px #A46F2A inner border and a walnut knight silhouette taken
     from the knight sprite of KnightDefs (the sprite's alpha, painted walnut). -->
<g transform={`translate(${x} ${y}) rotate(${tilt})`} data-card-back>
  {#if !plain}
    <defs>
      <filter id="card-back-walnut" x="0" y="0" width="100%" height="100%">
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.169  0 0 0 0 0.114  0 0 0 0 0.071  0 0 0 1 0"
        />
      </filter>
    </defs>
  {/if}
  <rect
    x={-w / 2}
    y={-h / 2}
    width={w}
    height={h}
    rx={w * 0.075}
    fill={OAK}
    stroke={WALNUT}
    stroke-opacity="0.45"
    stroke-width={px}
  />
  <rect
    x={-w / 2 + inset}
    y={-h / 2 + inset}
    width={w - 2 * inset}
    height={h - 2 * inset}
    rx={w * 0.04}
    fill="none"
    stroke={BORDER}
    stroke-width={2 * px}
  />
  {#if !plain}
    <use
      href="#knight-bleu"
      x={-knightW / 2}
      y={-knightH / 2}
      width={knightW}
      height={knightH}
      filter="url(#card-back-walnut)"
    />
  {/if}
</g>
