<script lang="ts">
  import { type BotLevel, DEFAULT_BOT_LEVEL } from "@toc/bots";
  import type { Color } from "@toc/engine";
  import type { ClientFrame, TablePublic } from "@toc/protocol";
  import { tick, untrack } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { unlock } from "../audio/engine.ts";
  import { table as copy } from "../i18n/fr/table.ts";
  import { type Plate, plateFor } from "../net/plate.ts";
  import { settings } from "../settings/store.svelte.ts";
  import Icon from "./Icon.svelte";
  import type { IconName } from "./icons.ts";
  import StrengthPicker from "./StrengthPicker.svelte";

  // The plate over the board (plan 02-06, 02-UI-SPEC « Plates », « Plate states »): the pause while a
  // player is missing, with the countdown to the chef de table's choice; the chef de table's three
  // choices and the level step; the saved game. Bois sombre, radius 16, a sharp shadow; as wide as
  // min(440, board − 16), centred on the board and kept 8 px inside the viewport; a 30 % walnut veil
  // over the board only. Non-modal: a region named by its title, a polite live region for its
  // changes; the focus moves only when the choices or the level step appear (and back to the first
  // choice on « Retour »). Every button wakes the sound (the first gesture may be here).

  type Props = {
    table: TablePublic;
    /** This device's seat. */
    me: Color;
    /** The server's clock minus the device's (connection.serverOffset). */
    offset: number;
    /** The board's element: the plate is placed on it. */
    board: HTMLElement | null;
    send: (frame: ClientFrame) => void;
    onhome: () => void;
  };

  let { table, me, offset, board, send, onhome }: Props = $props();

  /** The device's clock, moved each second while a countdown shows (the only timer here). */
  let nowMs = $state(Date.now());
  const plate = $derived<Plate | null>(plateFor(table, me, offset, nowMs));
  const counting = $derived(plate?.kind === "pause");

  $effect(() => {
    if (!counting) return;
    nowMs = Date.now();
    const timer = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
    return () => clearInterval(timer);
  });

  /** The chef de table's step: the three choices, then the level of the computer. */
  let step = $state<"choices" | "level">("choices");
  let level = $state<BotLevel>(DEFAULT_BOT_LEVEL);
  $effect(() => {
    if (plate?.kind !== "choices") {
      step = "choices";
      level = DEFAULT_BOT_LEVEL;
    }
  });

  const kind = $derived(
    plate === null
      ? null
      : plate.kind === "waitingChoice"
        ? "pause"
        : plate.kind === "choices"
          ? step
          : plate.kind,
  );
  const icon = $derived<IconName>(plate?.kind === "saved" ? "check" : "hourglass");
  const several = $derived(plate?.kind === "choices" && plate.several);

  // --- Live region: said once when the pause begins, and when the choices come ---
  let announcement = $state("");
  let lastKind: string | null = null;
  $effect(() => {
    const current = plate;
    untrack(() => {
      const now = current === null ? null : current.kind;
      if (now === lastKind) return;
      lastKind = now;
      if (current?.kind === "pause") announcement = current.announce;
      else if (current?.kind === "choices") announcement = copy.game.pause.chooseAnnounce;
      else if (current?.kind === "waitingChoice" || current?.kind === "saved") {
        announcement = `${current.title} ${current.body}`;
      } else announcement = "";
    });
  });

  // --- Focus: to the first choice when the choices appear, to the level when it is asked ---
  let plateEl = $state<HTMLElement | null>(null);
  let firstChoice = $state<HTMLButtonElement | null>(null);
  $effect(() => {
    const current = kind;
    untrack(() => {
      void tick().then(() => {
        if (current === "choices") firstChoice?.focus({ preventScroll: true });
        else if (current === "level") {
          plateEl
            ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"], input:checked')
            ?.focus({ preventScroll: true });
        }
      });
    });
  });

  function act(frame: ClientFrame) {
    unlock();
    send(frame);
  }

  function chooseLevel() {
    unlock();
    step = "level";
  }

  function back() {
    unlock();
    step = "choices";
  }

  function home() {
    unlock();
    onhome();
  }

  // --- Place: centred on the board, never wider than it, kept 8 px inside the viewport ---
  const MARGIN = 8;
  const MAX_WIDTH = 440;
  let boardBox = $state<{ left: number; top: number; width: number; height: number } | null>(null);
  let viewport = $state({ width: 0, height: 0 });
  let plateHeight = $state(0);

  function measure() {
    viewport = { width: window.innerWidth, height: window.innerHeight };
    if (board === null) {
      boardBox = null;
      return;
    }
    const box = board.getBoundingClientRect();
    boardBox = { left: box.left, top: box.top, width: box.width, height: box.height };
  }

  $effect(() => {
    const element = board;
    measure();
    if (element === null) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });

  const place = $derived.by(() => {
    if (boardBox === null) return null;
    const width = Math.max(0, Math.min(MAX_WIDTH, boardBox.width - 2 * MARGIN));
    const cx = boardBox.left + boardBox.width / 2;
    const cy = boardBox.top + boardBox.height / 2;
    const left = Math.min(
      Math.max(MARGIN, cx - width / 2),
      Math.max(MARGIN, viewport.width - MARGIN - width),
    );
    const top = Math.min(
      Math.max(MARGIN, cy - plateHeight / 2),
      Math.max(MARGIN, viewport.height - MARGIN - plateHeight),
    );
    return { left, top, width };
  });

  /** Reduced motion: a 150 ms fade both ways; else 200 ms 12 px down and a fade in, 150 ms fade out. */
  function still(): boolean {
    if (settings.reduceMotion) return true;
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }
  const reduced = still();
</script>

<svelte:window onresize={measure} />

{#if plate !== null && kind !== null}
  {#if boardBox !== null}
    <div
      class="veil"
      aria-hidden="true"
      data-plate-veil
      style:left={`${boardBox.left}px`}
      style:top={`${boardBox.top}px`}
      style:width={`${boardBox.width}px`}
      style:height={`${boardBox.height}px`}
      transition:fade={{ duration: 150 }}
    ></div>
  {/if}
  <section
    class="plate"
    aria-labelledby="plate-title"
    data-plate={kind}
    bind:this={plateEl}
    bind:offsetHeight={plateHeight}
    style:left={place ? `${place.left}px` : undefined}
    style:top={place ? `${place.top}px` : undefined}
    style:width={place ? `${place.width}px` : undefined}
    in:fly={{ y: reduced ? 0 : -12, duration: reduced ? 150 : 200 }}
    out:fade={{ duration: 150 }}
  >
    <h2 id="plate-title" class="title">
      <Icon name={icon} size={20} />
      <span>{kind === "level" ? copy.game.pause.levelTitle : plate.title}</span>
    </h2>

    {#if kind !== "level"}
      <p class="body">{plate.body}</p>
    {/if}

    {#if plate.kind === "pause"}
      <p class="countdown" data-countdown aria-hidden="true">{plate.countdown}</p>
    {:else if plate.kind === "choices" && step === "choices"}
      <div class="stack">
        <button
          type="button"
          class="btn btn-secondary"
          data-choice="wait"
          bind:this={firstChoice}
          onclick={() => act({ t: "pause", choice: "wait" })}
        >
          {copy.game.pause.wait}
        </button>
        <button type="button" class="btn btn-secondary" data-choice="bot" onclick={chooseLevel}>
          {copy.game.pause.handOver(several)}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          data-choice="save"
          onclick={() => act({ t: "pause", choice: "save" })}
        >
          {copy.game.pause.save}
        </button>
      </div>
    {:else if plate.kind === "choices"}
      <div class="level">
        <StrengthPicker
          color={me}
          role="handover"
          label={copy.game.pause.levelTitle}
          value={level}
          onchange={(next) => (level = next)}
        />
      </div>
      <div class="pair">
        <button type="button" class="btn btn-secondary" onclick={back}>
          {copy.game.pause.back}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          data-choice="confirm"
          onclick={() => act({ t: "pause", choice: "bot", level })}
        >
          {copy.game.pause.confirmHandOver(several)}
        </button>
      </div>
    {:else if plate.kind === "saved"}
      <p class="line" data-saved-present>{plate.present}</p>
      {#if plate.absent !== null}
        <p class="line" data-saved-absent>{plate.absent}</p>
      {/if}
      {#if plate.host}
        <div class="pair">
          <button type="button" class="btn btn-secondary" onclick={home}>{copy.home}</button>
          <button type="button" class="btn btn-primary" onclick={() => act({ t: "resume" })}>
            {copy.game.saved.resume}
          </button>
        </div>
      {:else}
        <p class="line">{plate.hostLine}</p>
        <div class="pair single">
          <button type="button" class="btn btn-secondary" onclick={home}>{copy.home}</button>
        </div>
      {/if}
    {/if}

    <p class="sr-only" aria-live="polite">{announcement}</p>
  </section>
{/if}

<style>
  /* The walnut veil over the board only (30 %): the strips and the prompt row stay as they are. */
  .veil {
    position: fixed;
    z-index: 39;
    background: rgb(43 29 18 / 30%);
    pointer-events: none;
  }

  .plate {
    position: fixed;
    z-index: 40;
    box-sizing: border-box;
    max-height: calc(100dvh - 16px);
    overflow-y: auto;
    padding: var(--space-md);
    border-radius: var(--radius-sheet);
    background: var(--bois-sombre);
    color: var(--creme);
    /* A sharp shadow, 4 px down in ink 45 %, no blur. */
    box-shadow: 0 4px 0 rgb(20 12 6 / 45%);
  }

  .title {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin: 0;
    font-size: var(--heading-size);
    font-weight: 700;
    line-height: var(--heading-line);
  }

  .title :global(svg) {
    flex: none;
  }

  .body {
    margin: var(--space-xs) 0 0;
    font-size: var(--body-size);
    line-height: var(--body-line);
  }

  .countdown {
    margin: var(--space-sm) 0 0;
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: var(--label-line);
  }

  .line {
    margin: var(--space-sm) 0 0;
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-top: 12px;
  }

  .stack .btn {
    width: 100%;
    padding: 0 var(--space-md);
  }

  .level {
    margin-top: var(--space-sm);
  }

  .pair {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-md);
  }

  .pair .btn {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 var(--space-sm);
  }

  .pair.single .btn {
    flex: 0 1 auto;
    margin-left: auto;
    padding: 0 var(--space-lg);
  }
</style>
