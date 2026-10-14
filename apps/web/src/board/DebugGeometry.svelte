<script lang="ts">
  import { SCENE, seatCard } from "@toc/board";
  import { COLORS, type Color, ENTRY, EXIT, type PawnIndex } from "@toc/engine";
  import { anchorOf } from "./geometry.ts";

  // Same k as Board.svelte: every point is drawn at its galet scene anchor for that seat.
  let { k = 0 }: { k?: number } = $props();

  // Debug-only overlay (plan 01-02, redrawn on the landscape galet in 01-35): the 72 ring centres
  // with their index, the stable and home slots, the exits and carrés, the felt (its ellipse and its
  // bounding box), each seat's card place (turned to face its seat), the talon and the défausse (at
  // SCENE.pile of a card), drawn over the board.
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
      card: seatCard(color, k),
    })),
  );
  const ring = $derived(RING.map((cell) => anchorOf({ z: "ring", cell }, k)));
  const card = SCENE.card;
  const felt = SCENE.felt;
  const shape = SCENE.feltShape;
  const pile = { w: card.w * SCENE.pile, h: card.h * SCENE.pile };
  const piles = [
    { name: "talon", at: SCENE.talon },
    { name: "défausse", at: SCENE.defausse },
  ] as const;
</script>

<g data-debug-geometry class="debug">
  <ellipse class="felt" data-debug-felt cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
  <rect
    class="felt box"
    data-debug-felt-box
    x={felt.x}
    y={felt.y}
    width={felt.w}
    height={felt.h}
  />

  {#each ring as [x, y], i (i)}
    <circle class="ring-dot" cx={x} cy={y} />
    <text class="label" {x} {y} data-ring={i}>{i}</text>
  {/each}

  {#each slots as s (s.color)}
    <rect
      class="card"
      data-debug-card={s.color}
      x={s.card.at[0] - card.w / 2}
      y={s.card.at[1] - card.h / 2}
      width={card.w}
      height={card.h}
      stroke={FILL[s.color]}
      transform={`rotate(${s.card.angle} ${s.card.at[0]} ${s.card.at[1]})`}
    />
    <text class="label slot" x={s.card.at[0]} y={s.card.at[1]}>{s.color}</text>
    <circle
      class="mark"
      data-debug-exit={s.color}
      cx={s.diamond[0]}
      cy={s.diamond[1]}
      stroke={FILL[s.color]}
    />
    <circle
      class="mark"
      data-debug-entry={s.color}
      cx={s.square[0]}
      cy={s.square[1]}
      stroke={FILL[s.color]}
    />
    {#each s.stable as [x, y], j (j)}
      <circle class="slot-dot" cx={x} cy={y} fill={FILL[s.color]} />
      <text class="label slot" {x} {y} data-stable={`${s.color}${j}`}>E{j}</text>
    {/each}
    {#each s.home as [x, y], j (j)}
      <circle class="slot-dot" cx={x} cy={y} fill={FILL[s.color]} />
      <text class="label slot" {x} {y} data-home={`${s.color}${j}`}>M{j}</text>
    {/each}
  {/each}

  {#each piles as p (p.name)}
    <rect
      class="card"
      data-debug-pile={p.name}
      x={p.at[0] - pile.w / 2}
      y={p.at[1] - pile.h / 2}
      width={pile.w}
      height={pile.h}
    />
    <text class="label slot" x={p.at[0]} y={p.at[1]}>{p.name}</text>
  {/each}
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

  .box {
    stroke-dasharray: calc(8px * var(--px)) calc(6px * var(--px));
    stroke-opacity: 0.6;
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
