<script lang="ts">
  import {
    CARD_SIZE,
    DEFAUSSE,
    LAST_CARD_SLOT,
    type Point,
    rotatePoint,
    seatCard,
    TALON,
  } from "@toc/board";
  import { type CardId, COLORS, type RenderState } from "@toc/engine";
  import { game } from "../i18n/fr/game.ts";
  import CardBack from "../ui/CardBack.svelte";
  import { posedSlots, tiltOf } from "./cardFx.ts";
  import FaceUpCard from "./FaceUpCard.svelte";

  type Props = {
    render: RenderState;
    /** The card on top of the défausse (public: every discarded card was played face up), or null. */
    discardTop: CardId | null;
    /** Clockwise quarter turns of the board toward the human. */
    k: number;
    /** Board units per screen pixel. */
    px: number;
  };

  let { render, discardTop, k, px }: Props = $props();

  const WALNUT = "#2B1D12";
  const CREAM = "#FFF8E1";
  const { w: CW, h: CH } = CARD_SIZE;

  const at = (point: Point): Point => rotatePoint(point, k);

  /** The talon stack: three thickness levels by count, nothing when it is empty. */
  const layers = $derived(
    render.talonSize > 26 ? 3 : render.talonSize > 8 ? 2 : render.talonSize > 0 ? 1 : 0,
  );

  const slots = $derived(
    COLORS.map((color) => ({
      color,
      ...seatCard(color, k),
      card: render.lastPlayed[color],
    })),
  );

  /** Dead hands, fanned in front of their seat (the same places the cards fly to when they are laid). */
  const posed = $derived(
    COLORS.flatMap((color) => {
      const cards = render.posed[color];
      if (cards.length === 0) return [];
      const places = posedSlots(color, cards.length, k);
      return [{ color, cards: cards.map((card, i) => ({ card, at: places[i] as Point })) }];
    }),
  );

  const dealerAt = $derived(at(LAST_CARD_SLOT[render.dealer]));
  const talon = at(TALON);
  const discard = at(DEFAUSSE);
</script>

<!-- The felt as a card table (UI-SPEC « Tapis »): the cards are upright on the screen, only their
     positions follow the board's rotation. Public information only (T-01-30). -->
<g role="group" aria-label={game.tapis.title} data-felt pointer-events="none">
  <!-- Talon: a face-down stack. -->
  <g data-talon={render.talonSize} aria-label={game.tapis.talon(render.talonSize)}>
    {#if layers === 0}
      <rect
        x={talon[0] - CW / 2}
        y={talon[1] - CH / 2}
        width={CW}
        height={CH}
        rx="12"
        fill="none"
        stroke={CREAM}
        stroke-opacity="0.5"
        stroke-width={2 * px}
        stroke-dasharray={`${6 * px} ${4 * px}`}
      />
    {:else}
      {#each Array.from({ length: layers - 1 }, (_, i) => layers - 1 - i) as depth (depth)}
        <rect
          x={talon[0] - CW / 2 - depth * 7}
          y={talon[1] - CH / 2 - depth * 7}
          width={CW}
          height={CH}
          rx="12"
          fill="#D8C6B0"
          stroke={WALNUT}
          stroke-opacity="0.6"
          stroke-width={px}
        />
      {/each}
      <CardBack x={talon[0]} y={talon[1]} {px} />
    {/if}
  </g>

  <!-- Défausse: its top card face up, or an empty outline. -->
  <g data-discard={render.discardSize} aria-label={game.tapis.discard(render.discardSize)}>
    {#if discardTop === null}
      <rect
        x={discard[0] - CW / 2}
        y={discard[1] - CH / 2}
        width={CW}
        height={CH}
        rx="12"
        fill="none"
        stroke={CREAM}
        stroke-opacity="0.5"
        stroke-width={2 * px}
        stroke-dasharray={`${6 * px} ${4 * px}`}
      />
    {:else}
      <FaceUpCard card={discardTop} x={discard[0]} y={discard[1]} tilt={tiltOf(discardTop)} {px} />
    {/if}
  </g>

  <!-- The last card of each seat, in front of its place; a seat without a card stays blank. -->
  {#each slots as slot (slot.color)}
    {#if slot.card !== null}
      <g data-felt-last={slot.color}>
        <FaceUpCard
          card={slot.card}
          x={slot.at[0]}
          y={slot.at[1]}
          angle={slot.angle}
          tilt={tiltOf(slot.card)}
          {px}
        />
      </g>
    {/if}
  {/each}

  <!-- Dead hands, over the last-card slot. -->
  {#each posed as hand (hand.color)}
    <g data-felt-posed={hand.color}>
      {#each hand.cards as item (item.card)}
        <FaceUpCard
          card={item.card}
          x={item.at[0]}
          y={item.at[1]}
          tilt={tiltOf(item.card)}
          {px}
        />
      {/each}
    </g>
  {/each}

  <!-- The dealer disc « D », at the top-right corner of the dealer's slot. -->
  <g data-dealer={render.dealer}>
    <circle cx={dealerAt[0] + CW / 2} cy={dealerAt[1] - CH / 2} r={12 * px} fill={CREAM} />
    <text
      class="disc"
      x={dealerAt[0] + CW / 2}
      y={dealerAt[1] - CH / 2}
      font-size={15 * px}
      text-anchor="middle"
      dominant-baseline="central"
      fill={WALNUT}
    >
      D
    </text>
  </g>
</g>

<style>
  .disc {
    font-family: var(--font-ui);
    font-weight: 700;
    user-select: none;
  }
</style>
