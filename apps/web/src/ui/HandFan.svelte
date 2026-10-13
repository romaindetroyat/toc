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
  import { cardSize, fanLayout } from "../cards/fan.ts";
  import { game } from "../i18n/fr/game.ts";
  import { settings } from "../settings/store.svelte.ts";
  import Card, { type CardState } from "./Card.svelte";

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
  }: Props = $props();

  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let width = $state(0);
  let active = $state(0);

  const cards = $derived(sortHand(hand));
  const size = $derived(cardSize(viewportWidth, viewportHeight));
  const slots = $derived(fanLayout(cards.length, width, size.w));
  const interactive = $derived(mode !== "waiting");

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

  /** Where one card sits: its fan slot, raised by its state (8 px playable, 16 px selected). */
  function transformOf(card: CardId, slot: { dx: number; drop: number; rotation: number }): string {
    const state = stateOf(card);
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
    if (wasConcealed && !hidden && pace !== "test") {
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
    const fresh = card !== null && card !== seenReceived && pace !== "test";
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

  /** Arrow keys walk through the cards (Entrée and Espace select, as on any button). */
  function onkeydown(event: KeyboardEvent) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
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
  class:still={settings.reduceMotion}
  class:concealed
  role="toolbar"
  tabindex="-1"
  aria-label={game.hand.label}
  style:--card-w="{size.w}px"
  style:--card-h="{size.h}px"
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
        style:z-index={stateOf(card) === "selected" ? 10 : i + 1}
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
</div>

<style>
  .fan {
    position: relative;
    width: 100%;
    height: calc(var(--card-h) + 32px);
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
    bottom: 16px;
    width: var(--card-w);
    height: var(--card-h);
    transform-origin: 50% 160%;
    transition: transform 200ms ease-out;
  }

  .still .slot {
    transition: none;
  }

  /* A new hand waits, invisible and out of reach, for the cards of the deal to land. */
  .concealed .slot {
    opacity: 0;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .slot {
      transition: none;
    }
  }
</style>
