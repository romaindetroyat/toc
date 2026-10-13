<script lang="ts">
  import type { PawnId, RenderState } from "@toc/engine";
  import { pawnColor } from "@toc/engine";
  import { game } from "../i18n/fr/game.ts";
  import { anchorOf } from "./geometry.ts";

  type Props = {
    /** Board units per screen pixel. */
    px: number;
    k: number;
    render: RenderState;
    /** Knights that can be played with the selected card: the only targets. */
    candidates: readonly PawnId[];
    /** A card is selected: a tap on the board that misses every lit knight says so. */
    active: boolean;
    onpick: (pawn: PawnId) => void;
    onmiss: () => void;
  };

  let { px, k, render, candidates, active, onpick, onmiss }: Props = $props();

  /** Body centre of a knight above its feet, in board units. */
  const BODY = 92;
  const FOOTPRINT = 110;
  // Hit radius = max(22 screen px, footprint / 2).
  const radius = $derived(Math.max(22 * px, FOOTPRINT / 2));

  const targets = $derived(
    candidates.map((pawn) => {
      const [x, y] = anchorOf(render.pawns[pawn], k);
      return { pawn, x, y: y - BODY };
    }),
  );

  /** A tap lands on the nearest lit knight within reach; anywhere else is a miss. */
  function onclick(event: MouseEvent) {
    const layer = event.currentTarget as SVGGraphicsElement;
    const matrix = layer.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    let best: PawnId | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const target of targets) {
      const distance = Math.hypot(point.x - target.x, point.y - target.y);
      if (distance <= radius && distance < bestDistance) {
        best = target.pawn;
        bestDistance = distance;
      }
    }
    if (best === null) onmiss();
    else onpick(best);
  }

  function onkeydown(event: KeyboardEvent, pawn: PawnId) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    onpick(pawn);
  }
</script>

{#if active}
  <!-- Invisible: one circle per lit knight, and the rest of the board to catch a miss. -->
  <g data-hit-layer role="presentation" {onclick}>
    <rect x="0" y="0" width="2560" height="2560" fill="transparent" />
    {#each targets as target (target.pawn)}
      <g
        class="hit"
        data-hit={target.pawn}
        role="button"
        tabindex="0"
        aria-label={game.hand.pawn(pawnColor(target.pawn))}
        onkeydown={(event) => onkeydown(event, target.pawn)}
      >
        <circle cx={target.x} cy={target.y} r={radius} fill="transparent" />
        <circle class="ring" cx={target.x} cy={target.y} r={radius} stroke-width={3 * px} />
      </g>
    {/each}
  </g>
{/if}

<style>
  .hit {
    cursor: pointer;
    outline: none;
  }

  .ring {
    fill: none;
    stroke: none;
  }

  .hit:focus-visible .ring {
    stroke: var(--ambre);
  }
</style>
