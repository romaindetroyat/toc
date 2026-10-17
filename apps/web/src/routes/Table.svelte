<script lang="ts">
  import { COLORS, type Color } from "@toc/engine";
  import { CLOSE_ELSEWHERE, CLOSE_GONE, CLOSE_VERSION, isTableId } from "@toc/protocol";
  import { unlock } from "../audio/engine.ts";
  import type { ControllerFactory } from "../game/session.svelte.ts";
  import { accueil } from "../i18n/fr/accueil.ts";
  import { bots } from "../i18n/fr/bots.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import { table as copy } from "../i18n/fr/table.ts";
  import { browserApi, tableSummary } from "../net/api.ts";
  import { connectTable, type TableConnection } from "../net/connection.svelte.ts";
  import { loadDevice, pageStorage, saveName } from "../net/device.ts";
  import { createRemoteGame } from "../net/remoteGame.ts";
  import NamePrompt from "../ui/NamePrompt.svelte";
  import SeatChip from "../ui/SeatChip.svelte";
  import Game from "./Game.svelte";

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

  type SeatState = "you" | "free" | "human";

  function seatState(color: Color): SeatState {
    if (you?.seat === color) return "you";
    return info?.seats[color].kind === "human" ? "human" : "free";
  }

  function seatName(color: Color): string {
    const seat = info?.seats[color];
    return seat?.kind === "human" && seat.name !== null ? seat.name : copy.lobby.computer;
  }

  function seatStatus(color: Color): string {
    const seat = info?.seats[color];
    if (seat === undefined) return "";
    if (seatState(color) === "you") return copy.lobby.you;
    if (seat.kind === "human") return seat.online ? copy.lobby.online : copy.lobby.offline;
    return bots.levels[seat.level];
  }

  function seatLabel(color: Color): string {
    const colour = seats[color].name;
    const state = seatState(color);
    if (state === "you") return copy.lobby.ownSeat(colour);
    if (state === "human") return copy.lobby.otherSeat(colour, seatName(color), seatStatus(color));
    return copy.lobby.takeSeat(colour, seatStatus(color));
  }

  function sit(color: Color) {
    unlock();
    if (seatState(color) !== "free") return;
    connection?.send({ t: "sit", seat: color });
  }

  function start() {
    unlock();
    connection?.send({ t: "start" });
  }

  const creator = $derived(info?.creatorName ?? "");

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
{:else if screenState === "salle" && info !== null}
  <main class="room" data-waiting-room>
    <section class="seats">
      <h1 class="t-heading heading">{copy.lobby.heading(creator)}</h1>
      <div class="grid">
        {#each COLORS as color (color)}
          {@const state = seatState(color)}
          <button
            type="button"
            class="tile"
            class:mine={state === "you"}
            class:held={state === "human"}
            data-seat-tile={color}
            data-seat-state={state}
            aria-label={seatLabel(color)}
            aria-disabled={state !== "free"}
            onclick={() => sit(color)}
          >
            <SeatChip {color} />
            <span class="t-label name">
              {seatName(color)}
              {#if info.host === color}<span class="sr-only">, {copy.lobby.host}</span>{/if}
            </span>
            <span class="t-label status">{seatStatus(color)}</span>
          </button>
        {/each}
      </div>
    </section>
    <section class="side">
      {#if you?.host && you.seat !== null}
        <button type="button" class="btn btn-primary" onclick={start}>{copy.lobby.start}</button>
      {:else if you?.host}
        <h2 class="t-heading">{copy.lobby.chooseHeading}</h2>
        <p class="t-body">{copy.lobby.chooseBody}</p>
        <p class="t-body muted">{copy.lobby.hostUnseated}</p>
      {:else if you?.seat !== null}
        <h2 class="t-heading">{copy.lobby.waitingHeading}</h2>
        <p class="t-body">{copy.lobby.waitingBody(creator)}</p>
      {:else}
        <h2 class="t-heading">{copy.lobby.chooseHeading}</h2>
        <p class="t-body">{copy.lobby.chooseBody}</p>
      {/if}
    </section>
  </main>
{:else}
  <main class="notice" data-notice={screenState}>
    {#if screenState === "introuvable"}
      <h1 class="t-heading">{copy.notFound.heading}</h1>
      <p class="t-body">{copy.notFound.body}</p>
      <button type="button" class="btn btn-primary" onclick={home}>{copy.home}</button>
    {:else if screenState === "ailleurs"}
      <h1 class="t-heading">{copy.elsewhere.heading}</h1>
      <p class="t-body">{copy.elsewhere.body}</p>
      <button type="button" class="btn btn-primary" onclick={() => location.reload()}>
        {copy.elsewhere.here}
      </button>
      <button type="button" class="btn btn-secondary" onclick={home}>{copy.home}</button>
    {:else if screenState === "version"}
      <h1 class="t-heading">{copy.version.heading}</h1>
      <p class="t-body">{copy.version.body}</p>
      <button type="button" class="btn btn-primary" onclick={() => location.reload()}>
        {copy.version.reload}
      </button>
    {:else if screenState === "horsligne"}
      <h1 class="t-heading">{copy.offline.heading}</h1>
      <p class="t-body">{copy.offline.body}</p>
      <button type="button" class="btn btn-primary" onclick={retry}>{copy.offline.retry}</button>
      <button type="button" class="btn btn-secondary" onclick={home}>{copy.home}</button>
    {:else if screenState === "commencee"}
      <h1 class="t-heading">{copy.started.heading}</h1>
      <p class="t-body">{copy.started.body}</p>
      <button type="button" class="btn btn-secondary" onclick={home}>{copy.home}</button>
    {:else}
      <h1 class="t-heading" aria-live="polite">{copy.connecting}</h1>
      {#if slow}
        <p class="t-body" role="status" data-connecting-slow>{copy.slow}</p>
        <button type="button" class="btn btn-secondary" onclick={home}>{copy.home}</button>
      {/if}
    {/if}
  </main>
{/if}

<style>
  .notice {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    min-height: 100dvh;
    padding: var(--space-lg);
    text-align: center;
  }

  .notice h1,
  .notice p,
  .side h2,
  .side p {
    margin: 0;
  }

  .notice p {
    max-width: 480px;
    color: var(--creme-attenuee);
  }

  .room {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--space-xl);
    min-height: 100dvh;
    padding: calc(var(--space-md) + env(safe-area-inset-top)) calc(var(--space-md) + env(safe-area-inset-right))
      calc(var(--space-md) + env(safe-area-inset-bottom)) calc(var(--space-md) + env(safe-area-inset-left));
  }

  .heading {
    margin: 0 0 var(--space-md);
    max-width: 288px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* COLORS in reading order, 2 x 2: each column is a team (Bleu + Rouge, Jaune + Vert). */
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 136px);
    gap: var(--space-md);
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
    min-height: 96px;
    padding: 12px;
    border: 2px solid color-mix(in srgb, var(--noyer) 30%, transparent);
    border-radius: var(--radius-button);
    background: var(--chene);
    color: var(--noyer);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .tile.mine {
    outline: 3px solid var(--ambre);
    outline-offset: 2px;
  }

  .tile.held {
    cursor: default;
  }

  .tile:focus-visible {
    outline: 3px solid var(--ambre);
    outline-offset: 2px;
  }

  .name {
    max-width: 100%;
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status {
    opacity: 0.8;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    width: min(320px, 100%);
  }

  .muted {
    color: var(--creme-attenuee);
  }

  /* A phone held sideways: smaller tiles, the two columns closer. */
  @media (max-height: 500px) {
    .room {
      gap: var(--space-md);
    }

    .grid {
      grid-template-columns: repeat(2, 120px);
      gap: var(--space-sm);
    }

    .tile {
      min-height: 88px;
      padding: var(--space-sm);
    }
  }
</style>
