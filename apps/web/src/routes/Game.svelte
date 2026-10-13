<script lang="ts">
  import { type Component, flushSync } from "svelte";
  import { quarterTurnsFor } from "@toc/board";
  import { EXIT, forwardCells, type PawnId, type Place } from "@toc/engine";
  import * as audio from "../audio/engine.ts";
  import { clear, hop } from "../board/animator.ts";
  import Board from "../board/Board.svelte";
  import { anchorOf } from "../board/geometry.ts";
  import Knight from "../board/Knight.svelte";
  import { createDirector } from "../game/director.ts";
  import { settings } from "../settings/store.svelte.ts";

  // The human sits at the bottom: the board is turned by k quarter turns toward their colour (D-05).
  // Read once: the colour cannot change while a game is on screen.
  const human = settings.lastColor;
  const k = quarterTurnsFor(human);
  const PAWN: PawnId = `${human}0`;
  /** Tracer: a tap moves the human's first knight forward by this many cells. */
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

  let place = $state.raw<Place>({ z: "ring", cell: EXIT[human] });
  let progress = 0;
  let moving = false;
  let mover = $state<SVGGElement>();
  let arc = $state<SVGGElement>();

  const director = createDirector({
    audio,
    quarterTurns: k,
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

  const xy = $derived(anchorOf(place, k));
  const ring = $derived(place.z === "ring" ? place.cell : -1);

  async function onselect() {
    if (moving) return;
    moving = true;
    director.enqueue([
      { t: "pawnMoved", pawn: PAWN, from: place, path: forwardCells(human, progress, STEPS), dir: 1 },
    ]);
    progress += STEPS;
    await director.idle();
    moving = false;
  }
</script>

<main class="game">
  <Board {k}>
    <Knight
      pawn={PAWN}
      color={human}
      x={xy[0]}
      y={xy[1]}
      {ring}
      bind:mover
      bind:arc
      {onselect}
    />
    {#if Geometry}
      <Geometry {k} />
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
