<script module lang="ts">
  /**
   * turn: his turn, per-card playable / unplayable. waiting: not his turn, nothing interactive and
   * nothing dimmed. exchange: every card raised and selectable. dead: every card dimmed.
   */
  export type HandMode = "turn" | "waiting" | "exchange" | "dead";
</script>

<script lang="ts">
  import { MOTION, type Mode, REDUCED, scaleFor } from "@toc/board";
  import { type CardId, type Playability, sortHand } from "@toc/engine";
  import { tick, untrack } from "svelte";
  import {
    COLUMN_CARD,
    COLUMN_SHIFT,
    cardSize,
    columnHeight,
    columnLayout,
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
    /** The cards of a new deal are still on their way: the hand is held back, then turned face up. */
    concealed?: boolean;
    /** The pace of the card motions: the settings by default, `test` turns them off. */
    pace?: Mode | "test";
    onpick?: (card: CardId) => void;
    /**
     * The compact mode of a phone held sideways (UI-SPEC addendum « Recette 3 de Romain », plan
     * 01-47): a column of 52 x 73 cards in the 60 px strip at the left of the galet, each showing at
     * least its top 44 px, the last one whole, bottom-aligned in a box that holds five; the selected
     * card moves 6 px toward the board, nothing turns.
     */
    compact?: boolean;
  };

  let {
    hand,
    mode,
    playability = {},
    selected = null,
    received = null,
    concealed = false,
    pace = settings.reduceMotion ? "reduced" : settings.fast ? "fast" : "normal",
    onpick,
    compact = false,
  }: Props = $props();

  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let width = $state(0);
  let active = $state(0);

  const cards = $derived(sortHand(hand));
  const size = $derived(compact ? COLUMN_CARD : cardSize(viewportWidth, viewportHeight));
  /** The column's box: the height of five cards (a hand never holds more), so it never jumps. */
  const columnBox = $derived(columnHeight(Math.max(5, cards.length)));
  // The turned outer cards stay inside the screen: on a 320 px phone the fan spreads a little less.
  // In the column nothing turns: each card's top comes from columnLayout, its dx stays 0.
  const slots = $derived(
    compact
      ? columnLayout(cards.length, columnBox).map(({ y }) => ({ dx: 0, drop: y, rotation: 0 }))
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
   * column the card stands at its top (`drop`) and only the selected one moves, 6 px toward the board.
   */
  function transformOf(card: CardId, slot: { dx: number; drop: number; rotation: number }): string {
    const state = stateOf(card);
    if (compact) return `translate(${state === "selected" ? COLUMN_SHIFT : 0}px, ${slot.drop}px)`;
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
   * Arrow keys walk through the cards (Entrée and Espace select, as on any button); in the column the
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
  style:--column-box={compact ? `${columnBox}px` : undefined}
  bind:clientWidth={width}
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
      >
        <Card
          {card}
          state={stateOf(card)}
          received={card === received}
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
          class:received={card === received}
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
  .fan {
    position: relative;
    width: 100%;
    height: calc(var(--card-h) + 36px);
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
    /* Room under the card for the drop of the outer cards and the swing of their turned corners. */
    bottom: 26px;
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

  /* The « Reçue » tag holds the top of the received card's slice: its digit sits just above it. */
  .hint-slot.received :global(.key-hint) {
    top: -22px;
  }

  /* A new hand waits, invisible and out of reach, for the cards of the deal to land. */
  .concealed .slot {
    opacity: 0;
    pointer-events: none;
  }

  /* The compact mode (a phone held sideways): the box is the column of five cards, 58 px wide (a
     card and the 6 px its selection moves toward the board), at the bottom of the strip. Every card
     is whole, at the top its slot's translate gives; the next one covers all but its top 44 px. In
     the column the selected card keeps its place in the stack (its outline and its 6 px move tell
     it), so the cards under it still show their index. */
  .fan.compact {
    width: calc(var(--card-w) + 6px);
    height: var(--column-box);
    margin: 0 auto;
  }

  .compact .slot {
    top: 0;
    left: 0;
    bottom: auto;
    transform-origin: 50% 50%;
  }

  .compact .hint-slot {
    transform-origin: 0 0;
  }

  /* Smaller middle marks on the smaller card; an unplayable card at 40 %. */
  .compact .slot :global(.card[data-card] .big),
  .compact .slot :global(.card[data-card] .letter) {
    font-size: 30px;
  }

  .compact .slot :global(.card[data-card].unplayable) {
    opacity: 0.4;
  }

  /* No room for two lines of text in the column: the heading shows, the body is read out. */
  .compact .empty {
    padding: 0;
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
