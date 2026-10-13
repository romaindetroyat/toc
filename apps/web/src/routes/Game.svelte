<script lang="ts">
  import { type Component, flushSync, onMount, tick } from "svelte";
  import {
    type CardId,
    COLORS,
    type PawnId,
    type Place,
    type Playability,
    pawnColor,
    playability,
  } from "@toc/engine";
  import { clear, hop, partsOf } from "../board/animator.ts";
  import Board from "../board/Board.svelte";
  import { anchorOf, type Facing } from "../board/geometry.ts";
  import HitLayer from "../board/HitLayer.svelte";
  import Overlay from "../board/Overlay.svelte";
  import Pawn from "../board/Pawn.svelte";
  import { createSession, loadDebugParams, type Session } from "../game/session.svelte.ts";
  import type { TurnUiEvent } from "../game/turnUi.ts";
  import ActionZone from "../ui/ActionZone.svelte";
  import HandFan, { type HandMode } from "../ui/HandFan.svelte";

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

  // Sixteen pawns, always mounted. Where each one stands comes from the Director's render state.
  const PAWNS = COLORS.flatMap((color) =>
    ([0, 1, 2, 3] as const).map((slot) => ({ id: `${color}${slot}` as PawnId, color, slot })),
  );
  let facings = $state.raw<Record<string, Facing>>(
    Object.fromEntries(PAWNS.map(({ id }) => [id, "right" as Facing])),
  );
  let movingPawn = $state<PawnId>();
  /** The knight the player tapped last (a stable knight stands for the exit, A-11). */
  let tapped = $state<PawnId | null>(null);
  /** A tap on the board missed every lit knight. */
  let missed = $state(false);

  // Outer groups of the pawns, to reach their animated inner groups.
  const els: Record<string, SVGGElement | undefined> = {};

  let session = $state.raw<Session>();

  onMount(() => {
    let alive = true;
    let created: Session | undefined;
    (async () => {
      const debug = await loadDebugParams(location.hash);
      if (!alive) return;
      created = createSession(
        {
          animator: {
            hop(pawn, points, timeline, leadMs, pawnFacings) {
              // The moving pawn is re-ordered on top before its animation starts (moving a node
              // while it animates would cut the animation).
              movingPawn = pawn;
              flushSync();
              const parts = partsOf(els[pawn]);
              if (!parts) throw new Error(`pawn ${pawn} is not mounted`);
              return hop(parts, points, timeline, leadMs, pawnFacings);
            },
            finish(pawn) {
              const parts = partsOf(els[pawn]);
              if (!parts) return;
              for (const group of [parts.mover, parts.arc, parts.facing]) {
                for (const animation of group.getAnimations()) animation.finish();
              }
            },
          },
          facingOf: (pawn) => facings[pawn] ?? "right",
          commit(pawn, _place, facing) {
            // The render state already holds the landing place: keep the facing, move the static
            // anchor, then drop the animation offset in the same task (no flicker).
            facings = { ...facings, [pawn]: facing };
            flushSync();
            const parts = partsOf(els[pawn]);
            if (parts) clear(parts);
            movingPawn = undefined;
          },
        },
        debug,
      );
      session = created;
      // The pawns must be mounted before the first bot can move.
      await tick();
      if (alive) created.start();
    })();
    return () => {
      alive = false;
      created?.dispose();
    };
  });

  const k = $derived(session?.k ?? 0);
  const render = $derived(session?.render ?? null);
  const ui = $derived(session?.ui ?? { kind: "waiting" as const });
  const view = $derived(session?.view);

  // Lower on screen = in front; the pawn on the move is on top of all the others (UI-SPEC).
  const drawn = $derived(
    render === null
      ? []
      : PAWNS.map((pawn) => {
          const [x, y] = anchorOf(render.pawns[pawn.id] as Place, k);
          return { ...pawn, x, y };
        }).sort((a, b) => {
          if (a.id === movingPawn) return 1;
          if (b.id === movingPawn) return -1;
          return a.y - b.y || a.id.localeCompare(b.id);
        }),
  );

  /** Knights lit for the selected card: the ring knight itself, or every stable knight for an exit. */
  const candidates = $derived.by((): PawnId[] => {
    if (render === null || (ui.kind !== "cardSelected" && ui.kind !== "preview")) return [];
    const out = new Set<PawnId>();
    for (const action of ui.candidates) {
      if (action.t === "move") out.add(action.pawn);
      else if (action.t === "exit") {
        for (const pawn of PAWNS) {
          if (pawn.color === pawnColor(action.pawn) && render.pawns[pawn.id]?.z === "stable") {
            out.add(pawn.id);
          }
        }
      }
    }
    return [...out];
  });

  const selectedPawn = $derived.by((): PawnId | null => {
    if (render === null || ui.kind !== "preview") return null;
    const action = ui.action;
    if (action.t === "move") return action.pawn;
    if (action.t !== "exit") return null;
    const same = tapped !== null && pawnColor(tapped) === pawnColor(action.pawn);
    return same && render.pawns[tapped as PawnId]?.z === "stable" ? (tapped as PawnId) : action.pawn;
  });

  const handMode = $derived.by((): HandMode => {
    switch (ui.kind) {
      case "idle":
      case "finishedPrompt":
      case "cardSelected":
      case "preview":
        return "turn";
      case "exchange":
        return "exchange";
      case "deadHand":
        return "dead";
      default:
        return "waiting";
    }
  });

  const verdicts = $derived.by((): Partial<Record<CardId, Playability>> => {
    if (session === undefined || view === undefined || view.phase !== "play") return {};
    return playability(view, session.human);
  });

  const selectedCard = $derived(
    ui.kind === "cardSelected" || ui.kind === "preview"
      ? ui.card
      : ui.kind === "exchange"
        ? (ui.selected ?? null)
        : null,
  );

  // Only cards of the hand are marked as received (D-21).
  const received = $derived(
    view?.received != null && view.hand.includes(view.received) ? view.received : null,
  );

  function send(event: TurnUiEvent) {
    missed = false;
    session?.send(event);
  }

  function pickCard(card: CardId) {
    send(handMode === "exchange" ? { t: "selectGive", card } : { t: "tapCard", card });
  }

  function pickPawn(pawn: PawnId) {
    tapped = pawn;
    send({ t: "tapPawn", pawn });
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") send({ t: "escape" });
  }
</script>

<svelte:window {onkeydown} />

<main class="game">
  {#if session !== undefined && render !== null && view !== undefined}
    <div class="layout" data-layout>
      <!-- 56 px reserved for the info bar of plan 01-17. -->
      <div class="info" data-info-slot></div>

      <div class="stage">
        <Board {k}>
          {#snippet under(px)}
            <Overlay
              layer="under"
              {px}
              {k}
              {render}
              {ui}
              {candidates}
              selected={selectedPawn}
            />
          {/snippet}
          {#each drawn as pawn (pawn.id)}
            <Pawn
              pawn={pawn.id}
              color={pawn.color}
              x={pawn.x}
              y={pawn.y}
              place={render.pawns[pawn.id] as Place}
              facing={facings[pawn.id]}
              lift={pawn.id === selectedPawn ? 12 : 0}
              bind:el={() => els[pawn.id], (node) => (els[pawn.id] = node)}
            />
          {/each}
          {#if Geometry}
            <Geometry {k} />
          {/if}
          {#snippet over(px)}
            <Overlay
              layer="over"
              {px}
              {k}
              {render}
              {ui}
              {candidates}
              selected={selectedPawn}
            />
          {/snippet}
          {#snippet hits(px)}
            <HitLayer
              {px}
              {k}
              {render}
              {candidates}
              active={ui.kind === "cardSelected" || ui.kind === "preview"}
              onpick={pickPawn}
              onmiss={() => {
                missed = true;
              }}
            />
          {/snippet}
        </Board>
      </div>

      <div class="action">
        <ActionZone
          {ui}
          {view}
          human={session.human}
          names={session.names}
          hint={session.hint}
          {missed}
          thinking={session.thinking}
          lastPlay={session.lastPlay}
          onconfirm={() => send({ t: "confirm" })}
          oncancel={() => send({ t: "cancel" })}
          onchangeCard={() => send({ t: "changeCard" })}
          ongive={() => send({ t: "give" })}
          onpose={() => send({ t: "pose" })}
        />
      </div>

      <div class="hand">
        <HandFan
          hand={view.hand}
          mode={handMode}
          playability={verdicts}
          selected={selectedCard}
          {received}
          onpick={pickCard}
        />
      </div>
    </div>
  {/if}
</main>

<style>
  /*
   * Board side (UI-SPEC "Game screen"): always a square, centred, never cropped. The chrome
   * (info bar 56 + action zone 72 + hand zone 132 = 260) is reserved below the board in portrait,
   * and the board keeps 4 % of its side free above it for the head of the top knights; in landscape
   * the right panel takes 320 + 48. Safe-area insets are subtracted from both axes.
   */
  .game {
    --inset-x: calc(env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px));
    --inset-y: calc(env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px));
    --chrome: 260px;
    --board-size: max(
      0px,
      min(100vw - var(--inset-x), (100dvh - var(--chrome) - var(--inset-y)) / 1.04, 880px)
    );
    min-height: 100%;
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
      env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  }

  /* Regular cards (88 x 124): the hand zone is 24 px taller. */
  @media (min-width: 600px) and (min-height: 600px) {
    .game {
      --chrome: 284px;
    }
  }

  /* Compact and wide portrait: info bar, board, action zone, hand. */
  .layout {
    display: grid;
    width: 100%;
    max-width: 880px;
    margin: 0 auto;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "info"
      "stage"
      "action"
      "hand";
    grid-template-rows: 56px auto auto auto;
    align-content: start;
  }

  .info {
    grid-area: info;
  }

  .stage {
    grid-area: stage;
    display: flex;
    justify-content: center;
  }

  .action {
    grid-area: action;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 72px;
    max-height: 160px;
  }

  .hand {
    grid-area: hand;
    padding: 0 var(--space-md);
  }

  /* Landscape (phones included): the board at the left, the right panel at least 320 wide. */
  @media (orientation: landscape) {
    .game {
      --board-size: max(
        0px,
        min(100dvh - 32px - var(--inset-y), 100vw - 368px - var(--inset-x)) / 1.04
      );
    }

    .layout {
      max-width: none;
      width: max-content;
      min-height: calc(100dvh - 32px - var(--inset-y));
      margin: 16px auto;
      column-gap: var(--space-md);
      grid-template-columns: var(--board-size) minmax(320px, 400px);
      grid-template-areas:
        "stage info"
        "stage action"
        "stage hand";
      grid-template-rows: 56px auto 1fr;
      align-content: stretch;
    }

    .stage {
      align-self: center;
    }

    .hand {
      align-self: end;
    }
  }
</style>
