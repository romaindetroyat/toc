<script lang="ts">
  import {
    CARD_SIZE,
    DEFAUSSE,
    FELT_SQUARE,
    LAST_CARD_SLOT,
    type Point,
    rotatePoint,
    TALON,
  } from "@toc/board";
  import { COLORS, type Color, ENTRY, EXIT, type PawnIndex } from "@toc/engine";
  import { anchorOf } from "./geometry.ts";

  // Same k as Board.svelte: every point is drawn at its rotated screen anchor.
  let { k = 0 }: { k?: number } = $props();

  // Debug-only overlay (plan 01-02): every calibrated cell and felt slot, drawn over the art.
  // Sizes are in screen pixels through --px (board units per screen pixel, set by Board.svelte).
  const FILL: Record<Color, string> = {
    bleu: "#0100d6",
    jaune: "#ffff00",
    rouge: "#d40100",
    vert: "#019c01",
  };

  const SLOTS = [0, 1, 2, 3] as const satisfies readonly PawnIndex[];
  const RING = Array.from({ length: 72 }, (_, cell) => cell);

  const slots = $derived(
    COLORS.map((color) => ({
      color,
      stable: SLOTS.map((slot) => anchorOf({ z: "stable", color, slot }, k)),
      home: SLOTS.map((slot) => anchorOf({ z: "home", color, slot }, k)),
      diamond: anchorOf({ z: "ring", cell: EXIT[color] }, k),
      square: anchorOf({ z: "ring", cell: ENTRY[color] }, k),
      card: rotatePoint(LAST_CARD_SLOT[color], k),
    })),
  );
  const ring = $derived(RING.map((cell) => anchorOf({ z: "ring", cell }, k)));
  const talon: Point = $derived(rotatePoint(TALON, k));
  const defausse: Point = $derived(rotatePoint(DEFAUSSE, k));
</script>

<g data-debug-geometry class="debug">
  <rect
    class="felt"
    x={FELT_SQUARE.min}
    y={FELT_SQUARE.min}
    width={FELT_SQUARE.max - FELT_SQUARE.min}
    height={FELT_SQUARE.max - FELT_SQUARE.min}
  />

  {#each ring as [x, y], i (i)}
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
    x={talon[0] - CARD_SIZE.w / 2}
    y={talon[1] - CARD_SIZE.h / 2}
    width={CARD_SIZE.w}
    height={CARD_SIZE.h}
  />
  <text class="label slot" x={talon[0]} y={talon[1]}>talon</text>
  <rect
    class="card"
    x={defausse[0] - CARD_SIZE.w / 2}
    y={defausse[1] - CARD_SIZE.h / 2}
    width={CARD_SIZE.w}
    height={CARD_SIZE.h}
  />
  <text class="label slot" x={defausse[0]} y={defausse[1]}>défausse</text>
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
