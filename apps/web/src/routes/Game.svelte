<script lang="ts">
  import { type Component, flushSync } from "svelte";
  import { quarterTurnsFor } from "@toc/board";
  import { COLORS, EXIT, forwardCells, type PawnId, type Place } from "@toc/engine";
  import * as audio from "../audio/engine.ts";
  import { clear, hop, type PawnParts, partsOf } from "../board/animator.ts";
  import Board from "../board/Board.svelte";
  import { anchorOf, type Facing } from "../board/geometry.ts";
  import Pawn from "../board/Pawn.svelte";
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

  // Sixteen pawns. Until the engine drives the render state (plan 01-16), each one sits in its own
  // stable slot (slot = pawn index), except the human's pawn 0, which stands on its exit diamond so
  // the tracer tap keeps working.
  const PAWNS = COLORS.flatMap((color) =>
    ([0, 1, 2, 3] as const).map((slot) => ({ id: `${color}${slot}` as PawnId, color, slot })),
  );
  const placements: Record<string, Place> = {};
  for (const { id, color, slot } of PAWNS) {
    placements[id] = { z: "stable", color, slot };
  }
  placements[PAWN] = { z: "ring", cell: EXIT[human] };

  let places = $state.raw<Record<string, Place>>(placements);
  let facings = $state.raw<Record<string, Facing>>(
    Object.fromEntries(PAWNS.map(({ id }) => [id, "right" as Facing])),
  );
  let movingPawn = $state<PawnId>();
  let progress = 0;

  // Outer groups of the pawns, to reach their animated inner groups.
  const els: Record<string, SVGGElement | undefined> = {};

  // Lower on screen = in front; the pawn on the move is on top of all the others (UI-SPEC).
  const drawn = $derived(
    PAWNS.map((pawn) => {
      const [x, y] = anchorOf(places[pawn.id] as Place, k);
      return { ...pawn, x, y };
    }).sort((a, b) => {
      if (a.id === movingPawn) return 1;
      if (b.id === movingPawn) return -1;
      return a.y - b.y || a.id.localeCompare(b.id);
    }),
  );

  const director = createDirector({
    audio,
    quarterTurns: k,
    animator: {
      hop(pawn, points, timeline, leadMs, pawnFacings) {
        const parts = partsOf(els[pawn]);
        if (!parts) throw new Error(`pawn ${pawn} is not mounted`);
        return hop(parts, points, timeline, leadMs, pawnFacings);
      },
    },
    facingOf: (pawn) => facings[pawn] ?? "right",
    commit(pawn, next, facing) {
      places = { ...places, [pawn]: next };
      facings = { ...facings, [pawn]: facing };
      // Move the static anchor first, then drop the animation offset, in the same task (no flicker).
      flushSync();
      const parts: PawnParts | null = partsOf(els[pawn]);
      if (parts) clear(parts);
    },
  });

  async function onselect() {
    if (movingPawn) return;
    movingPawn = PAWN;
    // The moving pawn is re-ordered on top before its animation starts (moving a node would cut it).
    flushSync();
    director.enqueue([
      {
        t: "pawnMoved",
        pawn: PAWN,
        from: places[PAWN] as Place,
        path: forwardCells(human, progress, STEPS),
        dir: 1,
      },
    ]);
    progress += STEPS;
    await director.idle();
    movingPawn = undefined;
  }
</script>

<main class="game">
  <Board {k}>
    {#each drawn as pawn (pawn.id)}
      <Pawn
        pawn={pawn.id}
        color={pawn.color}
        x={pawn.x}
        y={pawn.y}
        place={places[pawn.id] as Place}
        facing={facings[pawn.id]}
        bind:el={() => els[pawn.id], (node) => (els[pawn.id] = node)}
        onselect={pawn.id === PAWN ? onselect : undefined}
      />
    {/each}
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
