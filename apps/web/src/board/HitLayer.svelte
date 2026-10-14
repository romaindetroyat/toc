<script lang="ts">
  import { KNIGHT, knightScale, SCENE } from "@toc/board";
  import type { PawnId, Place, RenderState } from "@toc/engine";
  import { EXIT, pawnColor, RING } from "@toc/engine";
  import { knightLetter } from "../game/turnUi.ts";
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


  /** Where a knight stands, in words: the stable, the home, or how far it has come from its exit. */
  function whereOf(pawn: PawnId, place: Place): string {
    if (place.z === "stable") return game.hand.place.stable;
    if (place.z === "home") return game.hand.place.home;
    const done = (((place.cell - EXIT[pawnColor(pawn)]) % RING) + RING) % RING;
    return done === 0 ? game.hand.place.exit : game.hand.place.ring(done);
  }

  // One target per lit knight, on its body at the size of its zone (ring, home, stable): centre =
  // anchor − KNIGHT.body × size, radius = max(22 screen px, half the knight's width); knights this
  // close to the tap may be the one meant (max(44 screen px, radius)): with two or more, the tray
  // tells them apart.
  const targets = $derived(
    candidates.map((pawn) => {
      const place = render.pawns[pawn];
      const size = knightScale(place);
      const [x, y] = anchorOf(place, k);
      const label = game.hand.pawn(pawnColor(pawn), knightLetter(pawn), whereOf(pawn, place));
      const radius = Math.max(22 * px, (KNIGHT.w / 2) * size);
      return { pawn, x, y: y - KNIGHT.body * size, radius, near: Math.max(44 * px, radius), label };
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
      if (distance <= target.radius) hit = true;
      if (distance <= target.near) around.push({ pawn: target.pawn, distance });
    }
    if (!hit) onmiss();
    else onnear(around.sort((a, b) => a.distance - b.distance).map((entry) => entry.pawn));
  }

  function onkeydown(event: KeyboardEvent, pawn: PawnId) {
    // A keyboard shortcut of the game screen already handled this key (« Entrée » plays the preview).
    if (event.defaultPrevented) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    onpick(pawn);
  }
</script>

{#if active}
  <!-- Invisible: one circle per lit knight, and the rest of the board to catch a miss. -->
  <g data-hit-layer role="presentation" {onclick}>
    <rect x="0" y="0" width={SCENE.width} height={SCENE.height} fill="transparent" />
    {#each targets as target (target.pawn)}
      <g
        class="hit"
        data-hit={target.pawn}
        role="button"
        tabindex="0"
        aria-label={target.label}
        onkeydown={(event) => onkeydown(event, target.pawn)}
      >
        <circle cx={target.x} cy={target.y} r={target.radius} fill="transparent" />
        <circle class="ring" cx={target.x} cy={target.y} r={target.radius} stroke-width={3 * px} />
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
