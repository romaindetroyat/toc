<script lang="ts">
  import {
    type ArtShape,
    type ArtTransform,
    boardArt,
    bottomOf,
    type Layout,
  } from "@toc/board";
  import type { Color } from "@toc/engine";
  import riderBleu from "../assets/plateau/cav-bleu.png";
  import riderJaune from "../assets/plateau/cav-jaune.png";
  import riderRouge from "../assets/plateau/cav-rouge.png";
  import riderVert from "../assets/plateau/cav-vert.png";
  import { board as t } from "../i18n/fr/board.ts";

  // The galet board (Romain's choice of 2026-10-14: « galet partout », landscape on a computer,
  // portrait on a phone), drawn from the data of packages/board (boardArt(k, layout)). The defs and
  // every shape are explicit SVG elements with bound attributes: nothing is ever built from a markup
  // string (T-01-50). k = the seat at the bottom (bleu 0, vert 1, rouge 2, jaune 3); the drawing never
  // turns, the colours take their side (« à confirmer par Romain »). Derived once per k and layout:
  // the animations never touch it (T-01-51). The riders are Romain's ink horseman of his original
  // board, recoloured for each colour (apps/web/src/assets/plateau, copied as they are from the
  // galet mock-up): decoration only, never a target.
  let { k = 0, layout = "portrait" }: { k?: number; layout?: Layout } = $props();

  /** Romain's rider picture of each colour (bundled files, one href per colour). */
  const RIDERS: Record<Color, string> = {
    bleu: riderBleu,
    jaune: riderJaune,
    rouge: riderRouge,
    vert: riderVert,
  };

  const art = $derived(boardArt(k, layout));
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

  /** The ring index of a cell's main shape (not of its label, its shadow or a secondary stroke). */
  function cellOf(shape: ArtShape): number | undefined {
    if (shape.detail) return undefined;
    if (shape.role !== "cell" && shape.role !== "exit" && shape.role !== "entry") return undefined;
    return shape.cell;
  }

  const colorIf = (shape: ArtShape, role: "exit" | "entry") =>
    shape.role === role && !shape.detail ? shape.color : undefined;

  /** url(#id) of a def of this drawing (the ids are fixed, « toc- »). */
  const url = (id: string | undefined) => (id === undefined ? undefined : `url(#${id})`);
  const fillOf = (shape: ArtShape) => url(shape.fillDef) ?? shape.fill;
  const pointsOf = (points: readonly (readonly [number, number])[]) =>
    points.map((p) => `${p[0]},${p[1]}`).join(" ");
</script>

<g data-board-art data-bottom={bottom} data-art-layout={layout} role="img" aria-label={t.alt} class="art">
  <defs>
    {#each art.defs as def (def.id)}
      {#if def.kind === "noise"}
        <filter id={def.id} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={def.frequency.join(" ")}
            numOctaves={def.octaves}
            seed={def.seed}
          />
          <feColorMatrix type="matrix" values={def.matrix.join(" ")} />
        </filter>
      {:else if def.kind === "radial"}
        <radialGradient id={def.id} cx={def.cx} cy={def.cy} r={def.r}>
          {#each def.stops as stop, i (i)}
            <stop offset={stop.offset} stop-color={stop.color} />
          {/each}
        </radialGradient>
      {:else if def.kind === "clip"}
        <clipPath id={def.id}><path d={def.d} /></clipPath>
      {/if}
    {/each}
  </defs>
  {#each art.shapes as shape, i (i)}
    {#if shape.kind === "rect"}
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        rx={shape.rx}
        fill={fillOf(shape)}
        fill-opacity={shape.fillOpacity}
        filter={url(shape.filter)}
        clip-path={url(shape.clip)}
        stroke={shape.stroke}
        stroke-width={shape.strokeWidth}
        stroke-opacity={shape.strokeOpacity}
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
        fill={fillOf(shape)}
        fill-opacity={shape.fillOpacity}
        filter={url(shape.filter)}
        clip-path={url(shape.clip)}
        stroke={shape.stroke}
        stroke-width={shape.strokeWidth}
        stroke-opacity={shape.strokeOpacity}
        stroke-dasharray={shape.dash?.join(" ")}
        opacity={shape.opacity}
        transform={transformOf(shape.transform)}
        data-cell={cellOf(shape)}
      />
    {:else if shape.kind === "polyline"}
      <polyline
        points={pointsOf(shape.points)}
        fill={fillOf(shape)}
        stroke={shape.stroke}
        stroke-width={shape.strokeWidth}
        stroke-opacity={shape.strokeOpacity}
        stroke-dasharray={shape.dash?.join(" ")}
        stroke-linecap={shape.linecap}
        stroke-linejoin={shape.linejoin}
        opacity={shape.opacity}
        transform={transformOf(shape.transform)}
      />
    {:else if shape.kind === "outline"}
      <polygon
        points={pointsOf(shape.points)}
        fill={fillOf(shape)}
        fill-opacity={shape.fillOpacity}
        filter={url(shape.filter)}
        clip-path={url(shape.clip)}
        stroke={shape.stroke}
        stroke-width={shape.strokeWidth}
        stroke-opacity={shape.strokeOpacity}
        stroke-dasharray={shape.dash?.join(" ")}
        stroke-linejoin={shape.linejoin}
        opacity={shape.opacity}
        transform={transformOf(shape.transform)}
      />
    {:else if shape.kind === "path"}
      <path
        d={shape.d}
        fill={fillOf(shape)}
        fill-opacity={shape.fillOpacity}
        filter={url(shape.filter)}
        clip-path={url(shape.clip)}
        stroke={shape.stroke}
        stroke-width={shape.strokeWidth}
        stroke-opacity={shape.strokeOpacity}
        stroke-dasharray={shape.dash?.join(" ")}
        stroke-linecap={shape.linecap}
        stroke-linejoin={shape.linejoin}
        opacity={shape.opacity}
        transform={transformOf(shape.transform)}
      />
    {:else if shape.kind === "image"}
      <!-- The box already has the picture's 157:209 ratio, hence preserveAspectRatio none. -->
      <image
        href={RIDERS[shape.color]}
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        preserveAspectRatio="none"
        opacity={shape.opacity}
        data-rider={shape.color}
        aria-hidden="true"
        pointer-events="none"
      />
    {:else if shape.kind === "text"}
      <!-- A handwritten number of the drawing (typography exception of the addendum): not read out. -->
      <text
        x={shape.x}
        y={shape.y}
        font-size={shape.size}
        font-weight={shape.weight}
        text-anchor="middle"
        class={shape.font}
        fill={fillOf(shape)}
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
    user-select: none;
  }

  .art text.hand {
    font-family: var(--font-display);
  }

  .art text.ui {
    font-family: var(--font-ui);
  }
</style>
