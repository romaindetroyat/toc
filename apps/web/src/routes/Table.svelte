<script lang="ts">
  import { COLORS, type Color } from "@toc/engine";
  import { CLOSE_GONE, isTableId } from "@toc/protocol";
  import { unlock } from "../audio/engine.ts";
  import type { ControllerFactory } from "../game/session.svelte.ts";
  import { accueil } from "../i18n/fr/accueil.ts";
  import { table as copy } from "../i18n/fr/table.ts";
  import { seats as seatCopy } from "../i18n/fr/seats.ts";
  import { browserApi, tableHealth, tableSummary } from "../net/api.ts";
  import { connectTable, type TableConnection } from "../net/connection.svelte.ts";
  import { loadDevice, pageStorage, saveName } from "../net/device.ts";
  import { BANNER_MS, closeNotice } from "../net/plate.ts";
  import { createRemoteGame } from "../net/remoteGame.ts";
  import { forgetTable, rememberTable } from "../net/tables.ts";
  import NamePrompt from "../ui/NamePrompt.svelte";
  import Notice from "../ui/Notice.svelte";
  import ReclaimDialog from "../ui/ReclaimDialog.svelte";
  import { showToast } from "../ui/toast.svelte.ts";
  import Game from "./Game.svelte";
  import WaitingRoom from "./WaitingRoom.svelte";

  type Props = { id: string };

  let { id }: Props = $props();

  // The online table (02-UI-SPEC « Screens and routes », 4): first name → connecting → waiting room or
  // game, or a notice. Plans 02-04 to 02-09 grow each screen; this is the tracer's path through them.
  // Plan 02-07: the notices of a connection that ended (4001 « Partie ouverte ailleurs » with « Jouer
  // ici », a new socket that closes the other one; 4002; 4004; a server error « La table ne répond
  // pas »), « De retour à la table. » after a drop, « Quitter la table » in the game, and the reclaim
  // of one's own seat: « C’est moi, {Nom} » under « La partie a déjà commencé », the request sent or
  // refused, and the chef de table's dialog.

  const storage = pageStorage();
  let device = $state(loadDevice(storage));
  let connection = $state.raw<TableConnection | null>(null);

  const valid = $derived(isTableId(id));

  // No network when the link is opened: the « Pas de connexion » notice, « Réessayer » tries again.
  let offline = $state(!browserApi.online());
  let attempt = $state(0);

  function retry() {
    offline = !browserApi.online();
    attempt++;
  }

  // Before the first name is typed: who invites (GET /api/tables/:id, D-02), or a table that is gone.
  let invitedBy = $state<string | null>(null);
  let gone = $state(false);

  $effect(() => {
    if (!valid || device.name !== null) return;
    let live = true;
    void tableSummary(id).then((result) => {
      if (!live) return;
      if (result === "gone") gone = true;
      else if (result !== "unknown") invitedBy = result.creatorName;
    });
    return () => {
      live = false;
    };
  });

  $effect(() => {
    const name = device.name;
    // « Réessayer » opens a new connection.
    void attempt;
    if (!valid || name === null || offline) return;
    const opened = connectTable(id, { token: device.token, name });
    connection = opened;
    reclaim = "idle";
    requests = [];
    health = null;
    const unsubscribe = opened.onFrame((frame) => {
      if (frame.t === "welcome") {
        // A hello that took the seat back from the computer (plan 02-06): told to this device only.
        if (frame.regained === true) showToast(copy.game.notices.youTookBack);
        // Back after a drop long enough to show the banner (plan 02-07).
        else if ((opened.lastDownMs ?? 0) >= BANNER_MS) showToast(copy.game.connection.back);
        if (frame.you.seat !== null) reclaim = "idle";
      } else if (frame.t === "reclaimResult") {
        if (!frame.accepted) reclaim = "refused";
      } else if (frame.t === "reclaimRequest") {
        requests = [
          ...requests.filter((each) => each.seat !== frame.seat),
          { seat: frame.seat, name: frame.name },
        ];
      }
    });
    return () => {
      unsubscribe();
      opened.close();
      connection = null;
    };
  });

  function rememberName(name: string) {
    const saved = saveName(storage, name);
    if (saved !== null) device = saved;
  }

  function home() {
    location.hash = "#/";
  }

  const you = $derived(connection?.you ?? null);
  const info = $derived(connection?.table ?? null);
  const closeCode = $derived(connection?.closeCode ?? null);

  /** A connection that does not open: the table's health, asked once it is slow (plan 02-07). */
  let health = $state<"gone" | "server" | "ok" | "unknown" | null>(null);
  const ended = $derived(
    closeNotice(closeCode, (connection?.serverError ?? false) || health === "server"),
  );

  // --- The reclaim of one's own seat (D-12, plan 02-07) ---
  /** This device's request: none yet, sent (« Demande envoyée »), refused (« Demande refusée »). */
  let reclaim = $state<"idle" | "sent" | "refused">("idle");
  /** For the chef de table: the requests received (the asker's typed first name per seat). */
  let requests = $state.raw<{ seat: Color; name: string }[]>([]);

  /** The seats one may ask for: a person's seat whose player is offline. */
  const reclaimable = $derived(
    info === null
      ? []
      : COLORS.filter((color) => info.seats[color].kind === "human" && !info.seats[color].online),
  );

  function askSeat(seat: Color) {
    unlock();
    if (connection?.send({ t: "reclaim", seat }) === true) reclaim = "sent";
  }

  /** The request the chef de table answers now: the first whose seat's player is still offline. */
  const request = $derived.by(() => {
    if (you?.host !== true || info === null) return null;
    return (
      requests.find(
        (each) => info.seats[each.seat].kind === "human" && !info.seats[each.seat].online,
      ) ?? null
    );
  });

  function answer(seat: Color, accept: boolean) {
    connection?.send({ t: "reclaimAnswer", seat, accept });
    requests = requests.filter((each) => each.seat !== seat);
  }

  const creatorName = $derived(info?.creatorName ?? "");

  // The first welcome adds the table to « Mes parties en cours » on this device, and a change of this
  // device's seat updates it (D-06).
  const seatNow = $derived(you === null ? undefined : you.seat);
  $effect(() => {
    if (seatNow === undefined) return;
    rememberTable(storage, id, seatNow, Date.now());
  });

  /** What the screen shows now. */
  const screenState = $derived.by(() => {
    if (!valid || closeCode === CLOSE_GONE || gone || health === "gone") {
      return "introuvable" as const;
    }
    if (device.name === null) return "prenom" as const;
    if (offline) return "horsligne" as const;
    if (ended !== null) return ended;
    if (connection === null || you === null || info === null) return "connexion" as const;
    if (info.status === "lobby") return "salle" as const;
    if (you.seat === null) {
      if (reclaim === "sent") return "demande" as const;
      if (reclaim === "refused") return "refusee" as const;
      return "commencee" as const;
    }
    // The game screen mounts once the server's first events (or a welcome with the view) are in.
    if (connection.view === null) return "connexion" as const;
    return "partie" as const;
  });

  /** The online game's controller over this connection, built by the game screen's session. */
  const makeController: ControllerFactory = (director) => {
    if (connection === null) throw new Error("no connection");
    return createRemoteGame(connection, director);
  };

  /** The link anyone opens the table with (the invite sheet, D-02): no query, no route options. */
  const tableLink = $derived(`${location.origin}/#/table/${id}`);

  /**
   * « Quitter la table » in a game (plan 02-07): the person goes offline (the others' pause), the
   * socket closes with 1000, the home; the table stays in « Mes parties en cours ».
   */
  function leaveGame() {
    unlock();
    connection?.send({ t: "leave" });
    connection?.close();
    home();
  }

  /** « Quitter la table » in the waiting room: the seat is freed, the table leaves this device's list. */
  function leave() {
    unlock();
    connection?.send({ t: "leave" });
    forgetTable(storage, id);
    connection?.close();
    home();
  }

  /** « Connexion à la table… » for more than 10 s: the slow line and a way home. */
  const SLOW_MS = 10_000;
  let slow = $state(false);

  $effect(() => {
    if (screenState !== "connexion") {
      slow = false;
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      slow = true;
      // Still not open: is the table gone, or is the server failing (« La table ne répond pas »)?
      void tableHealth(id).then((result) => {
        if (live) health = result;
      });
    }, SLOW_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  });
</script>

<svelte:window ononline={() => offline && retry()} />

{#if screenState === "prenom"}
  <NamePrompt
    context={invitedBy !== null ? accueil.name.invitedBy(invitedBy) : accueil.name.invited}
    onsubmit={rememberName}
    onback={home}
  />
{:else if screenState === "partie" && you?.seat && connection !== null}
  <!-- A paused or saved game stays on the game screen, under its plate (plan 02-06). -->
  <Game online={{ makeController, seat: you.seat, connection, onhome: home, onleave: leaveGame }} />
  {#if request !== null && info !== null}
    {@const asked = request}
    <ReclaimDialog
      seat={asked.seat}
      typed={asked.name}
      holder={info.seats[asked.seat].name ?? seatCopy[asked.seat].name}
      onanswer={(accept) => answer(asked.seat, accept)}
    />
  {/if}
{:else if screenState === "salle" && info !== null && you !== null && connection !== null && device.name !== null}
  <WaitingRoom
    {id}
    link={tableLink}
    {connection}
    table={info}
    {you}
    myName={device.name}
    onleave={leave}
    onhome={home}
  />
{:else if screenState === "introuvable"}
  <Notice
    kind="introuvable"
    heading={copy.notFound.heading}
    body={copy.notFound.body}
    primary={{ label: copy.home, run: home }}
  />
{:else if screenState === "ailleurs"}
  <Notice
    kind="ailleurs"
    heading={copy.elsewhere.heading}
    body={copy.elsewhere.body}
    primary={{ label: copy.elsewhere.here, run: retry }}
    secondary={{ label: copy.home, run: home }}
  />
{:else if screenState === "version"}
  <Notice
    kind="version"
    heading={copy.version.heading}
    body={copy.version.body}
    primary={{ label: copy.version.reload, run: () => location.reload() }}
  />
{:else if screenState === "horsligne"}
  <Notice
    kind="horsligne"
    heading={copy.offline.heading}
    body={copy.offline.body}
    primary={{ label: copy.offline.retry, run: retry }}
    secondary={{ label: copy.home, run: home }}
  />
{:else if screenState === "serveur"}
  <Notice
    kind="serveur"
    heading={copy.server.heading}
    body={copy.server.body}
    primary={{ label: copy.server.retry, run: retry }}
    secondary={{ label: copy.home, run: home }}
  />
{:else if screenState === "commencee"}
  <Notice
    kind="commencee"
    heading={copy.started.heading}
    body={copy.started.body}
    secondary={{ label: copy.home, run: home }}
  >
    {#if reclaimable.length > 0}
      <section class="reclaim" aria-labelledby="reclaim-heading" data-reclaim>
        <h2 id="reclaim-heading" class="t-heading">{copy.reclaim.heading}</h2>
        <p class="t-body">{copy.reclaim.body(creatorName)}</p>
        <div class="seats">
          {#each reclaimable as color (color)}
            <button
              type="button"
              class="btn btn-secondary"
              data-reclaim-seat={color}
              onclick={() => askSeat(color)}
            >
              {copy.reclaim.itsMe(info?.seats[color].name ?? seatCopy[color].name)}
            </button>
          {/each}
        </div>
      </section>
    {/if}
  </Notice>
{:else if screenState === "demande"}
  <Notice
    kind="demande"
    heading={copy.reclaim.sent.heading}
    body={copy.reclaim.sent.body(creatorName)}
    secondary={{ label: copy.home, run: home }}
  />
{:else if screenState === "refusee"}
  <Notice
    kind="refusee"
    heading={copy.reclaim.refused.heading}
    body={copy.reclaim.refused.body(creatorName)}
    primary={{ label: copy.home, run: home }}
  />
{:else}
  <Notice
    kind={screenState}
    heading={copy.connecting}
    live
    secondary={slow ? { label: copy.home, run: home } : undefined}
  >
    {#if slow}
      <p class="t-body slow" role="status" data-connecting-slow>{copy.slow}</p>
    {/if}
  </Notice>
{/if}

<style>
  .reclaim {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    width: min(480px, 100%);
  }

  .reclaim h2,
  .reclaim p {
    margin: 0;
  }

  .reclaim p {
    color: var(--creme-attenuee);
  }

  .seats {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
    width: min(320px, 100%);
  }

  .slow {
    margin: 0;
    color: var(--creme-attenuee);
  }
</style>
