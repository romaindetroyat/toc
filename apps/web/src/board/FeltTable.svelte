<script lang="ts">
  import {
    CARD_SIZE,
    DEFAUSSE,
    LAST_CARD_SLOT,
    type Point,
    rotatePoint,
    TALON,
  } from "@toc/board";
  import { type CardId, COLORS, type RenderState } from "@toc/engine";
  import { cardFace } from "../cards/faces.ts";
  import { cardName } from "../i18n/fr/cards.ts";
  import { game } from "../i18n/fr/game.ts";
  import CardBack from "../ui/CardBack.svelte";

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
  /** Centre of the felt square, unrotated board units. */
  const MIDDLE = 1280;

  /** A tilt between -4 and +4 degrees, the same every time for one card. */
  function tiltOf(card: CardId): number {
    let hash = 0;
    for (const char of card) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return (hash % 9) - 4;
  }

  const at = (point: Point): Point => rotatePoint(point, k);

  /** The talon stack: three thickness levels by count, nothing when it is empty. */
  const layers = $derived(
    render.talonSize > 26 ? 3 : render.talonSize > 8 ? 2 : render.talonSize > 0 ? 1 : 0,
  );

  const slots = $derived(
    COLORS.map((color) => ({
      color,
      at: at(LAST_CARD_SLOT[color]),
      card: render.lastPlayed[color],
    })),
  );

  /** Dead hands, fanned in front of their seat: a row for the seats at the top and bottom of the
   *  screen, a column for the seats at the sides, 50 % overlap. */
  const posed = $derived(
    COLORS.flatMap((color) => {
      const cards = render.posed[color];
      if (cards.length === 0) return [];
      const [cx, cy] = at(LAST_CARD_SLOT[color]);
      const horizontal = Math.abs(cy - MIDDLE) > Math.abs(cx - MIDDLE);
      const step = horizontal ? CW / 2 : CH / 2;
      return [
        {
          color,
          cards: cards.map((card, i) => {
            const shift = (i - (cards.length - 1) / 2) * step;
            return {
              card,
              x: horizontal ? cx + shift : cx,
              y: horizontal ? cy : cy + shift,
            };
          }),
        },
      ];
    }),
  );

  const dealerAt = $derived(at(LAST_CARD_SLOT[render.dealer]));
  const talon = at(TALON);
  const discard = at(DEFAUSSE);
</script>

{#snippet corner(card: CardId)}
  {@const face = cardFace(card)}
  <text class="corner" x={-CW / 2 + 12} y={-CH / 2 + 46} font-size="44" fill={face.colour}>
    {face.rankLabel}
  </text>
  <text class="corner" x={-CW / 2 + 12} y={-CH / 2 + 86} font-size="38" fill={face.colour}>
    {face.suitGlyph}
  </text>
{/snippet}

<!-- A card lying face up on the felt, upright on the screen, tilted a few degrees (D-08). -->
{#snippet faceUp(card: CardId, x: number, y: number)}
  {@const face = cardFace(card)}
  <g transform={`translate(${x} ${y}) rotate(${tiltOf(card)})`} data-felt-card={card}>
    <title>{cardName(card)}</title>
    <rect
      x={-CW / 2}
      y={-CH / 2}
      width={CW}
      height={CH}
      rx="12"
      fill="#FFFDF6"
      stroke={WALNUT}
      stroke-opacity="0.45"
      stroke-width={px}
    />
    {@render corner(card)}
    <text class="corner" x="0" y="34" font-size="92" text-anchor="middle" fill={face.colour}>
      {face.suitGlyph}
    </text>
    <g transform="rotate(180)">{@render corner(card)}</g>
  </g>
{/snippet}

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
      {@render faceUp(discardTop, discard[0], discard[1])}
    {/if}
  </g>

  <!-- The last card of each seat, in front of its place; a seat without a card stays blank. -->
  {#each slots as slot (slot.color)}
    {#if slot.card !== null}
      <g data-felt-last={slot.color}>
        {@render faceUp(slot.card, slot.at[0], slot.at[1])}
      </g>
    {/if}
  {/each}

  <!-- Dead hands, over the last-card slot. -->
  {#each posed as hand (hand.color)}
    <g data-felt-posed={hand.color}>
      {#each hand.cards as item (item.card)}
        {@render faceUp(item.card, item.x, item.y)}
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
  .corner,
  .disc {
    font-family: var(--font-ui);
    font-weight: 700;
  }

  .corner {
    user-select: none;
  }

  .disc {
    user-select: none;
  }
</style>
