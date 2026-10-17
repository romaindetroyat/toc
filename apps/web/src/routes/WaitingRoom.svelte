<script lang="ts">
  import { COLORS, type Color, PARTNER } from "@toc/engine";
  import type { TablePublic, You } from "@toc/protocol";
  import { unlock } from "../audio/engine.ts";
  import { bots } from "../i18n/fr/bots.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import { table as copy } from "../i18n/fr/table.ts";
  import type { TableConnection } from "../net/connection.svelte.ts";
  import { tableNotices } from "../net/notices.ts";
  import ConfirmDialog from "../ui/ConfirmDialog.svelte";
  import InviteSheet, { takeNewTable } from "../ui/InviteSheet.svelte";
  import MoveSheet from "../ui/MoveSheet.svelte";
  import RotatePrompt from "../ui/RotatePrompt.svelte";
  import SeatTile from "../ui/SeatTile.svelte";
  import SettingsButton from "../ui/SettingsButton.svelte";
  import { screen } from "../ui/screen.svelte.ts";
  import StrengthPicker from "../ui/StrengthPicker.svelte";
  import { showToast } from "../ui/toast.svelte.ts";

  // The waiting room (02-UI-SPEC « Waiting room », D-03): the 2 x 2 grid of seats (Bleu Jaune / Rouge
  // Vert, each column a team), « Libérer ma place », and a right column that depends on who looks: the
  // creator sets each free seat's strength and starts; the others wait; whoever has no seat is asked to
  // take one, or told the table is full. The server checks every command (host only, lobby only).
  // Layouts as the solo setup (Launch.svelte): computer, two columns from 640 wide, one scrolling column
  // with the action row in a sticky band; « Tourne ton téléphone » when held upright.
  type Props = {
    /** The table's id and the link anyone opens it with (« Inviter »). */
    id: string;
    link: string;
    connection: TableConnection;
    table: TablePublic;
    you: You;
    /** This device's first name (its own arrival is not announced to itself). */
    myName: string;
    /** « Quitter la table », confirmed in « Réglages ». */
    onleave: () => void;
    /** « Retour à l’accueil » when the table is full. */
    onhome: () => void;
  };

  let { id, link, connection, table, you, myName, onleave, onhome }: Props = $props();

  type Layout = "computer" | "two" | "one";
  const TWO_COLUMNS_FROM = 640;
  let width = $state(typeof window === "undefined" ? 1280 : window.innerWidth);
  const rotate = $derived(screen.chrome === "rotate");
  const layout = $derived<Layout>(
    screen.chrome === "bar" ? "computer" : width >= TWO_COLUMNS_FROM ? "two" : "one",
  );

  const mySeat = $derived(you.seat);
  const host = $derived(you.host);
  const creator = $derived(table.creatorName ?? "");
  const partnerSeat = $derived(mySeat === null ? null : PARTNER[mySeat]);
  const freeSeats = $derived(COLORS.filter((color) => table.seats[color].kind !== "human"));
  const people = $derived(COLORS.length - freeSeats.length);
  const full = $derived(freeSeats.length === 0);

  /** The people without a seat other than this device (its own name once, when it has no seat). */
  const unseatedOthers = $derived.by(() => {
    const names = [...table.unseated];
    if (mySeat === null) {
      const at = names.indexOf(myName);
      if (at !== -1) names.splice(at, 1);
    }
    return names;
  });

  type Viewer = "host" | "hostUnseated" | "waiting" | "choose" | "full";
  const viewer = $derived<Viewer>(
    mySeat === null && full
      ? "full"
      : host
        ? mySeat === null
          ? "hostUnseated"
          : "host"
        : mySeat === null
          ? "choose"
          : "waiting",
  );

  // --- Commands (each tap unlocks the audio, 02-UI-SPEC « Audio unlock ») ---

  /** This device asked for its own change of seat: the « changed your place » toast is not for it. */
  let asked = false;

  function sit(color: Color) {
    unlock();
    asked = true;
    connection.send({ t: "sit", seat: color });
  }

  function stand() {
    unlock();
    asked = true;
    connection.send({ t: "stand" });
  }

  function setLevel(color: Color, level: 1 | 2 | 3 | 4 | 5) {
    unlock();
    connection.send({ t: "level", seat: color, level });
  }

  let moving = $state<Color | null>(null);
  let tiles = $state<Record<Color, HTMLElement | null>>({
    bleu: null,
    jaune: null,
    rouge: null,
    vert: null,
  });

  function move(from: Color, to: Color) {
    unlock();
    connection.send({ t: "move", who: from, to });
  }

  /** What a tap on a seat does here, or null (not a button). */
  function pickFor(color: Color): (() => void) | null {
    const seat = table.seats[color];
    if (color === mySeat) return null;
    if (seat.kind !== "human") return () => sit(color);
    if (host) {
      return () => {
        unlock();
        moving = color;
      };
    }
    return null;
  }

  let confirmStart = $state(false);
  let startButton = $state<HTMLButtonElement | null>(null);

  function start() {
    unlock();
    if (unseatedOthers.length > 0) {
      confirmStart = true;
      return;
    }
    connection.send({ t: "start" });
  }

  function startAnyway() {
    confirmStart = false;
    unlock();
    connection.send({ t: "start" });
  }

  let inviteOpen = $state(false);
  let inviteButton = $state<HTMLButtonElement | null>(null);

  function invite() {
    unlock();
    inviteOpen = true;
  }

  // Right after the creation the sheet opens by itself, once, for the creator (D-02).
  $effect(() => {
    if (you.host && takeNewTable(id)) inviteOpen = true;
  });

  // --- Toasts: who arrived, who left, and where the creator moved this device (tableNotices) ---

  let prevTable: TablePublic | null = null;
  let prevSeat: Color | null = null;

  $effect(() => {
    const now = table;
    const seat = you.seat;
    const notices = tableNotices(prevTable, now, {
      name: myName,
      was: prevSeat,
      seat,
      host: you.host,
      asked,
    });
    if (seat !== prevSeat) asked = false;
    prevTable = now;
    prevSeat = seat;
    const first = notices[0];
    if (first !== undefined) showToast(first);
  });

  const startNames = $derived(copy.names(unseatedOthers));
</script>

<svelte:window bind:innerWidth={width} />

<main
  class="room"
  data-layout={layout}
  data-waiting-room
  data-viewer={viewer}
  inert={rotate}
  aria-hidden={rotate ? "true" : undefined}
>
  <div class="columns">
    <section class="seats-column">
      <h1 class="t-heading heading" title={copy.lobby.heading(creator)}>
        {copy.lobby.heading(creator)}
      </h1>
      <div class="grid">
        {#each COLORS as color (color)}
          <SeatTile
            {color}
            seat={table.seats[color]}
            mine={mySeat === color}
            host={table.host === color}
            partner={partnerSeat === color}
            large={layout === "computer"}
            onpick={pickFor(color)}
            moveLabel={host && color !== mySeat && table.seats[color].kind === "human"}
            bind:el={tiles[color]}
          />
        {/each}
      </div>
      {#if mySeat !== null}
        <button type="button" class="btn btn-text stand" data-stand onclick={stand}>
          {copy.lobby.stand}
        </button>
      {/if}
    </section>

    <section class="side" aria-labelledby="room-side-heading">
      {#if viewer === "full"}
        <div class="block" data-notice="complete">
          <h2 id="room-side-heading" class="t-heading">{copy.lobby.full.heading}</h2>
          <p class="t-body muted">{copy.lobby.full.body}</p>
        </div>
      {:else if viewer === "host"}
        <h2 id="room-side-heading" class="t-heading">{bots.heading}</h2>
        {#if freeSeats.length > 0}
          <div class="rows">
            {#each freeSeats as color (color)}
              <StrengthPicker
                {color}
                role="seat"
                value={table.seats[color].level}
                onchange={(level) => setLevel(color, level)}
              />
            {/each}
          </div>
        {:else}
          <p class="t-body">{copy.lobby.noComputer}</p>
        {/if}
        <p class="t-body muted count" class:sr-only={layout !== "computer"}>
          {copy.lobby.count(people, freeSeats.length)}
        </p>
      {:else if viewer === "hostUnseated" || viewer === "choose"}
        <h2 id="room-side-heading" class="t-heading">{copy.lobby.chooseHeading}</h2>
        <p class="t-body">{copy.lobby.chooseBody}</p>
        {#if viewer === "hostUnseated"}
          <p class="t-body muted">{copy.lobby.hostUnseated}</p>
        {/if}
      {:else}
        <h2 id="room-side-heading" class="t-heading">{copy.lobby.waitingHeading}</h2>
        <p class="t-body">{copy.lobby.waitingBody(creator)}</p>
      {/if}
      {#if !host && viewer !== "full" && freeSeats.length > 0}
        <ul class="lines">
          {#each freeSeats as color (color)}
            <li class="t-body" data-computer-line={color}>
              {copy.lobby.computerLine(seats[color].name, bots.levels[table.seats[color].level])}
            </li>
          {/each}
        </ul>
      {/if}
      {#if unseatedOthers.length > 0}
        <p class="t-body muted" data-unseated>{copy.lobby.unseated(unseatedOthers)}</p>
      {/if}

      <!-- DOM order = visual order: [Réglages] [Inviter] [Lancer la partie] (plan 02-08 adds
           « Messages » after « Réglages »). -->
      <div class="actions" data-room-actions>
        <div class="gear" data-settings-slot><SettingsButton online {onleave} /></div>
        {#if viewer === "full"}
          <button type="button" class="btn btn-secondary" onclick={onhome}>{copy.home}</button>
        {:else}
          <button
            type="button"
            class="btn btn-secondary"
            data-invite
            bind:this={inviteButton}
            onclick={invite}
          >
            {copy.lobby.invite}
          </button>
        {/if}
        {#if host}
          <button
            type="button"
            class="btn btn-primary start"
            disabled={mySeat === null}
            bind:this={startButton}
            onclick={start}
          >
            {copy.lobby.start}
          </button>
        {/if}
      </div>
    </section>
  </div>
</main>

{#if rotate}<RotatePrompt />{/if}

{#if moving !== null && host && table.seats[moving].kind === "human"}
  {@const from = moving}
  <MoveSheet
    {from}
    {table}
    onmove={(to) => move(from, to)}
    onclose={() => (moving = null)}
    opener={tiles[from]}
  />
{/if}

{#if inviteOpen}
  <InviteSheet url={link} name={myName} onclose={() => (inviteOpen = false)} opener={inviteButton} />
{/if}

{#if confirmStart}
  <ConfirmDialog
    title={copy.confirm.startWithout.title(startNames)}
    body={copy.confirm.startWithout.body(startNames, unseatedOthers.length > 1)}
    safeLabel={copy.confirm.startWithout.safe}
    otherLabel={copy.confirm.startWithout.other}
    oncancel={() => (confirmStart = false)}
    onconfirm={startAnyway}
    opener={startButton}
  />
{/if}

<style>
  .room {
    --gutter-l: calc(var(--space-md) + env(safe-area-inset-left, 0px));
    --gutter-r: calc(var(--space-md) + env(safe-area-inset-right, 0px));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    min-height: 100%;
    padding-inline: var(--gutter-l) var(--gutter-r);
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  .heading {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grid {
    display: grid;
  }

  .stand {
    align-self: flex-start;
  }

  .seats-column,
  .side {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .rows {
    display: flex;
    flex-direction: column;
  }

  .lines {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .muted {
    color: var(--creme-attenuee);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    background: var(--noyer);
  }

  .actions .btn {
    flex: none;
    padding-inline: var(--space-md);
  }

  .actions .start {
    flex: 1;
  }

  .gear {
    flex: none;
  }

  /* Computer (BAR_QUERY): left 288 (heading, 2 x 2 tiles of 136 x 140, « Libérer ma place »), gap 48,
     right at most 520 (heading, rows, count line, action row). */
  .room[data-layout="computer"] {
    padding-block: calc(var(--space-xl) + env(safe-area-inset-top, 0px))
      calc(var(--space-xl) + env(safe-area-inset-bottom, 0px));
  }

  .room[data-layout="computer"] .columns {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: var(--space-2xl);
  }

  .room[data-layout="computer"] .seats-column {
    flex: none;
    width: 288px;
    gap: var(--space-md);
  }

  .room[data-layout="computer"] .grid {
    grid-template-columns: repeat(2, 136px);
    gap: var(--space-md);
  }

  .room[data-layout="computer"] .side {
    flex: 0 1 520px;
    gap: var(--space-md);
  }

  .room[data-layout="computer"] .rows {
    gap: var(--space-md);
  }

  .room[data-layout="computer"] .actions {
    margin-top: var(--space-sm);
  }

  /* Phone held sideways from 640 wide: left 200 (heading, 2 x 2 tiles of 96 x 88, « Libérer ma
     place »), gap 16, right at most 520. If the right column grows taller than the screen (« Sans
     place » at 667 x 375 or 640 x 360), the page scrolls and the action row sticks to the bottom. */
  .room[data-layout="two"] {
    padding-block: calc(12px + env(safe-area-inset-top, 0px))
      calc(12px + env(safe-area-inset-bottom, 0px));
  }

  .room[data-layout="two"] .columns {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .room[data-layout="two"] .seats-column {
    flex: none;
    width: 200px;
    gap: var(--space-sm);
  }

  .room[data-layout="two"] .grid {
    grid-template-columns: repeat(2, 96px);
    gap: var(--space-sm);
  }

  .room[data-layout="two"] .side {
    flex: 0 1 520px;
    gap: var(--space-sm);
  }

  .room[data-layout="two"] .rows {
    gap: var(--space-sm);
  }

  .room[data-layout="two"] .actions {
    position: sticky;
    bottom: 0;
    margin-top: var(--space-sm);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  /* Phone held sideways under 640 wide: one column that scrolls, the four tiles in one row, the action
     row in a sticky band at the bottom (the wrappers step aside, as on the solo setup). */
  .room[data-layout="one"] {
    justify-content: flex-start;
    gap: var(--space-sm);
    padding-top: calc(12px + env(safe-area-inset-top, 0px));
  }

  .room[data-layout="one"] .columns,
  .room[data-layout="one"] .seats-column,
  .room[data-layout="one"] .side {
    display: contents;
  }

  .room[data-layout="one"] .grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-sm);
  }

  .room[data-layout="one"] .grid :global([data-seat-tile]) {
    width: 100%;
  }

  .room[data-layout="one"] .rows {
    gap: var(--space-sm);
  }

  .room[data-layout="one"] .actions {
    position: sticky;
    bottom: 0;
    z-index: 1;
    margin-top: auto;
    margin-inline: calc(-1 * var(--gutter-l)) calc(-1 * var(--gutter-r));
    padding: var(--space-sm) var(--gutter-r) max(var(--space-sm), env(safe-area-inset-bottom, 0px))
      var(--gutter-l);
    border-top: 1px solid var(--brun-aide-memoire);
  }
</style>
