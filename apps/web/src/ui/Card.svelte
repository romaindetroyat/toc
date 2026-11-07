<script module lang="ts">
  /**
   * playable: raised, amber outline and top bar. unplayable: dimmed (a tap gives the reason).
   * selected: raised higher, amber outline. neutral: not his turn, neither raised nor dimmed.
   */
  export type CardState = "playable" | "unplayable" | "selected" | "neutral";
</script>

<script lang="ts">
  import { PALETTE } from "@toc/board";
  import type { CardId, Color } from "@toc/engine";
  import { COURT_FIGURES, cardFace } from "../cards/faces.ts";
  import { cardName } from "../i18n/fr/cards.ts";
  import { game } from "../i18n/fr/game.ts";
  import { lecons } from "../i18n/fr/lecons.ts";

  type Props = {
    card: CardId;
    state: CardState;
    /**
     * The card received from the partner (D-21): a thick border of the partner's colour, no text
     * (Romain, 2026-10-17: « Juste un liseré coloré »), and « reçue de {Partenaire} » in its name.
     */
    received?: { color: Color; name: string } | null;
    /** A button when true, a picture when false (cards are not interactive while he waits). */
    interactive?: boolean;
    onclick?: () => void;
    tabindex?: number;
    el?: HTMLElement;
    /** In a lesson (plan 05-06): the card the guide asks to touch; its name ends « , à toucher ». */
    guide?: boolean;
  };

  let {
    card,
    state,
    received = null,
    interactive = true,
    onclick,
    tabindex = 0,
    el = $bindable(),
    guide = false,
  }: Props = $props();

  const face = $derived(cardFace(card));
  const figure = $derived(COURT_FIGURES[card]);
  const name = $derived(cardName(card));
  // « Dame de cœur, jouable » / « …, pas jouable »; a neutral card is only named.
  const named = $derived(
    state === "playable" || state === "selected"
      ? game.hand.playable(name)
      : state === "unplayable"
        ? game.hand.unplayable(name)
        : game.hand.neutral(name),
  );
  const said = $derived(received ? game.exchange.received(named, received.name) : named);
  const label = $derived(guide ? lecons.target(said) : said);
  const border = $derived(received ? PALETTE.hex[received.color] : undefined);
</script>

<!-- The printed face (plan 05-10, APP-05 audit, WCAG 2.5.3 « Label in Name »): the indices and pips
     are painted by CSS from their attributes, as the court figures are pictures, so the card's only
     text is its name (« Dame de cœur, jouable »), never « D D » read off its corners. -->
{#snippet content()}
  {#if received}
    <!-- Under the corners and the middle: the glyphs stay whole over the border. -->
    <span class="border" aria-hidden="true"></span>
  {/if}
  <span class="corner top" style:color={face.colour} aria-hidden="true">
    <span class="rank glyph" data-glyph={face.rankLabel}></span>
    <span class="pip glyph" data-glyph={face.suitGlyph}></span>
  </span>
  <span class="middle" style:color={face.colour} aria-hidden="true">
    {#if face.court && figure}
      <img src={figure} alt="" draggable="false" />
    {:else if face.court}
      <span class="letter glyph" data-glyph={face.rankLabel}></span>
      <span class="pips glyph" data-glyph={face.suitGlyph}></span>
    {:else}
      <span class="big glyph" data-glyph={face.suitGlyph}></span>
    {/if}
  </span>
  <span class="corner bottom" style:color={face.colour} aria-hidden="true">
    <span class="rank glyph" data-glyph={face.rankLabel}></span>
    <span class="pip glyph" data-glyph={face.suitGlyph}></span>
  </span>
{/snippet}

{#if interactive}
  <button
    bind:this={el}
    type="button"
    class="card {state}"
    class:received={received !== null}
    style:--received={border}
    aria-label={label}
    aria-pressed={state === "selected"}
    {tabindex}
    {onclick}
    data-card={card}
    data-state={state}
    data-received={received?.color}
  >
    {@render content()}
  </button>
{:else}
  <div
    bind:this={el}
    class="card {state}"
    class:received={received !== null}
    style:--received={border}
    role="img"
    aria-label={label}
    data-card={card}
    data-state={state}
    data-received={received?.color}
  >
    {@render content()}
  </div>
{/if}

<style>
  .card {
    position: relative;
    display: block;
    width: var(--card-w, 72px);
    height: var(--card-h, 100px);
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: 1px solid rgb(43 29 18 / 0.45);
    border-radius: var(--radius-card);
    background: var(--carte);
    color: var(--noyer);
    font-family: var(--font-ui);
    overflow: hidden;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    box-shadow: 0 2px 4px rgb(0 0 0 / 0.35);
  }

  div.card {
    cursor: default;
  }

  /* The corner index: rank over suit. Its size comes from the hand (--index-rank, --index-suit:
     larger since Romain's « valeurs en gros », 2026-10-17); elsewhere it keeps the body size. */
  .corner {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
    font-weight: 800;
  }

  .corner.top {
    top: 4px;
    left: 5px;
  }

  .corner.bottom {
    right: 5px;
    bottom: 4px;
    transform: rotate(180deg);
  }

  /* Inside the received card's border. */
  .received .corner.top {
    top: 8px;
    left: 9px;
  }

  .received .corner.bottom {
    right: 9px;
    bottom: 8px;
  }

  .glyph::before {
    content: attr(data-glyph);
  }

  .rank {
    font-size: var(--index-rank, var(--body-size));
    letter-spacing: -0.02em;
  }

  .pip {
    font-size: var(--index-suit, var(--body-size));
  }

  /* Centred on the card and, in the phone's corner hand, under the slice of a card the next one covers
     (--middle-top), so a slice shows its index alone. */
  .middle {
    position: absolute;
    inset: var(--middle-top, 0px) 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .big {
    font-size: var(--pip-size, 44px);
    line-height: 1;
  }

  .letter {
    font-family: var(--font-display);
    font-size: var(--pip-size, 44px);
    font-weight: 700;
    line-height: 1;
  }

  .pips {
    font-size: var(--body-size);
    letter-spacing: 4px;
    line-height: 1;
  }

  .middle img {
    width: 70%;
    height: 78%;
    object-fit: contain;
    pointer-events: none;
  }

  /* Playable: 3 px amber outline and 4 px amber top bar. */
  .playable,
  .selected {
    box-shadow:
      0 0 0 3px var(--ambre),
      0 2px 4px rgb(0 0 0 / 0.35);
  }

  .playable::before,
  .selected::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--ambre);
  }

  .unplayable {
    opacity: 0.5;
  }

  /* The card received from the partner: a 6 px border of the partner's colour inside the card, a
     fine walnut line on its inner side so that the yellow seat never melts into the amber outline. */
  .border {
    position: absolute;
    inset: 0;
    border: 6px solid var(--received);
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px rgb(43 29 18 / 0.5);
    pointer-events: none;
  }
</style>
