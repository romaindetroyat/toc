<script lang="ts">
  import { type Component, flushSync, onMount, tick } from "svelte";
  import {
    type CardId,
    COLORS,
    type Color,
    type PawnId,
    type Place,
    type Playability,
    pawnColor,
    playability,
    sortHand,
    teamOf,
  } from "@toc/engine";
  import { MOTION, scaleFor } from "@toc/board";
  import {
    type EngineStatus,
    onStatus,
    pauseAmbience,
    retryUnlock,
    setMix,
    startAmbience,
    status,
    stopAmbience,
    unlockOnFirstGesture,
  } from "../audio/engine.ts";
  import * as fx from "../board/animator.ts";
  import Board, { type Burst } from "../board/Board.svelte";
  import type { Flight } from "../board/CardFlights.svelte";
  import {
    dealFlights,
    exchangeFlights,
    type FlightSpec,
    finishFlights,
    layFlights,
    playFlight,
  } from "../board/cardFx.ts";
  import { anchorOf, type Facing } from "../board/geometry.ts";
  import HitLayer from "../board/HitLayer.svelte";
  import Overlay from "../board/Overlay.svelte";
  import Pawn from "../board/Pawn.svelte";
  import { mixFromSettings, shouldPlayAmbience } from "../game/audioSettings.ts";
  import type { DebugParams } from "../game/debugParams.ts";
  import { game as copy } from "../i18n/fr/game.ts";
  import {
    createSession,
    loadDebugParams,
    type Session,
    type SessionEnv,
  } from "../game/session.svelte.ts";
  import { type FocusTarget, keyIntent, litKnights } from "../game/shortcuts.ts";
  import type { TurnUiEvent } from "../game/turnUi.ts";
  import { settings } from "../settings/store.svelte.ts";
  import ActionZone from "../ui/ActionZone.svelte";
  import DealBanner from "../ui/DealBanner.svelte";
  import EndScreen from "../ui/EndScreen.svelte";
  import HandFan, { type HandMode } from "../ui/HandFan.svelte";
  import InfoBar from "../ui/InfoBar.svelte";
  import SevenPanel from "../ui/SevenPanel.svelte";
  import TapisSheet from "../ui/TapisSheet.svelte";
  import { showToast } from "../ui/toast.svelte.ts";

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
  /** The knights on the move (or being thrown back), in front of all the others (UI-SPEC). */
  let moving = $state.raw<PawnId[]>([]);
  /** The particles of the party of the fourth knight home, while they fly. */
  let burst = $state.raw<Burst | null>(null);
  /** The cards on their way over the board: dealt, played, exchanged, laid down. */
  let flights = $state.raw<Flight[]>([]);
  let flightSeq = 0;
  /** The knight the player tapped last (a stable knight stands for the exit, A-11). */
  let tapped = $state<PawnId | null>(null);
  /** A tap on the board missed every lit knight. */
  let missed = $state(false);

  // Outer groups of the pawns, to reach their animated inner groups.
  const els: Record<string, SVGGElement | undefined> = {};

  let session = $state.raw<Session>();

  /**
   * Raises a failure the game cannot recover from inside the component tree, where the app's
   * `<svelte:boundary>` turns it into the « Oups » error screen (T-01-33) instead of a frozen board.
   */
  function fail(failure: { error: unknown }): never {
    throw failure.error instanceof Error ? failure.error : new Error("game failure");
  }

  /**
   * A game that could not be built or started (the session, the first deal, the bot loop's start).
   * That path is asynchronous, out of the boundary's reach: it is kept here and raised in the template.
   */
  let startFailure = $state.raw<{ error: unknown } | null>(null);

  /** Runs a start-up step; a failure reaches the error screen instead of leaving a blank game. */
  function guarded(step: Promise<void>): void {
    step.catch((error: unknown) => {
      console.error(error);
      if (alive) startFailure = { error };
    });
  }

  const parts = (pawn: PawnId): fx.PawnParts => {
    const found = fx.partsOf(els[pawn]);
    if (!found) throw new Error(`pawn ${pawn} is not mounted`);
    return found;
  };

  /** Puts the knights on top before their animations start (moving a node while it animates would cut it). */
  function raise(pawns: PawnId[]) {
    const fresh = pawns.filter((pawn) => !moving.includes(pawn));
    if (fresh.length === 0) return;
    moving = [...moving, ...fresh];
    flushSync();
  }

  /**
   * Sends cards flying and resolves once they have all landed; they are taken away then, in the same
   * task in which the Director shows them on the felt. `leadMs` is the delay shared with the audio.
   */
  function launch(specs: FlightSpec[], leadMs: number): Promise<void> {
    if (specs.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let left = specs.length;
      const mine: Flight[] = specs.map((spec) => {
        let done = false;
        return {
          id: ++flightSeq,
          spec: { ...spec, delayMs: spec.delayMs + leadMs },
          onDone() {
            if (done) return;
            done = true;
            if (--left > 0) return;
            flights = flights.filter((flight) => !mine.includes(flight));
            resolve();
          },
        };
      });
      flights = [...flights, ...mine];
    });
  }

  // What the screen provides to every session: it owns the SVG nodes, so it moves and animates pawns.
  const env: SessionEnv = {
    animator: {
      begin: raise,
      hop(pawn, points, timeline, leadMs, pawnFacings, mode) {
        raise([pawn]);
        return fx.hop(parts(pawn), points, timeline, leadMs, pawnFacings, mode);
      },
      finish(pawn) {
        const found = fx.partsOf(els[pawn]);
        if (found) fx.finish(found);
        // The burst of a party goes with it.
        burst?.onDone();
      },
      exit(pawn, from, to, leadMs, facing, mode) {
        raise([pawn]);
        return fx.exitBound(parts(pawn), from, to, leadMs, facing, mode);
      },
      turn: (pawn, from, to, leadMs, mode) => fx.volteFace(parts(pawn), from, to, leadMs, mode),
      rear: (pawn, leadMs, mode) => fx.rear(parts(pawn), leadMs, mode),
      eject(pawn, from, to, leadMs, facing, mode) {
        raise([pawn]);
        return fx.eject(parts(pawn), from, to, leadMs, facing, mode);
      },
      swap(a, b, leadMs, mode) {
        raise([a.pawn, b.pawn]);
        return fx.swapArcs(
          { parts: parts(a.pawn), from: a.from, to: a.to, facing: a.facing },
          { parts: parts(b.pawn), from: b.from, to: b.to, facing: b.facing },
          leadMs,
          mode,
        );
      },
      settle: (pawn, leadMs, mode) => fx.homeSettle(parts(pawn), leadMs, mode),
      party: (pawn, at, leadMs, mode) =>
        fx.party(
          parts(pawn),
          leadMs,
          mode,
          () =>
            new Promise<void>((resolve) => {
              burst = {
                x: at[0],
                y: at[1],
                delayMs: leadMs,
                durationMs: MOTION.partyBurst * scaleFor(mode),
                onDone: () => {
                  burst = null;
                  resolve();
                },
              };
            }),
        ),
      winHop: (pawns, leadMs, mode) =>
        fx.winHop(
          pawns.map((pawn) => parts(pawn)),
          leadMs,
          mode,
        ),
      deal: (seats, leadMs, mode) => launch(dealFlights(seats, session?.k ?? 0, mode), leadMs),
      playCard: (seat, card, leadMs, mode) =>
        launch([playFlight(seat, card, session?.k ?? 0, mode)], leadMs),
      exchange: (leadMs, mode) => launch(exchangeFlights(session?.k ?? 0, mode), leadMs),
      lay: (seat, cards, leadMs, mode) =>
        launch(layFlights(seat, cards, session?.k ?? 0, mode), leadMs),
      finishCards: finishFlights,
    },
    facingOf: (pawn) => facings[pawn] ?? "right",
    commit(pawn, _place, facing) {
      // The render state already holds the landing place: keep the facing, move the static
      // anchor, then drop the animation offset in the same task (no flicker).
      facings = { ...facings, [pawn]: facing };
      flushSync();
      const found = fx.partsOf(els[pawn]);
      if (found) fx.clear(found);
      moving = moving.filter((each) => each !== pawn);
    },
  };

  let alive = true;
  /** Counts the games started, so a game that was replaced while it was being built is dropped. */
  let epoch = 0;
  /** The debug parameters the first game was opened with; a replay keeps only the speed. */
  let opened: DebugParams = {};

  /** Starts a game, replacing the one on screen: the board is unmounted first, so the pawns start afresh. */
  async function begin(debug: DebugParams, colour?: Color) {
    const mine = ++epoch;
    session?.dispose();
    session = undefined;
    facings = Object.fromEntries(PAWNS.map(({ id }) => [id, "right" as Facing]));
    moving = [];
    burst = null;
    flights = [];
    tapped = null;
    missed = false;
    await tick();
    if (!alive || mine !== epoch) return;
    const created = createSession(env, debug, colour);
    session = created;
    // The pawns must be mounted before the first bot can move.
    await tick();
    if (alive && mine === epoch) created.start();
  }

  onMount(() => {
    guarded(
      (async () => {
        opened = await loadDebugParams(location.hash);
        if (alive) await begin(opened);
      })(),
    );
    return () => {
      alive = false;
      session?.dispose();
    };
  });

  /** « Rejouer »: a new game with the same colour (and the same speed under test). */
  function replay() {
    guarded(begin({ vitesse: opened.vitesse }, session?.human));
  }

  /** « Changer de couleur »: back to the launch screen. */
  function changeColour() {
    location.hash = "#/";
  }

  /** « Sur le tapis »: the felt read in large form (D-08). */
  let tapisOpen = $state(false);

  /**
   * « Abandonner la partie », once confirmed: the game is disposed and the launch screen comes back (or
   * the sound test, when « Tester les sons » was asked for in the game).
   */
  function abandon(to = "#/") {
    epoch++;
    session?.dispose();
    session = undefined;
    location.hash = to;
  }

  const k = $derived(session?.k ?? 0);
  const render = $derived(session?.render ?? null);
  /** The end screen is up: the rest of the game screen is inert behind it. */
  const ended = $derived(render !== null && render.phase === "won" && render.winner !== null);
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
          const rankA = moving.indexOf(a.id);
          const rankB = moving.indexOf(b.id);
          if (rankA >= 0 || rankB >= 0) return rankA - rankB;
          return a.y - b.y || a.id.localeCompare(b.id);
        }),
  );

  /** Where the flow stands: under the tray it is the state the tray resumes. */
  const flow = $derived(ui.kind === "tray" ? ui.next : ui);

  /**
   * Knights lit for the selected card: the ring knight itself, or every stable knight for an exit. The
   * same list reaches HitLayer, Overlay and the keyboard shortcuts.
   */
  const candidates = $derived(render === null ? [] : litKnights(flow, render.pawns));

  const selectedPawn = $derived.by((): PawnId | null => {
    if (render === null) return null;
    if (flow.kind === "sevenBuilding") return flow.selected ?? null;
    if (flow.kind === "jackTarget") return flow.pawn;
    if (flow.kind !== "preview") return null;
    const action = flow.action;
    if (action.t === "move" || action.t === "swap") return action.pawn;
    if (action.t !== "exit") return null;
    const same = tapped !== null && pawnColor(tapped) === pawnColor(action.pawn);
    return same && render.pawns[tapped as PawnId]?.z === "stable" ? (tapped as PawnId) : action.pawn;
  });

  /** Valet: the knight to swap with, once chosen. */
  const targetPawn = $derived(flow.kind === "preview" && flow.action.t === "swap" ? flow.action.target : null);

  const handMode = $derived.by((): HandMode => {
    switch (ui.kind) {
      case "idle":
      case "finishedPrompt":
      case "cardSelected":
      case "modeChoice":
      case "jackPick":
      case "jackTarget":
      case "sevenBuilding":
      case "tray":
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

  /**
   * The top of the défausse as the render state has it. A played card is also the last card of its
   * seat on the felt (and a posed hand lies there too), so the défausse shows the latest card that is
   * not already drawn elsewhere; only public cards are read (discarded cards were played face up).
   */
  const discardTop = $derived.by((): CardId | null => {
    if (render === null || view === undefined || render.discardSize === 0) return null;
    const shown = new Set<CardId>(
      [...Object.values(render.lastPlayed), ...Object.values(render.posed).flat()].filter(
        (card): card is CardId => card !== null,
      ),
    );
    for (let i = Math.min(render.discardSize, view.discard.length) - 1; i >= 0; i--) {
      const card = view.discard[i] as CardId;
      if (!shown.has(card)) return card;
    }
    return null;
  });

  /**
   * The new hand is held back, face down, until the cards of the deal have landed: the view already
   * holds it while the felt still counts none (the Director has not reached the deal yet).
   */
  const concealed = $derived(
    session !== undefined &&
      render !== null &&
      view !== undefined &&
      session.pace !== "test" &&
      view.hand.length > 0 &&
      render.handSizes[session.human] === 0,
  );

  const verdicts = $derived.by((): Partial<Record<CardId, Playability>> => {
    if (session === undefined || view === undefined || view.phase !== "play") return {};
    return playability(view, session.human);
  });

  const selectedCard = $derived(
    ui.kind === "cardSelected" ||
      ui.kind === "modeChoice" ||
      ui.kind === "jackPick" ||
      ui.kind === "jackTarget" ||
      ui.kind === "sevenBuilding" ||
      ui.kind === "tray" ||
      ui.kind === "preview"
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

  /** A tap on the board: the lit knights near it, nearest first (the reducer taps one or opens the tray). */
  function pickNear(near: PawnId[]) {
    tapped = near[0] ?? null;
    send({ t: "tapAt", near });
  }

  function chooseExit() {
    // « Sortir » needs no knight tap: any stable knight stands for the exit.
    tapped = null;
    send({ t: "chooseExit" });
  }

  function pickTrayOption(pawn: PawnId) {
    tapped = pawn;
    send({ t: "chooseTrayOption", pawn });
  }

  /** Where the focus is, for the shortcuts: a form field, a card of the hand, a lit knight, or else. */
  function focusTarget(): FocusTarget {
    const active = document.activeElement;
    if (active === null || active === document.body) return { kind: "none" };
    if (active.matches("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) {
      return { kind: "field" };
    }
    const card = active.closest("[data-hand] [data-card]")?.getAttribute("data-card");
    if (card) return { kind: "card", card: card as CardId };
    const pawn = active.closest("[data-hit]")?.getAttribute("data-hit");
    if (pawn) return { kind: "knight", pawn: pawn as PawnId };
    return { kind: "control" };
  }

  /**
   * The keyboard shortcuts (UI-SPEC addendum 2026-10-14): read before any other handler (capture
   * phase), turned into reducer events by the pure key map, and sent like the taps they stand for.
   * Échap is one of them (one step back); with a sheet open it is left to the sheet, which closes.
   */
  function onShortcut(event: KeyboardEvent) {
    const intent = keyIntent(event, {
      ui,
      hand: view === undefined ? [] : sortHand(view.hand),
      lit: candidates,
      concealed,
      focus: focusTarget(),
      blocked:
        session === undefined ||
        view === undefined ||
        ended ||
        document.querySelector("[data-sheet-layer]") !== null,
    });
    if (intent === null) return;
    event.preventDefault();
    event.stopPropagation();
    for (const each of intent.events) {
      if (each.t === "tapPawn") pickPawn(each.pawn);
      else if (each.t === "tapAt") pickNear(each.near);
      else if (each.t === "chooseTrayOption") pickTrayOption(each.pawn);
      else if (each.t === "chooseExit") chooseExit();
      else send(each);
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onShortcut, { capture: true });
    return () => window.removeEventListener("keydown", onShortcut, { capture: true });
  });

  // --- Sound settings (FX-06, D-25) ---
  // Every change of « Son », « Bruitages », « Ambiance » and its volume reaches the audio buses at once.
  $effect(() => {
    setMix(mixFromSettings(settings));
  });

  let pageVisible = $state(!document.hidden);
  let audioStatus = $state<EngineStatus>(status());
  $effect(() => onStatus((next) => (audioStatus = next)));

  // When the sound cannot start the game goes on without it (FX-06): one toast says so and offers to try
  // again. The retry is a tap, so it may create and resume the AudioContext.
  function warnAudioFailed() {
    showToast(copy.failures.audio, { label: copy.failures.audioRetry, run: retryAudio });
  }

  // The outcome is read once the resume has settled: right after the tap the old failure still stands.
  // A failure that does not change the status (the browser refuses again) shows the toast from here;
  // a recovery reaches audioStatus through onStatus.
  function retryAudio() {
    void retryUnlock().then((outcome) => {
      if (!alive) return;
      audioStatus = outcome;
      if (outcome === "failed") warnAudioFailed();
    });
  }

  $effect(() => {
    if (audioStatus === "failed") warnAudioFailed();
  });

  // The light ambience plays while the sound and the ambience are on, the audio is ready and the page
  // is visible (it fades in over 1.5 s once started); it stops for good when « Son » or « Ambiance »
  // goes off, and only pauses with the tab.
  $effect(() => {
    if (!settings.sound || !settings.ambience) stopAmbience();
    else if (shouldPlayAmbience(settings, pageVisible, audioStatus === "ready")) startAmbience();
    else if (!pageVisible) pauseAmbience();
  });

  // The ambience belongs to the game screen: it stops when the player leaves it.
  onMount(() => stopAmbience);

  // Opened without the launch screen's tap (a reload, a PWA relaunch, a bookmark): the first tap or key
  // on the game screen starts the sound.
  onMount(() => unlockOnFirstGesture());
</script>

<svelte:document onvisibilitychange={() => (pageVisible = !document.hidden)} />

<main class="game">
  {#if startFailure}
    {fail(startFailure)}
  {:else if session?.failure}
    {fail(session.failure)}
  {/if}
  {#if session !== undefined && render !== null && view !== undefined}
    <!-- Behind the end screen the game is out of reach: no focus, no tap, nothing for a screen reader. -->
    <div class="layout" data-layout inert={ended}>
      <div class="info">
        <InfoBar {render} human={session.human} names={session.names} onabandon={abandon} />
      </div>

      <div class="stage">
        <Board {k} {render} {discardTop} {burst} {flights} ontapis={() => (tapisOpen = true)}>
          {#snippet under(px)}
            <Overlay
              layer="under"
              {px}
              {k}
              {render}
              {ui}
              {candidates}
              selected={selectedPawn}
              target={targetPawn}
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
              target={targetPawn}
            />
          {/snippet}
          {#snippet hits(px)}
            <HitLayer
              {px}
              {k}
              {render}
              {candidates}
              active={
                ui.kind === "cardSelected" ||
                ui.kind === "jackPick" ||
                ui.kind === "jackTarget" ||
                ui.kind === "sevenBuilding" ||
                ui.kind === "preview"
              }
              onpick={pickPawn}
              onnear={pickNear}
              onmiss={() => {
                missed = true;
              }}
            />
          {/snippet}
        </Board>
        <DealBanner {render} names={session.names} />
      </div>

      {#if flow.kind === "sevenBuilding"}
        <!-- The 7 splitter replaces the action zone and the hand (UI-SPEC). -->
        <div class="seven">
          <SevenPanel
            seven={flow}
            tray={ui.kind === "tray" ? ui : null}
            {missed}
            onpickSteps={(steps) => send({ t: "pickSteps", steps })}
            onundo={() => send({ t: "undoLast" })}
            oncancelAll={() => send({ t: "cancelAll" })}
            onconfirm={() => send({ t: "confirm" })}
            ontrayPick={pickTrayOption}
            ontrayClose={() => send({ t: "closeTray" })}
          />
        </div>
      {:else}
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
            onexit={chooseExit}
            onadvance={() => send({ t: "chooseAdvance" })}
            ontrayPick={pickTrayOption}
            ontrayClose={() => send({ t: "closeTray" })}
          />
        </div>

        <div class="hand">
          <HandFan
            hand={view.hand}
            mode={handMode}
            playability={verdicts}
            selected={selectedCard}
            {received}
            {concealed}
            pace={session.pace}
            onpick={pickCard}
          />
        </div>
      {/if}
    </div>

    {#if tapisOpen}
      <TapisSheet {render} names={session.names} onclose={() => (tapisOpen = false)} />
    {/if}

    {#if ended && render.winner !== null}
      <EndScreen
        won={render.winner === teamOf(session.human)}
        winner={render.winner}
        stats={session.stats}
        onreplay={replay}
        onchange={changeColour}
      />
    {/if}
  {/if}
</main>

<style>
  /*
   * Board side (UI-SPEC "Game screen"): always a square, centred, never cropped. The chrome below the
   * board in portrait is the info bar (56), the action zone and the hand zone: the action zone has a
   * fixed height (--action) so that a longer prompt, the preview or the tray never pushes the hand down,
   * and the hand zone is the fan plus the room the lifted and turned cards need (--hand). The board keeps
   * 4 % of its side free above it for the head of the top knights; in landscape the right panel takes
   * 320 + 48. Safe-area insets are subtracted from both axes. The page never scrolls (FX-01).
   */
  .game {
    --inset-x: calc(env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px));
    --inset-y: calc(env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px));
    --action: 120px;
    --hand: 136px;
    --chrome: calc(56px + var(--action) + var(--hand));
    --board-size: max(
      0px,
      min(100vw - var(--inset-x), (100dvh - var(--chrome) - var(--inset-y)) / 1.04, 880px)
    );
    /* Its own formatting context: the outer margin of the landscape layout stays inside the page. */
    display: flow-root;
    min-height: 100%;
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
      env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  }

  /* Below 360 px the prompt wraps more and the tray stacks its button: the zone is a little taller. */
  @media (max-width: 359.98px) {
    .game {
      --action: 128px;
    }
  }

  /* Regular cards (88 x 124): the hand zone is 24 px taller. */
  @media (min-width: 600px) and (min-height: 600px) {
    .game {
      --hand: 160px;
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
    grid-template-rows: 56px auto var(--action) auto;
    align-content: start;
  }

  .info {
    grid-area: info;
  }

  .stage {
    grid-area: stage;
    position: relative;
    display: flex;
    justify-content: center;
  }

  /* A fixed height; the prompt is centred in it, and a prompt that is longer than it scrolls here. */
  .action {
    grid-area: action;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .hand {
    grid-area: hand;
    padding: 0 var(--space-md);
  }

  /* The 7 panel takes the rows of the action zone and of the hand. */
  .seven {
    grid-row: action / hand;
    grid-column: action;
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
      max-width: 100%;
      width: fit-content;
      min-height: calc(100dvh - 32px - var(--inset-y));
      margin: 16px auto;
      column-gap: var(--space-md);
      grid-template-columns: var(--board-size) minmax(320px, 400px);
      grid-template-areas:
        "stage info"
        "stage action"
        "stage hand";
      grid-template-rows: 56px minmax(72px, auto) 1fr;
      align-content: stretch;
    }

    .action {
      min-height: 72px;
      max-height: 160px;
    }

    .stage {
      align-self: center;
    }

    .hand {
      align-self: end;
    }
  }

  /* A short landscape screen (480 x 320): no outer margin, so the right panel has the height it needs. */
  @media (orientation: landscape) and (max-height: 400px) {
    .game {
      --board-size: max(
        0px,
        min(100dvh - var(--inset-y), 100vw - 368px - var(--inset-x)) / 1.04
      );
    }

    .layout {
      min-height: calc(100dvh - var(--inset-y));
      margin: 0 auto;
    }
  }
</style>
