<script lang="ts" module>
  /** Where one bubble stands on the screen, px, and where its tail points from. */
  export type BubbleSpot = {
    x: number;
    y: number;
    /** The edge the tail is on: left or right beside a rider, down above a seat tile. */
    tail: "left" | "right" | "down";
    /** The tail's centre from the bubble's top (left, right) or left edge (down), px. */
    tailAt: number;
  };
</script>

<script lang="ts">
  import { PALETTE } from "@toc/board";
  import type { Color } from "@toc/engine";
  import type { ChatEntry, ServerFrame, TablePublic } from "@toc/protocol";
  import { onDestroy } from "svelte";
  import { fade, type TransitionConfig } from "svelte/transition";
  import { messages } from "../i18n/fr/messages.ts";
  import { announcement, senderName } from "../net/chat.ts";
  import { settings } from "../settings/store.svelte.ts";
  import { BUBBLE_MAX_W, type Rect, type Size } from "./bubbles.ts";

  // The quick messages as they arrive (02-UI-SPEC « Received messages », plan 02-08): a cream bubble
  // bordered with the sender's seat colour for BUBBLE_LIFE_MS, beside the sender's rider on the board
  // or above their seat tile in the waiting room (the parent's `place` says where, from bubbles.ts).
  // The sender's first name on a first line for the others; the message (or the emoji at 20 px) under
  // it. A new message from a seat replaces that seat's bubble; several seats show at once. Taps pass
  // through (pointer-events: none) and the bubbles are hidden from screen readers: one polite live
  // region says « {Nom} : {message} » (an emoji by its name). In: 150 ms fade and scale 0.9 → 1 from
  // the tail; out: 150 ms fade; a fade only under reduced motion. A message that comes while the tab
  // is hidden is not shown (« Derniers messages » has it). No sound (02-UI-SPEC, à confirmer).

  type Props = {
    /** The table's frames (live chat frames only; the welcome's history is never replayed). */
    onFrame: (listener: (frame: ServerFrame) => void) => () => void;
    table: TablePublic;
    /** This device's seat: its own bubble has no name line. */
    me: Color | null;
    /** Where a bubble of `size` from `color` stands, the bubbles already placed given; null: none. */
    place: (color: Color, size: Size, placed: readonly Rect[]) => BubbleSpot | null;
    /** Nothing shows while false (the end plank). */
    visible?: boolean;
  };

  let { onFrame, table, me, place, visible = true }: Props = $props();

  /** How long a bubble stays, ms. */
  const BUBBLE_LIFE_MS = 4000;
  /** The size used before a bubble has been measured, px (two lines, the widest). */
  const GUESS: Size = { w: BUBBLE_MAX_W, h: 48 };

  type Bubble = { key: number; from: Color; msg: ChatEntry["msg"]; name: string | null };

  let bubbles = $state.raw<Bubble[]>([]);
  let sizes = $state<Record<number, Size>>({});
  let said = $state<{ key: number; text: string } | null>(null);
  /** Bumped on a resize: the spots are computed again. */
  let layoutTick = $state(0);
  let nextKey = 1;
  const timers = new Map<Color, ReturnType<typeof setTimeout>>();

  function show(entry: ChatEntry) {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const key = nextKey++;
    const name = entry.from === me ? null : senderName(table, entry.from);
    bubbles = [
      ...bubbles.filter((bubble) => bubble.from !== entry.from),
      { key, from: entry.from, msg: entry.msg, name },
    ];
    const old = timers.get(entry.from);
    if (old !== undefined) clearTimeout(old);
    timers.set(
      entry.from,
      setTimeout(() => {
        timers.delete(entry.from);
        bubbles = bubbles.filter((bubble) => bubble.key !== key);
      }, BUBBLE_LIFE_MS),
    );
    if (entry.from !== me) said = { key, text: announcement(entry, table) };
  }

  $effect(() =>
    onFrame((frame) => {
      if (frame.t === "chat") show({ from: frame.from, msg: frame.msg, at: frame.at });
    }),
  );

  onDestroy(() => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });

  /** The spots, in seat order, each bubble avoiding the ones placed before it. */
  const spots = $derived.by(() => {
    void layoutTick;
    const placed: Rect[] = [];
    const out = new Map<number, BubbleSpot>();
    for (const bubble of bubbles) {
      const size = sizes[bubble.key] ?? GUESS;
      const spot = place(bubble.from, size, placed);
      if (spot === null) continue;
      out.set(bubble.key, spot);
      placed.push({ x: spot.x, y: spot.y, w: size.w, h: size.h });
    }
    return out;
  });

  function reduced(): boolean {
    if (settings.reduceMotion) return true;
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  /** In: a fade and a scale from 0.9 from the tail (the transform-origin); a fade only if reduced. */
  function pop(_node: Element): TransitionConfig {
    if (reduced()) return { duration: 150, css: (t) => `opacity: ${t}` };
    return { duration: 150, css: (t) => `opacity: ${t}; transform: scale(${0.9 + 0.1 * t})` };
  }

  function origin(spot: BubbleSpot): string {
    if (spot.tail === "down") return `${spot.tailAt}px 100%`;
    return `${spot.tail === "left" ? "0" : "100%"} ${spot.tailAt}px`;
  }

  /** Measures a bubble once drawn (its real size moves it to its exact spot). */
  function measure(node: HTMLElement, key: number) {
    const update = () => {
      const size = { w: node.offsetWidth, h: node.offsetHeight };
      const known = sizes[key];
      if (known === undefined || known.w !== size.w || known.h !== size.h) sizes[key] = size;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return {
      destroy() {
        observer.disconnect();
        delete sizes[key];
      },
    };
  }
</script>

<svelte:window onresize={() => layoutTick++} />

{#if visible}
  <div class="chat-layer" aria-hidden="true">
    {#each bubbles as bubble (bubble.key)}
      {@const spot = spots.get(bubble.key)}
      {#if spot !== undefined}
        <div
          class="bubble"
          data-chat-bubble={bubble.from}
          data-chat-message={bubble.msg}
          data-tail={spot.tail}
          style:left={`${spot.x}px`}
          style:top={`${spot.y}px`}
          style:--seat={PALETTE.hex[bubble.from]}
          style:--tail-at={`${spot.tailAt}px`}
          style:transform-origin={origin(spot)}
          use:measure={bubble.key}
          in:pop
          out:fade={{ duration: 150 }}
        >
          {#if bubble.name !== null}
            <span class="name">{bubble.name}</span>
          {/if}
          <span class="message" class:emoji={messages.isEmoji(bubble.msg)}
            >{messages.text(bubble.msg)}</span
          >
        </div>
      {/if}
    {/each}
  </div>
{/if}

<p class="sr-only" aria-live="polite" data-chat-live>
  {#if said !== null}
    {#key said.key}<span>{said.text}</span>{/key}
  {/if}
</p>

<style>
  /* Over the board, under the hand's cards (z 2), the plates (39, 40), the sheets and the toasts. */
  .chat-layer {
    position: fixed;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  /* Cream, walnut text, a 2 px border in the seat colour, radius 12, padding 4 8, a sharp 2 px ink
     shadow; at most 160 wide. */
  .bubble {
    position: fixed;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: 160px;
    padding: 4px 8px;
    border: 2px solid var(--seat);
    border-radius: 12px;
    background: var(--creme);
    color: var(--noyer);
    box-shadow: 0 2px 0 rgba(42, 26, 14, 0.45);
    pointer-events: none;
    white-space: nowrap;
  }

  .name {
    max-width: 144px;
    overflow: hidden;
    color: rgba(43, 29, 18, 0.7);
    font-size: var(--label-size);
    font-weight: 400;
    line-height: 18px;
    text-overflow: ellipsis;
  }

  .message {
    max-width: 144px;
    overflow: hidden;
    font-size: var(--label-size);
    font-weight: 700;
    line-height: 18px;
    text-overflow: ellipsis;
  }

  .message.emoji {
    font-size: var(--heading-size);
    line-height: 20px;
  }

  /* The tail: a seat-coloured triangle with a cream one inside, pointing at the rider (or the tile). */
  .bubble::before,
  .bubble::after {
    content: "";
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
    border-color: transparent;
  }

  .bubble[data-tail="left"]::before {
    left: -10px;
    top: calc(var(--tail-at) - 8px);
    border-width: 6px 8px 6px 0;
    border-right-color: var(--seat);
  }

  .bubble[data-tail="left"]::after {
    left: -6px;
    top: calc(var(--tail-at) - 6px);
    border-width: 4px 5px 4px 0;
    border-right-color: var(--creme);
  }

  .bubble[data-tail="right"]::before {
    right: -10px;
    top: calc(var(--tail-at) - 8px);
    border-width: 6px 0 6px 8px;
    border-left-color: var(--seat);
  }

  .bubble[data-tail="right"]::after {
    right: -6px;
    top: calc(var(--tail-at) - 6px);
    border-width: 4px 0 4px 5px;
    border-left-color: var(--creme);
  }

  .bubble[data-tail="down"]::before {
    bottom: -10px;
    left: calc(var(--tail-at) - 8px);
    border-width: 8px 6px 0;
    border-top-color: var(--seat);
  }

  .bubble[data-tail="down"]::after {
    bottom: -6px;
    left: calc(var(--tail-at) - 6px);
    border-width: 5px 4px 0;
    border-top-color: var(--creme);
  }
</style>
