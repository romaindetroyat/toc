<script lang="ts">
  import { CARD_SIZE, DEFAUSSE, FELT_SQUARE, LAST_CARD_SLOT, LAYOUT, TALON } from "@toc/board";
  import { COLORS, type Color } from "@toc/engine";

  // Debug-only overlay (plan 01-02): every calibrated cell and felt slot, drawn over the art.
  // Sizes are in screen pixels through --px (board units per screen pixel, set by Board.svelte).
  const FILL: Record<Color, string> = {
    bleu: "#0100d6",
    jaune: "#ffff00",
    rouge: "#d40100",
    vert: "#019c01",
  };

  const slots = COLORS.map((color) => ({
    color,
    stable: LAYOUT.pieces[color].stable,
    home: LAYOUT.pieces[color].home,
    diamond: LAYOUT.pieces[color].diamond,
    square: LAYOUT.pieces[color].square,
    card: LAST_CARD_SLOT[color],
  }));
</script>

<g data-debug-geometry class="debug">
  <rect
    class="felt"
    x={FELT_SQUARE.min}
    y={FELT_SQUARE.min}
    width={FELT_SQUARE.max - FELT_SQUARE.min}
    height={FELT_SQUARE.max - FELT_SQUARE.min}
  />

  {#each LAYOUT.ring as [x, y], i (i)}
    <circle class="ring-dot" cx={x} cy={y} />
    <text class="label" {x} {y} data-ring={i}>{i}</text>
  {/each}

  {#each slots as s (s.color)}
    <rect
      class="card"
      x={s.card[0] - CARD_SIZE.w / 2}
      y={s.card[1] - CARD_SIZE.h / 2}
      width={CARD_SIZE.w}
      height={CARD_SIZE.h}
      stroke={FILL[s.color]}
    />
    <text class="label slot" x={s.card[0]} y={s.card[1]}>{s.color}</text>
    <circle class="mark" cx={s.diamond[0]} cy={s.diamond[1]} stroke={FILL[s.color]} />
    <circle class="mark" cx={s.square[0]} cy={s.square[1]} stroke={FILL[s.color]} />
    {#each s.stable as [x, y], j (j)}
      <circle class="slot-dot" cx={x} cy={y} fill={FILL[s.color]} />
      <text class="label slot" {x} {y} data-stable={`${s.color}${j}`}>E{j}</text>
    {/each}
    {#each s.home as [x, y], j (j)}
      <circle class="slot-dot" cx={x} cy={y} fill={FILL[s.color]} />
      <text class="label slot" {x} {y} data-home={`${s.color}${j}`}>M{j}</text>
    {/each}
  {/each}

  <rect
    class="card"
    x={TALON[0] - CARD_SIZE.w / 2}
    y={TALON[1] - CARD_SIZE.h / 2}
    width={CARD_SIZE.w}
    height={CARD_SIZE.h}
  />
  <text class="label slot" x={TALON[0]} y={TALON[1]}>talon</text>
  <rect
    class="card"
    x={DEFAUSSE[0] - CARD_SIZE.w / 2}
    y={DEFAUSSE[1] - CARD_SIZE.h / 2}
    width={CARD_SIZE.w}
    height={CARD_SIZE.h}
  />
  <text class="label slot" x={DEFAUSSE[0]} y={DEFAUSSE[1]}>défausse</text>
</g>

<style>
  .debug {
    pointer-events: none;
  }

  .felt {
    fill: none;
    stroke: #ff00ff;
    stroke-width: calc(2px * var(--px));
  }

  .card {
    fill: none;
    stroke: #ff00ff;
    stroke-width: calc(2px * var(--px));
  }

  .ring-dot {
    r: calc(11px * var(--px));
    fill: #ffffff;
    fill-opacity: 0.75;
    stroke: #000000;
    stroke-width: calc(1px * var(--px));
  }

  .slot-dot {
    r: calc(11px * var(--px));
    fill-opacity: 0.8;
    stroke: #000000;
    stroke-width: calc(1px * var(--px));
  }

  .mark {
    r: calc(18px * var(--px));
    fill: none;
    stroke-width: calc(3px * var(--px));
  }

  .label {
    font: 700 calc(14px * var(--px)) system-ui, sans-serif;
    fill: #000000;
    stroke: #ffffff;
    stroke-width: calc(2px * var(--px));
    paint-order: stroke;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .slot {
    fill: #7a0070;
  }
</style>
