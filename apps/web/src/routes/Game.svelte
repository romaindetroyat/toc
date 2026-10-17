<script lang="ts">
  import type { TablePublic } from "@toc/protocol";
  import { type Component, flushSync, onMount, tick, untrack } from "svelte";
  import {
    type CardId,
    COLORS,
    type Color,
    PARTNER,
    type PawnId,
    type Place,
    type Playability,
    pawnColor,
    playability,
    sortHand,
    teamOf,
  } from "@toc/engine";
  import { leftClearance, MOTION, SCENE, scaleFor } from "@toc/board";
  import {
    type EngineStatus,
    onStatus,
    retryUnlock,
    setMix,
    status,
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
  import type { VisibilitySource } from "../game/director.ts";
  import HitLayer from "../board/HitLayer.svelte";
  import Overlay from "../board/Overlay.svelte";
  import Pawn from "../board/Pawn.svelte";
  import { mixFromSettings } from "../game/audioSettings.ts";
  import type { DebugParams } from "../game/debugParams.ts";
  import { game as copy } from "../i18n/fr/game.ts";
  import { table as tableCopy } from "../i18n/fr/table.ts";
  import type { TableConnection } from "../net/connection.svelte.ts";
  import { gameNotices } from "../net/notices.ts";
  import {
    type ControllerFactory,
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
  import PawnTray from "../ui/PawnTray.svelte";
  import RotatePrompt from "../ui/RotatePrompt.svelte";
  import SettingsButton from "../ui/SettingsButton.svelte";
  import SevenPanel from "../ui/SevenPanel.svelte";
  import TablePlate from "../ui/TablePlate.svelte";
  import SeatBadges from "../board/SeatBadges.svelte";
  import { screen } from "../ui/screen.svelte.ts";
  import ShortcutsSheet from "../ui/ShortcutsSheet.svelte";
  import TapisSheet from "../ui/TapisSheet.svelte";
  import { showToast } from "../ui/toast.svelte.ts";

  type Props = {
    /**
     * An online table (#/table/<id>): the server's controller and the seat it gave this device, which
     * turns the board to that seat. Online there is no « Abandonner la partie » (plan 02-07 adds the
     * online stop and leave) and the end plank's buttons lead to the home (plan 02-09: « Revanche »).
     * `connection` gives the public table (the pause, the chef de table, who is online: plan 02-06);
     * `onhome` leaves the table for the home (« Retour à l’accueil » of the saved plate).
     */
    online?: {
      makeController: ControllerFactory;
      seat: Color;
      connection: TableConnection;
      onhome: () => void;
    };
  };

  let { online }: Props = $props();

  // Debug views allowed in the hash query (#/partie?debug=geometry); anything else is ignored.
  const DEBUG_VIEWS = ["geometry"] as const;
  const hashQuery = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const debugView = DEBUG_VIEWS.find((view) => view === hashQuery.get("debug"));

  // The landscape galet is the game's only board (Romain, 2026-10-14: « paysage obligatoire »), on a
  // computer and on a phone alike: SCENE, the one scene of packages/board, gives its ratio and its
  // head room.

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

  /**
   * A screen taller than wide (UI-SPEC addendum « Plateau galet », item 5, « à confirmer par Romain »):
   * the invitation to turn it shows instead of the game, which stays mounted behind it, hidden and
   * inert, exactly as it was.
   */
  const prompting = $derived(screen.chrome === "rotate");

  /**
   * The visibility the Director follows: hidden while the tab is hidden or while the invitation shows.
   * The moment it shows, a running motion jumps to its end without sound, and later events are applied
   * without motion until the game is back. Its listeners hear the document's own visibilitychange and
   * every change of `prompting`.
   */
  const visibilityListeners = new Set<() => void>();
  const visibility: VisibilitySource = {
    get hidden() {
      return document.hidden || prompting;
    },
    addEventListener: (_type, listener) => visibilityListeners.add(listener),
    removeEventListener: (_type, listener) => visibilityListeners.delete(listener),
  };
  function announceVisibility() {
    for (const listener of [...visibilityListeners]) listener();
  }
  onMount(() => {
    document.addEventListener("visibilitychange", announceVisibility);
    return () => document.removeEventListener("visibilitychange", announceVisibility);
  });
  $effect(() => {
    void prompting;
    untrack(announceVisibility);
  });

  /**
   * The computer players wait while the invitation shows (« Conséquence de mise en œuvre, à confirmer
   * par Romain »): the session's idle awaits this hold, which resolves once the screen is back in
   * landscape. Every pending hold is released then, and on destroy, so a disposed game's loop ends.
   */
  let holds: (() => void)[] = [];
  function releaseHolds() {
    const waiting = holds;
    holds = [];
    for (const resolve of waiting) resolve();
  }
  function hold(): Promise<void> {
    if (!prompting || !alive) return Promise.resolve();
    return new Promise<void>((resolve) => holds.push(resolve));
  }
  $effect(() => {
    if (!prompting) untrack(releaseHolds);
  });

  // What the screen provides to every session: it owns the SVG nodes, so it moves and animates pawns.
  const env: SessionEnv = {
    document: visibility,
    hold,
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
    const created = createSession(env, debug, colour, online?.makeController);
    session = created;
    // The pawns must be mounted before the first bot can move.
    await tick();
    if (alive && mine === epoch) created.start();
  }

  onMount(() => {
    guarded(
      (async () => {
        opened = await loadDebugParams(location.hash);
        // Online the server holds the game: only the test speed of the debug parameters applies.
        if (online !== undefined) opened = { vitesse: opened.vitesse };
        if (alive) await begin(opened, online?.seat);
      })(),
    );
    return () => {
      alive = false;
      session?.dispose();
      releaseHolds();
    };
  });

  /** « Rejouer »: a new game with the same colour (and the same speed under test). */
  function replay() {
    if (online !== undefined) {
      leave();
      return;
    }
    guarded(begin({ vitesse: opened.vitesse }, session?.human));
  }

  /** « Changer de couleur »: back to the solo setup (#/ordinateur, 02-04). */
  function changeColour() {
    if (online !== undefined) {
      leave();
      return;
    }
    location.hash = "#/ordinateur";
  }

  /** Online, both buttons of the end plank lead home for now (plan 02-09 gives them their own words). */
  function leave() {
    epoch++;
    session?.dispose();
    session = undefined;
    location.hash = "#/";
  }

  /** « Sur le tapis »: the felt read in large form (D-08). */
  let tapisOpen = $state(false);

  /** « Raccourcis clavier », opened with « ? »; the focus goes back to where it was on close. */
  let shortcutsOpen = $state(false);
  let shortcutsOpener = $state.raw<HTMLElement | null>(null);

  /**
   * « Abandonner la partie », once confirmed: the game is disposed and the solo setup (#/ordinateur)
   * comes back (or the sound test, when « Tester les sons » was asked for in the game).
   */
  function abandon(to = "#/ordinateur") {
    epoch++;
    session?.dispose();
    session = undefined;
    location.hash = to;
  }

  /** A computer screen (landscape from 960 x 600): the board across the width, the bar under it. */
  const bar = $derived(screen.chrome === "bar");
  /**
   * Any other landscape screen (a phone held sideways): the galet on the full height under a 24 px
   * prompt row, the hand and the buttons in two strips at its sides (plan 01-47), the left one as
   * wide as the hand's cards need (plan 02-06c).
   */
  const compact = $derived(screen.chrome === "compact");
  /**
   * How much of its width the galet stays bare at its left over its whole height, for the compact
   * mode's left strip (plan 02-06c): the hand's column may stand over it.
   */
  const GALET_BARE = leftClearance(-Infinity, Infinity) / SCENE.width;

  // --- The online table (plan 02-06): the plate over the board, the toasts of the pause ---
  const onlineTable = $derived<TablePublic | null>(online?.connection.table ?? null);
  /**
   * A plate is up (paused or saved): the board, the hand and the state buttons are inert under it;
   * the info pill and « Réglages » stay usable; the game shortcuts are ignored but « ? ».
   */
  const plateUp = $derived(
    onlineTable !== null && (onlineTable.status === "paused" || onlineTable.status === "saved"),
  );
  let previousTable: TablePublic | null = null;
  $effect(() => {
    const next = onlineTable;
    const seat = online?.seat;
    if (next === null || seat === undefined) return;
    untrack(() => {
      const notices = gameNotices(previousTable, next, { seat });
      previousTable = next;
      const first = notices[0];
      if (first !== undefined) showToast(first);
    });
  });

  const k = $derived(session?.k ?? 0);
  const render = $derived(session?.render ?? null);
  /** The end screen is up: the rest of the game screen is inert behind it. */
  const ended = $derived(render !== null && render.phase === "won" && render.winner !== null);
  /** The end plank's score: the knights home of the human's team (« nous ») and of the other. */
  const endScore = $derived.by(() => {
    const score = { nous: 0, eux: 0 };
    if (render === null || session === undefined) return score;
    const ours = teamOf(session.human);
    for (const color of COLORS) {
      if (teamOf(color) === ours) score.nous += render.homeCounts[color];
      else score.eux += render.homeCounts[color];
    }
    return score;
  });
  /** The names on the end plank: the human's own knight is « Toi ». */
  const endNames = $derived(
    session === undefined
      ? undefined
      : ({ ...session.names, [session.human]: copy.end.you } as Record<Color, string>),
  );
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
    // Behind the invitation to turn the screen no key reaches the game, nor a sheet hidden with it
    // (Échap would close it unseen). The native action is kept (Tab still moves the focus).
    if (prompting) {
      event.stopImmediatePropagation();
      return;
    }
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
    // Under a plate only « ? » reaches the game (« M » arrives with plan 02-08).
    if (plateUp && intent.kind !== "help") return;
    // The key is handled: no native action (a focused card or button is not also activated). It is
    // not stopped, though: the audio's first-gesture unlock and its resume retry listen further down
    // the path (the document), and a key is a gesture like a tap. The knights' own handler skips
    // handled keys (defaultPrevented).
    event.preventDefault();
    if (intent.kind === "help") {
      const active = document.activeElement;
      shortcutsOpener = active instanceof HTMLElement && active !== document.body ? active : null;
      shortcutsOpen = true;
      return;
    }
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
  // Every change of « Son » and « Bruitages » reaches the audio buses at once. There is no ambience
  // loop (Romain removed it on 2026-10-14).
  $effect(() => {
    setMix(mixFromSettings(settings));
  });

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

  // Opened without the launch screen's tap (a reload, a PWA relaunch, a bookmark): the first tap or key
  // on the game screen starts the sound.
  onMount(() => unlockOnFirstGesture());

  /** The invitation's heading: it takes the focus when the invitation appears. */
  let rotateHeading = $state<HTMLHeadingElement | null>(null);
  /** The game's wrapper, hidden behind the invitation. */
  let playEl = $state<HTMLElement | null>(null);
  /** The board's box (the stage is exactly the galet): the phone's hand measures its corner on it. */
  let stageEl = $state<HTMLElement | null>(null);
  /** The board itself (the plate is placed on it), once the game is drawn. */
  let boardEl = $state<HTMLElement | null>(null);
  const drawnBoard = $derived(render !== null);
  $effect(() => {
    const stage = stageEl;
    void drawnBoard;
    void tick().then(() => {
      boardEl = stage?.querySelector<HTMLElement>("[data-board]") ?? null;
    });
  });
  /** The element of the game that had the focus when the invitation appeared. */
  let focusBefore: HTMLElement | null = null;
  let wasPrompting = false;

  // Read before the game is hidden (a hidden element loses the focus).
  $effect.pre(() => {
    const now = prompting;
    untrack(() => {
      if (!now || wasPrompting) return;
      const active = document.activeElement;
      focusBefore = active instanceof HTMLElement && playEl?.contains(active) ? active : null;
    });
  });

  /** Whether an element can take the focus again: still in the page, displayed, not inert, enabled. */
  function focusable(element: HTMLElement | null): element is HTMLElement {
    return (
      element !== null &&
      element.isConnected &&
      element.getClientRects().length > 0 &&
      element.closest("[inert]") === null &&
      !(element as HTMLButtonElement).disabled
    );
  }

  // The heading takes the focus when the invitation appears; when it goes, once the game is displayed
  // again, the focus goes back to where it was, or else to the gear.
  $effect(() => {
    const now = prompting;
    const heading = rotateHeading;
    untrack(() => {
      if (now) {
        wasPrompting = true;
        heading?.focus({ preventScroll: true });
        return;
      }
      if (!wasPrompting) return;
      wasPrompting = false;
      const before = focusBefore;
      focusBefore = null;
      void tick().then(() => {
        if (prompting) return;
        if (focusable(before)) before.focus({ preventScroll: true });
        if (before !== null && document.activeElement === before) return;
        const gear = playEl?.querySelector<HTMLElement>("[data-settings-slot] button") ?? null;
        if (focusable(gear)) gear.focus({ preventScroll: true });
      });
    });
  });
</script>

{#snippet zone(part: "all" | "prompt" | "buttons" | "fast")}
  {#if session !== undefined && view !== undefined}
    <ActionZone
      {ui}
      {bar}
      {compact}
      {part}
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
  {/if}
{/snippet}

{#snippet seven(part: "all" | "line" | "chips" | "buttons")}
  {#if flow.kind === "sevenBuilding"}
    <SevenPanel
      seven={flow}
      {bar}
      {compact}
      {part}
      tray={ui.kind === "tray" ? ui : null}
      {missed}
      onpickSteps={(steps) => send({ t: "pickSteps", steps })}
      onundo={() => send({ t: "undoLast" })}
      oncancelAll={() => send({ t: "cancelAll" })}
      onconfirm={() => send({ t: "confirm" })}
      ontrayPick={pickTrayOption}
      ontrayClose={() => send({ t: "closeTray" })}
    />
  {/if}
{/snippet}

{#snippet pausedLine()}
  <!-- While a plate is up the prompt row (or the action zone) says only « Partie en pause ». -->
  <p class="paused-line" data-paused-prompt>{tableCopy.game.paused}</p>
{/snippet}

{#snippet hand()}
  {#if session !== undefined && view !== undefined}
    <HandFan
      hand={view.hand}
      mode={handMode}
      playability={verdicts}
      selected={selectedCard}
      {received}
      partner={{ color: PARTNER[session.human], name: session.names[PARTNER[session.human]] }}
      {concealed}
      pace={session.pace}
      {compact}
      board={stageEl}
      onpick={pickCard}
    />
  {/if}
{/snippet}

<main
  class="game"
  data-chrome={screen.chrome}
  style:--head-room={SCENE.headRoom}
  style:--board-ratio={SCENE.height / SCENE.width}
  style:--galet-bare={GALET_BARE}
>
  {#if startFailure}
    {fail(startFailure)}
  {:else if session?.failure}
    {fail(session.failure)}
  {/if}
  {#if prompting}
    <RotatePrompt bind:heading={rotateHeading} />
  {/if}
  <!-- Behind the invitation to turn the screen the whole game is kept, mounted, but not displayed and
       inert: no focus, no tap, nothing for a screen reader. -->
  <div class="play" class:away={prompting} data-game-play inert={prompting} bind:this={playEl}>
    {#if session !== undefined && render !== null && view !== undefined}
      <!-- Behind the end screen the game is out of reach: no focus, no tap, nothing for a screen reader. -->
      <div class="layout" data-layout inert={ended}>
        <div class="info">
          <InfoBar
            {render}
            human={session.human}
            names={session.names}
            thinking={session.thinking}
            form={bar ? "column" : compact ? "pill" : "row"}
            onabandon={online === undefined ? abandon : undefined}
            players={online !== undefined && onlineTable !== null
              ? { table: onlineTable, me: online.seat }
              : undefined}
          />
        </div>

        {#if compact}
          <!-- The top of the right strip: « Réglages », then « Avance rapide » while the computer plays. -->
          <div class="tools">
            <div class="gear" data-settings-slot>
              <SettingsButton onabandon={online === undefined ? abandon : undefined} />
            </div>
            <div class="fast" inert={plateUp}>
              {@render zone("fast")}
            </div>
          </div>
        {/if}

        <div class="stage" bind:this={stageEl} inert={plateUp}>
          <Board
            {k}
            {render}
            {discardTop}
            {burst}
            {flights}
            thinking={session.thinking}
            ontapis={() => (tapisOpen = true)}
          >
            {#snippet badges()}
              {#if onlineTable !== null}
                <SeatBadges {k} table={onlineTable} />
              {/if}
            {/snippet}
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
          <DealBanner {render} names={session.names} human={session.human} />
        </div>

        {#if flow.kind === "sevenBuilding" && compact}
          <!-- The 7 splitter in the compact mode: its line in the prompt row, the step chips in the
               left strip, its buttons in the right one. The region takes no box of its own. -->
          <section
            class="seven"
            inert={plateUp}
            data-seven-panel
            data-selected={flow.selected ?? ""}
            aria-label={copy.seven.title}
          >
            <div class="prompt-row">
              {@render seven("line")}
            </div>
            <div class="chips">
              {@render seven("chips")}
            </div>
            <div class="actions">
              {@render seven("buttons")}
            </div>
          </section>
        {:else if flow.kind === "sevenBuilding"}
          <!-- The 7 splitter replaces the action zone and the hand (UI-SPEC). -->
          <div class="seven" inert={plateUp}>
            {@render seven("all")}
          </div>
        {:else if compact}
          <!-- The prompt row over the board, then the state's buttons at the bottom of the right strip
               and the hand (or the « Lequel ? » chips) at the bottom of the left one. -->
          <div class="prompt-row">
            {#if plateUp}
              {@render pausedLine()}
            {:else}
              {@render zone("prompt")}
            {/if}
          </div>
          {#if ui.kind === "tray"}
            <div class="chips" inert={plateUp}>
              <PawnTray
                options={ui.options}
                part="chips"
                compact
                onpick={pickTrayOption}
                onclose={() => send({ t: "closeTray" })}
              />
            </div>
          {/if}
          <div class="actions" inert={plateUp}>
            {#if !plateUp}
              {@render zone("buttons")}
            {/if}
          </div>
          {#if ui.kind !== "tray"}
            <div class="hand" inert={plateUp}>
              {@render hand()}
            </div>
          {/if}
        {:else}
          <div class="action" inert={plateUp}>
            {#if plateUp}
              {@render pausedLine()}
            {:else}
              {@render zone("all")}
            {/if}
          </div>

          <div class="hand" inert={plateUp}>
            {@render hand()}
          </div>
        {/if}
      </div>

      {#if online !== undefined && onlineTable !== null}
        <TablePlate
          table={onlineTable}
          me={online.seat}
          offset={online.connection.serverOffset}
          board={boardEl}
          send={(frame) => online.connection.send(frame)}
          onhome={online.onhome}
        />
      {/if}

      {#if tapisOpen}
        <TapisSheet {render} names={session.names} onclose={() => (tapisOpen = false)} />
      {/if}

      {#if shortcutsOpen}
        <ShortcutsSheet opener={shortcutsOpener} onclose={() => (shortcutsOpen = false)} />
      {/if}

      {#if ended && render.winner !== null && endNames !== undefined}
        <EndScreen
          won={render.winner === teamOf(session.human)}
          winner={render.winner}
          score={endScore}
          names={endNames}
          stats={session.stats}
          onreplay={replay}
          onchange={changeColour}
        />
      {/if}
    {/if}
  </div>
</main>

<style>
  /*
   * The galet board (Romain's choice of 2026-10-14: « galet partout »): centred, never cropped;
   * --board-size is its width and --board-ratio its height over its width (0.5: the landscape galet
   * is the only board, « paysage obligatoire », from SCENE). --head-room of the width
   * (SCENE.headRoom) stays free above the board for the head of a lifted top-row knight, so
   * the height a board takes is (board ratio + head room) x its width. Safe-area insets are
   * subtracted from both axes. The page never scrolls (FX-01).
   *
   * Three modes (UI-SPEC addendum « Plateau galet », items 5 to 9, « à confirmer par Romain »), the
   * media queries being the very strings of ui/screen.svelte.ts (the store gives `data-chrome`):
   * - « bar », landscape from 960 x 600 (computers): the board across the width,
   *   min(100vw − 32 px − insets, (100dvh − 160 px − insets) / (ratio + head room), 1600 px), and
   *   under it one 160 px bar (--bar, the regular fan's box: 106 x 148 cards since plan 03-10, their
   *   top 10 px under the bar's top and their lower edge under the screen's) holding the
   *   info at the left (240 px), the hand in the middle and the action zone at the right (at least
   *   320 px); the 7 assistant takes the place of the hand and the action zone. About 1227 px wide
   *   at 1280 x 800, 920 at 1024 x 640, 1408 at 1440 x 900.
   * - « compact », every other landscape screen (a phone held sideways, a small window): the board
   *   on the full height under a 24 px prompt row, max(0, min(100vw − hand strip − 60 px − insets,
   *   (100dvh − 24 px − insets) / ratio)), with at the left a strip as wide as the hand's 03-10
   *   cards need (at least 60 px, plan 02-06c: Romain's « Plateau un peu réduit ») holding the info
   *   and the hand (one column over the galet's bare side), and a strip of at least 60 px at the
   *   right, « Avance rapide » and the state's buttons. About 618 px wide at 750 x 342, 701 at
   *   844 x 390, 351 at 480 x 320.
   * - « rotate », every screen taller than wide: only the invitation, « Tourne ton téléphone » (or
   *   « Élargis la fenêtre » on a computer). The game is kept behind it, mounted but not displayed
   *   (.play.away), so no layout rule serves a screen taller than wide.
   * In the bar the DOM order, and so the Tab order, is info, board, actions (or the 7), hand; in the
   * compact mode it is the info, « Avance rapide », the board, the 7's or the tray's chips, the
   * buttons, the hand.
   */

  /* « Partie en pause » in the prompt row (compact) or the action zone (bar), plan 02-06. */
  .paused-line {
    margin: 0;
    color: var(--creme);
    font-size: var(--label-size);
    font-weight: 700;
    line-height: 24px;
    text-align: center;
    white-space: nowrap;
  }

  .fast {
    display: contents;
  }

  /* The game's wrapper takes no box of its own; behind the invitation it is not displayed at all. */
  .play {
    display: contents;
  }

  .play.away {
    display: none;
  }

  .game {
    --inset-x: calc(env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px));
    --inset-y: calc(env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px));
    /* Its own formatting context: the outer margin of a layout stays inside the page. The screen's
       edges clip what runs past them (the hand's cards, plan 03-10): the page never scrolls. */
    display: flow-root;
    overflow: clip;
    min-height: 100%;
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
      env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  }

  /* What both landscape modes share: one grid of the screen's height; each mode places the zones. */
  .layout {
    display: grid;
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

  /* The prompt is centred in the zone, and a prompt that is longer than it scrolls here. */
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
  }

  /*
   * « compact », every other landscape screen (a phone held sideways, a small window; Romain's
   * « Plateau sur toute la hauteur » of 2026-10-15, plan 01-47). Three columns: the board between a
   * left strip of at least --hand-strip (the hand's cards at their 03-10 size, plan 02-06c: « Plateau
   * un peu réduit », 2026-10-17) and a right one of at least --strip; the strips share what the board
   * leaves, so in a window with spare width the board is centred, or moved right as far as the hand
   * needs, before it gets narrower. In the middle column the
   * --prompt-row over the board, the two kept together and centred in the height (a screen limited
   * by its width leaves the same room above and below them); the strips span the whole height. No
   * head room of its own: the prompt row is that room, a lifted top-row knight's head may rise into
   * it. In the left strip the info pill at the top and the hand (or the chips of « Lequel ? » or of
   * the 7) at the bottom; in the right one « Réglages » and « Avance rapide » at the top and the
   * state's buttons at the bottom. Nothing has a margin or a
   * padding, so the formula subtracts exactly what renders; each strip's bottom item is kept under
   * what stands at its top.
   */
  @media (orientation: landscape) and (max-width: 959.98px), (orientation: landscape) and (max-height: 599.98px) {
    .game {
      --strip: 60px;
      --strip-button: 58px;
      --prompt-row: 24px;
      /* The hand's target card: cornerCard of the strip's height (fan.ts, cornerTargetWidth). */
      --hand-card: min(
        80px,
        (100dvh - var(--inset-y) - 60px) * 5 / 21,
        max(40px, 100dvh - var(--inset-y) - 224px) * 5 / 7
      );
      /* The board limited by the height alone. */
      --board-tall: ((100dvh - var(--prompt-row) - var(--inset-y)) / var(--board-ratio));
      /* The left strip: the card, moved 6 px when selected, 2 px of margin and 1.5 px for the card's
         rounding, less the galet's bare side (--galet-bare of the board's width), whether the board
         is limited by the width (the first term) or by the height (the second); fan.ts,
         compactLayout. */
      --hand-strip: max(
        var(--strip),
        (var(--hand-card) + 9.5px - var(--galet-bare) * (100vw - var(--inset-x) - var(--strip))) /
          (1 - var(--galet-bare)),
        var(--hand-card) + 9.5px - var(--galet-bare) * var(--board-tall)
      );
      --board-size: max(
        0px,
        min(100vw - var(--hand-strip) - var(--strip) - var(--inset-x), var(--board-tall))
      );
    }

    .layout {
      max-width: none;
      width: 100%;
      height: calc(100dvh - var(--inset-y));
      margin: 0;
      padding: 0;
      gap: 0;
      grid-template-columns: minmax(var(--hand-strip), 1fr) var(--board-size) minmax(var(--strip), 1fr);
      grid-template-rows: minmax(0, 1fr) var(--prompt-row) auto minmax(0, 1fr);
      grid-template-areas:
        "left . right"
        "left prompt right"
        "left stage right"
        "left . right";
      align-content: stretch;
    }

    /* The top of the left strip: the info pill. */
    .info {
      grid-area: left;
      align-self: start;
      justify-self: center;
    }

    /* The top of the right strip: the gear, then « Avance rapide ». */
    .tools {
      grid-area: right;
      align-self: start;
      justify-self: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-xs);
    }

    .prompt-row {
      grid-area: prompt;
      min-width: 0;
      min-height: 0;
    }

    .stage {
      grid-area: stage;
      align-self: center;
      min-width: 0;
      --head-room: 0;
    }

    /* The bottom of the right strip, under the gear and « Avance rapide » (two 44 px targets). */
    .actions {
      grid-area: right;
      align-self: end;
      justify-self: center;
      min-height: 0;
      max-height: calc(100% - 2 * var(--touch) - 3 * var(--space-xs));
    }

    /* The hand over the whole left strip, in front of the board: its cards stand from the strip's
       bottom up to under the info (44 px), one column inside the strip and over the galet's bare
       side (plans 03-10, 02-06b, 02-06c); the box lets every other tap through. */
    .hand {
      grid-area: left;
      align-self: stretch;
      justify-self: stretch;
      position: relative;
      z-index: 2;
      min-width: 0;
      min-height: 0;
      pointer-events: none;
    }

    /* The bottom of the left strip, under the info (44 px). */
    .chips {
      grid-area: left;
      align-self: end;
      justify-self: stretch;
      min-width: 0;
      min-height: 0;
      max-height: calc(100% - var(--touch) - 2 * var(--space-xs));
    }

    .chips {
      overflow-y: auto;
      overscroll-behavior: contain;
      padding-bottom: var(--space-xs);
    }

    /* The 7's region has no box: its three parts are placed like the others. */
    .seven {
      display: contents;
    }
  }

  /*
   * « bar », landscape from 960 x 600 (computers): the board centred across the width, then one
   * walnut band of exactly --bar across the screen with the info, the hand and the action zone.
   */
  @media (orientation: landscape) and (min-width: 960px) and (min-height: 600px) {
    .game {
      --bar: 160px;
      --board-size: max(
        0px,
        min(
          100vw - 32px - var(--inset-x),
          (100dvh - var(--bar) - var(--inset-y)) / (var(--board-ratio) + var(--head-room)),
          1600px
        )
      );
    }

    .layout {
      max-width: none;
      width: 100%;
      height: calc(100dvh - var(--inset-y));
      margin: 0;
      padding: 0 var(--space-md);
      column-gap: var(--space-md);
      grid-template-columns: 240px minmax(336px, 1fr) minmax(320px, 400px);
      grid-template-areas:
        "stage stage stage"
        "info hand action";
      grid-template-rows: minmax(0, 1fr) var(--bar);
      align-content: stretch;
      /* The band: the bar's row, from one edge of the screen to the other. */
      background: linear-gradient(
        to top,
        var(--bois-sombre) var(--bar),
        transparent var(--bar)
      );
    }

    .stage {
      align-self: center;
    }

    .info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
    }

    /* The zone fills its column; a prompt longer than it scrolls inside. */
    .action {
      justify-content: center;
      min-height: 0;
      max-height: none;
    }

    .hand {
      align-self: end;
      min-width: 0;
      padding: 0;
    }

    .seven {
      grid-row: hand;
      grid-column: hand / action;
      min-width: 0;
      min-height: 0;
    }
  }
</style>
