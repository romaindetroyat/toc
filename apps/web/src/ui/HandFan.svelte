<script module lang="ts">
  /**
   * turn: his turn, per-card playable / unplayable. waiting: not his turn, nothing interactive and
   * nothing dimmed. exchange: every card raised and selectable. dead: every card dimmed.
   */
  export type HandMode = "turn" | "waiting" | "exchange" | "dead";
</script>

<script lang="ts">
  import { leftClearance, MOTION, type Mode, REDUCED, SCENE, scaleFor } from "@toc/board";
  import { type CardId, type Color, type Playability, sortHand } from "@toc/engine";
  import { tick, untrack } from "svelte";
  import {
    CORNER_SHIFT,
    type CornerStrip,
    cardSize,
    cornerLayout,
    fanLayout,
    fanSpread,
  } from "../cards/fan.ts";
  import { game } from "../i18n/fr/game.ts";
  import { settings } from "../settings/store.svelte.ts";
  import Card, { type CardState } from "./Card.svelte";
  import KeyHint from "./KeyHint.svelte";

  type Props = {
    hand: readonly CardId[];
    mode: HandMode;
    /** The engine's verdict per card of the hand (playability), read only in `turn` mode. */
    playability?: Partial<Record<CardId, Playability>>;
    selected?: CardId | null;
    /** The card received from the partner, marked until it is played (D-21). */
    received?: CardId | null;
    /** The partner, whose colour borders the received card and whose name is read with it. */
    partner?: { color: Color; name: string } | null;
    /** The cards of a new deal are still on their way: the hand is held back, then turned face up. */
    concealed?: boolean;
    /** The pace of the card motions: the settings by default, `test` turns them off. */
    pace?: Mode | "test";
    onpick?: (card: CardId) => void;
    /**
     * The compact mode of a phone held sideways: the hand in the galet's corner (plan 03-10, Romain's
     * « Cartes plus grandes en coin » of 2026-10-17, replacing the 52 x 73 column of 01-47). From the
     * bottom of the left strip up, each card covering all of the one above but a slice of 44 px or
     * more, in one straight column (plan 02-06b, Romain's « la carte du bas est décalée, je ne veux
     * pas ça »): every card the same size and the same left edge, inside the strip (never under the
     * Dynamic Island), as far right as the galet's bare side allows over the column's whole height
     * (cornerLayout over leftClearance); the selected card moves 6 px toward the board, nothing
     * turns. The strip is as wide as the 03-10 card needs (plan 02-06c, « Plateau un peu réduit »).
     */
    compact?: boolean;
    /** In the compact mode: the board, to measure the galet's bare corner against. */
    board?: HTMLElement | null;
  };

  let {
    hand,
    mode,
    playability = {},
    selected = null,
    received = null,
    partner = null,
    concealed = false,
    pace = settings.reduceMotion ? "reduced" : settings.fast ? "fast" : "normal",
    onpick,
    compact = false,
    board = null,
  }: Props = $props();

  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let width = $state(0);
  let active = $state(0);
  let fanEl = $state<HTMLElement>();

  const cards = $derived(sortHand(hand));

  /**
   * The compact mode's strip (the fan fills it; it starts after the safe-area inset) and the board,
   * measured: the strip's size, and the board's top and width from the strip's corner.
   */
  let strip = $state<CornerStrip | null>(null);
  $effect(() => {
    const el = fanEl;
    const galet = board;
    if (!compact || el === undefined || galet === null) {
      strip = null;
      return;
    }
    const measure = () => {
      const s = el.getBoundingClientRect();
      const b = galet.getBoundingClientRect();
      strip = {
        width: b.left - s.left,
        height: s.height,
        boardTop: b.top - s.top,
        boardWidth: b.width,
      };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(galet);
    return () => observer.disconnect();
  });

  /** The compact mode's hand: its card (one size for all) and where each stands in the strip, px. */
  const cornerHand = $derived(
    cornerLayout(
      compact ? cards.length : 0,
      strip ?? { width: 0, height: 390, boardTop: 0, boardWidth: 0 },
      leftClearance,
      SCENE.width,
    ),
  );
  const corner = $derived(cornerHand.card);
  const tops = $derived(compact && strip !== null ? cornerHand.slots : []);
  const size = $derived(
    compact ? { w: corner.w, h: corner.h } : cardSize(viewportWidth, viewportHeight),
  );
  // The turned outer cards stay inside the screen: on a 320 px phone the fan spreads a little less.
  // In the corner nothing turns: each card stands where cornerLayout puts it.
  const slots = $derived(
    compact
      ? tops.map(({ x, y }) => ({ dx: x, drop: y, rotation: 0 }))
      : fanLayout(cards.length, fanSpread(cards.length, width, size.w, size.h), size.w),
  );
  const interactive = $derived(mode !== "waiting");
  // On a computer each card shows the digit that picks it (shortcuts.ts: the n-th card from the left).
  const hinted = $derived((mode === "turn" || mode === "exchange") && !concealed);

  function stateOf(card: CardId): CardState {
    switch (mode) {
      case "waiting":
        return "neutral";
      case "dead":
        return card === selected ? "selected" : "unplayable";
      case "exchange":
        return card === selected ? "selected" : "playable";
      case "turn":
        if (card === selected) return "selected";
        return playability[card]?.playable ? "playable" : "unplayable";
    }
  }

  /**
   * Where one card sits: its fan slot, raised by its state (8 px playable, 16 px selected). In the
   * corner the card stands at its top-left corner (`dx`, `drop`) and only the selected one moves,
   * 6 px toward the board.
   */
  function transformOf(card: CardId, slot: { dx: number; drop: number; rotation: number }): string {
    const state = stateOf(card);
    if (compact) {
      return `translate(${slot.dx + (state === "selected" ? CORNER_SHIFT : 0)}px, ${slot.drop}px)`;
    }
    if (state === "selected") return `translate(${slot.dx}px, ${slot.drop - 16}px) scale(1.06)`;
    const lift = state === "playable" ? 8 : 0;
    return `translate(${slot.dx}px, ${slot.drop - lift}px) rotate(${slot.rotation}deg)`;
  }

  // The cards come face up when the deal has landed: each flips open (a fade when motion is reduced),
  // 40 ms after the one before. Only a change seen while the fan is on screen animates, so the fan
  // that comes back after the 7 panel does not replay it.
  let wasConcealed = untrack(() => concealed);
  $effect(() => {
    const hidden = concealed;
    if (wasConcealed && !hidden && pace !== "test" && !document.hidden) {
      const calm = pace === "reduced";
      const scale = scaleFor(pace);
      cards.forEach((card, i) => {
        buttons[card]?.animate(
          calm
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [
                { transform: "scaleX(0.05)", opacity: 0 },
                { transform: "scaleX(1)", opacity: 1 },
              ],
          {
            duration: calm ? REDUCED.cards : MOTION.dealCard * scale,
            delay: calm ? 0 : i * MOTION.dealStagger * scale,
            easing: "ease-out",
            fill: "backwards",
          },
        );
      });
    }
    wasConcealed = hidden;
  });

  // The card from the partner joins the hand once the four cards have crossed the felt.
  let seenReceived = untrack(() => received);
  $effect(() => {
    const card = received;
    const fresh = card !== null && card !== seenReceived && pace !== "test" && !document.hidden;
    seenReceived = card;
    if (!fresh) return;
    const calm = pace === "reduced";
    const scale = scaleFor(pace);
    // The element exists once the DOM has been updated for this card.
    void tick().then(() => {
      untrack(() => buttons[card])?.animate(
        calm
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { transform: "translateY(36px)", opacity: 0 },
              { transform: "translateY(0)", opacity: 1 },
            ],
        {
          duration: calm ? REDUCED.cards : MOTION.dealCard * scale,
          delay: (calm ? REDUCED.cards : MOTION.exchangeCross * scale) + 60,
          easing: "ease-out",
          fill: "backwards",
        },
      );
    });
  });

  const roving = $derived(Math.min(active, Math.max(0, cards.length - 1)));
  let buttons = $state<Record<string, HTMLElement | undefined>>({});

  /**
   * Arrow keys walk through the cards (Entrée and Espace select, as on any button); in the corner the
   * up and down arrows do too.
   */
  function onkeydown(event: KeyboardEvent) {
    const next1 = event.key === "ArrowRight" || (compact && event.key === "ArrowDown");
    const back1 = event.key === "ArrowLeft" || (compact && event.key === "ArrowUp");
    const delta = next1 ? 1 : back1 ? -1 : 0;
    if (delta === 0 || cards.length === 0) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(cards.length - 1, roving + delta));
    active = next;
    const card = cards[next];
    if (card !== undefined) buttons[card]?.focus();
  }
</script>

<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />

<!-- Hand fan (UI-SPEC): 1 to 5 cards, ascending value, rotated about a point below the cards. -->
<div
  class="fan"
  class:compact
  class:still={settings.reduceMotion}
  class:concealed
  role="toolbar"
  tabindex="-1"
  aria-label={game.hand.label}
  aria-orientation={compact ? "vertical" : undefined}
  style:--card-w="{size.w}px"
  style:--card-h="{size.h}px"
  bind:clientWidth={width}
  bind:this={fanEl}
  {onkeydown}
  data-hand
  data-mode={mode}
>
  {#if cards.length === 0 && !concealed}
    <!-- Between deals the hand is empty (UI-SPEC « Plus de cartes »). -->
    <div class="empty" data-hand-empty>
      <p class="heading">{game.empty.heading}</p>
      <p class="body">{game.empty.body}</p>
    </div>
  {/if}
  {#each cards as card, i (card)}
    {@const slot = slots[i]}
    {#if slot}
      <div
        class="slot"
        style:transform={transformOf(card, slot)}
        style:z-index={stateOf(card) === "selected" && !compact ? 10 : i + 1}
        style:--middle-top={compact && i < cards.length - 1 ? `${corner.slice}px` : undefined}
      >
        <Card
          {card}
          state={stateOf(card)}
          received={card === received ? partner : null}
          {interactive}
          tabindex={i === roving ? 0 : -1}
          bind:el={buttons[card]}
          onclick={() => {
            active = i;
            onpick?.(card);
          }}
        />
      </div>
    {/if}
  {/each}
  {#if hinted}
    <!-- The digits ride on a layer of their own over the whole fan, each slot following its card, so
         a raised or selected card never hides the digit of its neighbour. -->
    {#each cards as card, i (card)}
      {@const slot = slots[i]}
      {#if slot}
        <div
          class="slot hint-slot"
          style:transform={transformOf(card, slot)}
          aria-hidden="true"
        >
          <KeyHint label={String(i + 1)} at="card" />
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  /* The fan fills the computer's 160 px bar (--bar of Game.svelte). Its cards are 106 x 148 since
     Romain's « Un peu plus grandes » (2026-10-17): their top stays 10 px under the bar's top, so their
     lower edge (and more of it for the dropped outer cards) runs under the screen's bottom edge, where
     the game screen clips it. The corner index is larger and bolder than the body text. */
  .fan {
    position: relative;
    width: 100%;
    height: 160px;
    --index-rank: 26px;
    --index-suit: 22px;
    --pip-size: 56px;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-md);
    text-align: center;
  }

  .empty p {
    margin: 0;
  }

  .empty .heading {
    color: var(--creme);
    font-size: var(--heading-size);
    font-weight: 700;
    line-height: var(--heading-line);
  }

  .empty .body {
    margin-top: var(--space-xs);
    color: var(--creme-attenuee);
    font-size: var(--body-size);
    line-height: var(--body-line);
  }

  /* The card is centred, then shifted and turned about the point 160 % down its height. */
  .slot {
    position: absolute;
    left: calc(50% - var(--card-w) / 2);
    /* The card's top 10 px under the fan's top, whatever its height. */
    bottom: calc(150px - var(--card-h));
    width: var(--card-w);
    height: var(--card-h);
    transform-origin: 50% 160%;
    transition: transform 200ms ease-out;
  }

  .still .slot {
    transition: none;
  }

  /* Above every card (the selected one is at 10), and never in the way of a tap. No width: the badge
     astride the top edge would otherwise widen the turned box of the outer slots past the screen; the
     pivot stays the card's (50 % of its width, 160 % of its height). */
  .hint-slot {
    z-index: 20;
    width: 0;
    transform-origin: calc(var(--card-w) / 2) 160%;
    pointer-events: none;
  }

  /* The digit right of the larger rank. */
  .hint-slot :global(.key-hint) {
    left: 38px;
  }

  /* A new hand waits, invisible and out of reach, for the cards of the deal to land. */
  .concealed .slot {
    opacity: 0;
    pointer-events: none;
  }

  /* The compact mode (a phone held sideways, plans 03-10 and 02-06b): the fan covers the whole left
     strip and lets every tap through but those on its cards (the info pill stands at the strip's top).
     Each card stands at the top-left corner its slot's translate gives: one straight column, inside
     the strip, its right part over the galet's bare side. The index stands stacked in the top-right
     corner, the part of the card the next one never covers, at a quarter of the card's height (28 px
     at 112). The selected card keeps its place in the stack (its outline and its 6 px move tell it),
     so the cards under it still show their index. */
  .fan.compact {
    position: absolute;
    inset: 0;
    width: auto;
    height: auto;
    --index-rank: calc(var(--card-h) * 0.25);
    --index-suit: calc(var(--card-h) * 0.2);
    --pip-size: calc(var(--card-h) * 0.4);
    pointer-events: none;
  }

  .compact .slot {
    top: 0;
    left: 0;
    bottom: auto;
    transform-origin: 0 0;
    pointer-events: auto;
  }

  .compact .slot :global(.card[data-card] .corner.top) {
    left: auto;
    right: 5px;
  }

  .compact .slot :global(.card[data-card].received .corner.top) {
    right: 9px;
  }

  /* The digit astride the card's top edge, at its left. */
  .compact .hint-slot {
    width: var(--card-w);
    pointer-events: none;
  }

  .compact .hint-slot :global(.key-hint) {
    left: 4px;
  }

  /* An unplayable card is veiled, but stays opaque: the cards overlap, and a see-through card would
     show the one under it. */
  .compact .slot :global(.card[data-card].unplayable) {
    opacity: 1;
  }

  .compact .slot :global(.card[data-card].unplayable::after) {
    content: "";
    position: absolute;
    inset: 0;
    background: rgb(43 29 18 / 0.5);
    pointer-events: none;
  }

  /* No room for two lines of text in the strip: the heading shows at its bottom, the body is read
     out. */
  .compact .empty {
    padding: 0 0 var(--space-md);
    justify-content: flex-end;
  }

  .compact .empty .heading {
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .compact .empty .body {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .slot {
      transition: none;
    }
  }
</style>
