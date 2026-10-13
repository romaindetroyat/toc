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
    /** A knight chosen with the keyboard. */
    onpick: (pawn: PawnId) => void;
    /** A tap that hit at least one lit knight: those within 44 screen px of it, nearest first. */
    onnear: (near: PawnId[]) => void;
    onmiss: () => void;
  };

  let { px, k, render, candidates, active, onpick, onnear, onmiss }: Props = $props();

  /** Body centre of a knight above its feet, in board units. */
  const BODY = 92;
  const FOOTPRINT = 110;
  // Hit radius = max(22 screen px, footprint / 2).
  const radius = $derived(Math.max(22 * px, FOOTPRINT / 2));
  // Knights this close to the tap may be the one meant: with two or more, the tray tells them apart.
  const near = $derived(Math.max(44 * px, radius));

  const targets = $derived(
    candidates.map((pawn) => {
      const [x, y] = anchorOf(render.pawns[pawn], k);
      return { pawn, x, y: y - BODY };
    }),
  );

  /**
   * A tap that lands on a lit knight reports every lit knight within 44 screen px of it, nearest first
   * (the reducer chooses: one knight is tapped, several open the tray); anywhere else is a miss.
   */
  function onclick(event: MouseEvent) {
    const layer = event.currentTarget as SVGGraphicsElement;
    const matrix = layer.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    let hit = false;
    const around: { pawn: PawnId; distance: number }[] = [];
    for (const target of targets) {
      const distance = Math.hypot(point.x - target.x, point.y - target.y);
      if (distance <= radius) hit = true;
      if (distance <= near) around.push({ pawn: target.pawn, distance });
    }
    if (!hit) onmiss();
    else onnear(around.sort((a, b) => a.distance - b.distance).map((entry) => entry.pawn));
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
