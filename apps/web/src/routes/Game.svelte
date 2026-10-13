<script lang="ts">
  import { flushSync } from "svelte";
  import { placeXY } from "@toc/board";
  import { forwardCells, type PawnId, type Place } from "@toc/engine";
  import * as audio from "../audio/engine.ts";
  import { clear, hop } from "../board/animator.ts";
  import Board from "../board/Board.svelte";
  import Knight from "../board/Knight.svelte";
  import { createDirector } from "../game/director.ts";

  const PAWN: PawnId = "bleu0";
  /** Tracer: a tap moves the blue knight forward by this many cells. */
  const STEPS = 4;

  let place = $state.raw<Place>({ z: "ring", cell: 0 });
  let progress = 0;
  let moving = false;
  let mover = $state<SVGGElement>();
  let arc = $state<SVGGElement>();

  const director = createDirector({
    audio,
    placeOf: placeXY,
    animator: {
      hop(_pawn, points, timeline, leadMs) {
        if (!mover || !arc) throw new Error("knight is not mounted");
        return hop(mover, arc, points, timeline, leadMs);
      },
    },
    commit(_pawn, next) {
      place = next;
      // Move the static anchor first, then drop the animation offset, in the same task (no flicker).
      flushSync();
      if (mover && arc) clear(mover, arc);
    },
  });

  const xy = $derived(placeXY(place));
  const ring = $derived(place.z === "ring" ? place.cell : -1);

  async function onselect() {
    if (moving) return;
    moving = true;
    director.enqueue([
      { t: "pawnMoved", pawn: PAWN, from: place, path: forwardCells("bleu", progress, STEPS), dir: 1 },
    ]);
    progress += STEPS;
    await director.idle();
    moving = false;
  }
</script>

<main class="game">
  <Board>
    <Knight
      pawn={PAWN}
      color="bleu"
      x={xy[0]}
      y={xy[1]}
      {ring}
      bind:mover
      bind:arc
      {onselect}
    />
  </Board>
</main>

<style>
  .game {
    min-height: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
</style>
