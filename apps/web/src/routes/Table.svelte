<script lang="ts">
  import { CLOSE_ELSEWHERE, CLOSE_GONE, CLOSE_VERSION, isTableId } from "@toc/protocol";
  import { unlock } from "../audio/engine.ts";
  import type { ControllerFactory } from "../game/session.svelte.ts";
  import { accueil } from "../i18n/fr/accueil.ts";
  import { table as copy } from "../i18n/fr/table.ts";
  import { browserApi, tableSummary } from "../net/api.ts";
  import { connectTable, type TableConnection } from "../net/connection.svelte.ts";
  import { loadDevice, pageStorage, saveName } from "../net/device.ts";
  import { createRemoteGame } from "../net/remoteGame.ts";
  import { forgetTable, rememberTable } from "../net/tables.ts";
  import NamePrompt from "../ui/NamePrompt.svelte";
  import Notice from "../ui/Notice.svelte";
  import Game from "./Game.svelte";
  import WaitingRoom from "./WaitingRoom.svelte";

  type Props = { id: string };

  let { id }: Props = $props();

  // The online table (02-UI-SPEC « Screens and routes », 4): first name → connecting → waiting room or
  // game, or a notice. Plans 02-04 to 02-09 grow each screen; this is the tracer's path through them.

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
    return () => {
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

  // The first welcome adds the table to « Mes parties en cours » on this device, and a change of this
  // device's seat updates it (D-06).
  const seatNow = $derived(you === null ? undefined : you.seat);
  $effect(() => {
    if (seatNow === undefined) return;
    rememberTable(storage, id, seatNow, Date.now());
  });

  /** What the screen shows now. */
  const screenState = $derived.by(() => {
    if (!valid || closeCode === CLOSE_GONE || gone) return "introuvable" as const;
    if (device.name === null) return "prenom" as const;
    if (offline) return "horsligne" as const;
    if (closeCode === CLOSE_ELSEWHERE) return "ailleurs" as const;
    if (closeCode === CLOSE_VERSION) return "version" as const;
    if (connection === null || you === null || info === null) return "connexion" as const;
    if (info.status === "lobby") return "salle" as const;
    if (you.seat === null) return "commencee" as const;
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
    const timer = setTimeout(() => {
      slow = true;
    }, SLOW_MS);
    return () => clearTimeout(timer);
  });
</script>

<svelte:window ononline={() => offline && retry()} />

{#if screenState === "prenom"}
  <NamePrompt
    context={invitedBy !== null ? accueil.name.invitedBy(invitedBy) : accueil.name.invited}
    onsubmit={rememberName}
    onback={home}
  />
{:else if screenState === "partie" && you?.seat}
  <Game online={{ makeController, seat: you.seat }} />
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
    primary={{ label: copy.elsewhere.here, run: () => location.reload() }}
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
{:else if screenState === "commencee"}
  <Notice
    kind="commencee"
    heading={copy.started.heading}
    body={copy.started.body}
    secondary={{ label: copy.home, run: home }}
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
  .slow {
    margin: 0;
    color: var(--creme-attenuee);
  }
</style>
