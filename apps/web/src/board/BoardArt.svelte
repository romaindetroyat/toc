<script lang="ts">
  import { type ArtShape, type ArtTransform, boardArt, bottomOf } from "@toc/board";
  import { board as t } from "../i18n/fr/board.ts";

  // Board C+ (D-05, D-07: the portrait board decided by Romain), drawn from the shape list of
  // packages/board (boardArt). Every shape is an explicit SVG element with bound attributes: nothing
  // is ever built from a markup string (T-01-42). k = the seat at the bottom (bleu 0, vert 1,
  // rouge 2, jaune 3); the drawing never turns, the colours take their side (« à confirmer par
  // Romain »). Derived once per k: the animations never touch it (T-01-43).
  let { k = 0 }: { k?: number } = $props();

  const shapes = $derived(boardArt(k));
  const bottom = $derived(bottomOf(k));

  /** translate, then rotate, then scale: the SVG order of ArtTransform. */
  function transformOf(transform: ArtTransform | undefined): string | undefined {
    if (!transform) return undefined;
    const parts: string[] = [];
    if (transform.translate) {
      parts.push(`translate(${transform.translate[0]} ${transform.translate[1]})`);
    }
    if (transform.rotate !== undefined) parts.push(`rotate(${transform.rotate})`);
    if (transform.scale !== undefined) parts.push(`scale(${transform.scale})`);
    return parts.join(" ");
  }

  /** The ring index of a cell's main shape (not of its label or of a secondary stroke). */
  function cellOf(shape: ArtShape): number | undefined {
    if (shape.detail) return undefined;
    if (shape.role !== "cell" && shape.role !== "exit" && shape.role !== "entry") return undefined;
    return shape.cell;
  }

  const colorIf = (shape: ArtShape, role: "exit" | "entry") =>
    shape.role === role && !shape.detail ? shape.color : undefined;
</script>

<g data-board-art data-bottom={bottom} role="img" aria-label={t.alt} class="art">
  {#each shapes as shape, i (i)}
    {#if shape.kind === "rect"}
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        rx={shape.rx}
        fill={shape.fill}
        stroke={shape.stroke}
        stroke-width={shape.strokeWidth}
        stroke-dasharray={shape.dash?.join(" ")}
        stroke-linecap={shape.linecap}
        stroke-linejoin={shape.linejoin}
        opacity={shape.opacity}
        transform={transformOf(shape.transform)}
        data-cell={cellOf(shape)}
        data-exit={colorIf(shape, "exit")}
        data-entry={colorIf(shape, "entry")}
      />
    {:else if shape.kind === "circle"}
      <circle
        cx={shape.cx}
        cy={shape.cy}
        r={shape.r}
        fill={shape.fill}
        stroke={shape.stroke}
        stroke-width={shape.strokeWidth}
        stroke-dasharray={shape.dash?.join(" ")}
        opacity={shape.opacity}
        transform={transformOf(shape.transform)}
        data-cell={cellOf(shape)}
      />
    {:else if shape.kind === "polyline"}
      <polyline
        points={shape.points.map((p) => `${p[0]},${p[1]}`).join(" ")}
        fill={shape.fill}
        stroke={shape.stroke}
        stroke-width={shape.strokeWidth}
        stroke-dasharray={shape.dash?.join(" ")}
        stroke-linecap={shape.linecap}
        stroke-linejoin={shape.linejoin}
        opacity={shape.opacity}
        transform={transformOf(shape.transform)}
      />
    {:else if shape.kind === "path"}
      <path
        d={shape.d}
        fill={shape.fill}
        stroke={shape.stroke}
        stroke-width={shape.strokeWidth}
        stroke-dasharray={shape.dash?.join(" ")}
        stroke-linecap={shape.linecap}
        stroke-linejoin={shape.linejoin}
        opacity={shape.opacity}
        transform={transformOf(shape.transform)}
      />
    {:else if shape.kind === "text"}
      <!-- A printed numeral of the drawing (typography exception of the addendum): not read out. -->
      <text
        x={shape.x}
        y={shape.y}
        font-size={shape.size}
        font-weight={shape.weight}
        text-anchor="middle"
        fill={shape.fill}
        stroke={shape.stroke}
        stroke-width={shape.strokeWidth}
        opacity={shape.opacity}
        transform={transformOf(shape.transform)}
        aria-hidden="true">{shape.text}</text
      >
    {/if}
  {/each}
</g>

<style>
  .art {
    pointer-events: none;
  }

  .art text {
    font-family: var(--font-ui);
    user-select: none;
  }
</style>
