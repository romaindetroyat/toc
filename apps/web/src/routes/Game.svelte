<script lang="ts">
  import { type Component, flushSync } from "svelte";
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

  // Debug views allowed in the hash query (#/partie?debug=geometry); anything else is ignored.
  const DEBUG_VIEWS = ["geometry"] as const;
  const debugView = DEBUG_VIEWS.find(
    (view) => view === new URLSearchParams(location.hash.split("?")[1] ?? "").get("debug"),
  );

  // Debug builds only: the overlay is a dynamic import inside a compile-time `DEBUG` branch.
  let Geometry = $state.raw<Component | undefined>();
  if (__TOC_DEBUG__ && debugView === "geometry") {
    import("../board/DebugGeometry.svelte").then((module) => {
      Geometry = module.default;
    });
  }

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
    {#if Geometry}
      <Geometry />
    {/if}
  </Board>
</main>

<style>
  /*
   * Board side (UI-SPEC "Game screen"): always a square, centred, never cropped. The chrome
   * (info bar 56 + action zone 72 + hand zone 132 = 260) is reserved below the board in portrait;
   * in landscape the right panel takes 320 + 48. Safe-area insets are subtracted from both axes.
   */
  .game {
    --inset-x: calc(env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px));
    --inset-y: calc(env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px));
    --board-size: min(100vw - var(--inset-x), 100dvh - 260px - var(--inset-y), 880px);
    min-height: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
      env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  }

  @media (orientation: landscape) {
    .game {
      --board-size: max(
        0px,
        min(100dvh - 32px - var(--inset-y), 100vw - 368px - var(--inset-x))
      );
      align-items: center;
    }
  }
</style>
