<script lang="ts">
  import type { Color } from "@toc/engine";
  import type { SeatPublic } from "@toc/protocol";
  import { fade } from "svelte/transition";
  import { bots } from "../i18n/fr/bots.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import { table as copy } from "../i18n/fr/table.ts";
  import { settings } from "../settings/store.svelte.ts";
  import Icon from "./Icon.svelte";
  import SeatChip from "./SeatChip.svelte";

  // One seat of the waiting room (02-UI-SPEC « Seat grid »), styled like the launch screen's colour
  // tile: oak, radius 12. Compact 96 x 88 (chip, name, status); on the computer 136 x 140 with the
  // knight of the seat's colour above. Its state: yours (amber outline and check), free (a computer at
  // its level, the knight at 50 %), another person online or offline (wifi-off, content at 60 %), the
  // partner of your seat (dashed cream outline, « Partenaire »), the crown of the chef de table.
  // A <button> when this device may act on it (a free seat; another person for the creator), else a
  // <div> whose sentence is read out. Content changes cross-fade over 150 ms (instant when still).
  export type TileState = "you" | "free" | "human" | "offline";

  type Props = {
    color: Color;
    seat: SeatPublic;
    /** This device sits here. */
    mine: boolean;
    /** The chef de table sits here. */
    host: boolean;
    /** The partner of this device's seat. */
    partner: boolean;
    /** The computer layout: 136 x 140 with the knight. */
    large: boolean;
    /** What a tap does, or nothing (the tile is then not a button). */
    onpick?: (() => void) | null;
    /** The creator's tile of another person: its button reads « Déplacer {Nom} ({Couleur}) ». */
    moveLabel?: boolean;
    el?: HTMLElement | null;
  };

  let {
    color,
    seat,
    mine,
    host,
    partner,
    large,
    onpick = null,
    moveLabel = false,
    el = $bindable(null),
  }: Props = $props();

  const tileState = $derived<TileState>(
    mine ? "you" : seat.kind === "human" ? (seat.online ? "human" : "offline") : "free",
  );
  const colour = $derived(seats[color].name);
  const name = $derived(seat.kind === "human" ? (seat.name ?? "") : copy.lobby.computer);
  const status = $derived(
    tileState === "you"
      ? copy.lobby.you
      : tileState === "human"
        ? copy.lobby.online
        : tileState === "offline"
          ? copy.lobby.offline
          : bots.levels[seat.level],
  );

  /** The tile's sentence (02-UI-SPEC copy table « Waiting room »). */
  const sentence = $derived.by(() => {
    if (tileState === "you") return host ? copy.lobby.ownSeatHost(colour) : copy.lobby.ownSeat(colour);
    if (tileState === "free") return copy.lobby.takeSeat(colour, status);
    if (moveLabel) return copy.lobby.moveSeat(name, colour);
    const said = copy.lobby.otherSeat(colour, name, status);
    return host ? `${said}, ${copy.lobby.host}` : said;
  });

  /** What changes the content (the cross-fade runs when it does). */
  const key = $derived(`${tileState}|${name}|${status}|${host}`);

  function still(): boolean {
    if (settings.reduceMotion) return true;
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }
  const duration = $derived(still() ? 0 : 150);

  const tagId = $props.id();
</script>

{#snippet content()}
  {#key key}
    <span class="content" class:dim={tileState === "offline"} transition:fade={{ duration }}>
      {#if large}
        <span class="visual" class:faded={tileState === "free"} aria-hidden="true">
          <svg viewBox="0 0 110 190" width="23" height="40" focusable="false">
            <use href={`#knight-${color}`} />
          </svg>
        </span>
      {/if}
      <SeatChip {color} />
      <span class="t-label name" title={name}>
        <span class="name-text">{name}</span>
        {#if host}<span class="crown"><Icon name="crown" size={16} /></span>{/if}
      </span>
      <span class="t-label status">
        {#if tileState === "offline"}<Icon name="wifi-off" size={14} />{/if}
        {status}
      </span>
    </span>
  {/key}
  {#if mine}
    <span class="check" aria-hidden="true"><Icon name="check" size={16} /></span>
  {/if}
  {#if partner}
    <span class="tag" class:hidden={!large} id={`${tagId}-tag`}>{copy.lobby.partner}</span>
  {/if}
{/snippet}

{#if onpick}
  <button
    type="button"
    class="tile"
    class:large
    class:mine
    class:partner
    data-seat-tile={color}
    data-seat-state={tileState}
    aria-label={sentence}
    aria-describedby={partner ? `${tagId}-tag` : undefined}
    bind:this={el}
    onclick={onpick}
  >
    {@render content()}
  </button>
{:else}
  <div
    class="tile"
    class:large
    class:mine
    class:partner
    data-seat-tile={color}
    data-seat-state={tileState}
    bind:this={el}
  >
    <span class="sr-only">{sentence}</span>
    <span class="visible" aria-hidden="true">{@render content()}</span>
  </div>
{/if}

<style>
  .tile {
    position: relative;
    box-sizing: border-box;
    display: grid;
    width: 96px;
    height: 88px;
    padding: 6px;
    border: 2px solid color-mix(in srgb, var(--noyer) 30%, transparent);
    border-radius: 12px;
    /* Light oak with a faint horizontal grain, as the colour tiles of the launch screen. */
    background:
      repeating-linear-gradient(
        180deg,
        rgb(74 47 26 / 0.07) 0,
        rgb(74 47 26 / 0.07) 1px,
        transparent 1px,
        transparent 5px
      ),
      linear-gradient(180deg, #dfcfba 0%, #d8c6b0 55%, #cfbba3 100%);
    color: var(--noyer);
    font: inherit;
    text-align: center;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  button.tile {
    cursor: pointer;
  }

  button.tile:hover {
    border-color: var(--noyer);
  }

  .tile.large {
    width: 136px;
    height: 140px;
    padding: 8px;
  }

  /* Your seat: a 3 px amber line (the 2 px border and 1 px inside) and the check disc. */
  .tile.mine {
    border-color: var(--ambre);
    box-shadow: inset 0 0 0 1px var(--ambre);
  }

  .tile.partner {
    outline: 3px dashed var(--creme);
    outline-offset: 2px;
  }

  .tile:focus-visible {
    outline: 3px solid var(--ambre);
    outline-offset: 2px;
  }

  /* The visible part of a <div> tile, and every content cross-fading in one cell. */
  .visible {
    display: grid;
    min-width: 0;
  }

  .content {
    grid-area: 1 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    min-width: 0;
  }

  .visible .content {
    grid-area: 1 / 1;
  }

  .dim {
    opacity: 0.6;
  }

  .visual {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
  }

  .faded {
    opacity: 0.5;
  }

  .name {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    max-width: 100%;
    height: 20px;
    font-weight: 700;
  }

  .name-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .crown {
    flex: none;
    display: inline-flex;
  }

  .status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: 20px;
    opacity: 0.8;
    white-space: nowrap;
  }

  .tile:not(.large) .content {
    gap: 0;
  }

  .tile:not(.large) :global(.chip) {
    margin-bottom: var(--space-xs);
  }

  .check {
    position: absolute;
    top: var(--space-xs);
    right: var(--space-xs);
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--noyer);
    color: var(--creme);
  }

  /* Compact tiles: the check sits astride the corner, clear of the chip. */
  .tile:not(.large) .check {
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    border: 2px solid var(--ambre);
  }

  /* Astride the tile's top edge, clear of the knight and the check. */
  .tag {
    position: absolute;
    top: -12px;
    left: var(--space-sm);
    padding: 0 var(--space-sm);
    border-radius: 999px;
    background: var(--noyer);
    color: var(--creme);
    font-size: var(--label-size);
    font-weight: 700;
    line-height: 20px;
  }

  /* On the phone the tag stays the tile's accessible description, out of sight. */
  .tag.hidden {
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
