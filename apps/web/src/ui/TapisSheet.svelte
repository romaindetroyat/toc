<script lang="ts">
  import { COLORS, type Color, type RenderState } from "@toc/engine";
  import { cardName } from "../i18n/fr/cards.ts";
  import { game } from "../i18n/fr/game.ts";
  import Card from "./Card.svelte";
  import SeatChip from "./SeatChip.svelte";
  import Sheet from "./Sheet.svelte";

  // « Sur le tapis » (D-08, UI-SPEC « Tapis sheet »): the felt read at a size a phone can show. One row
  // per seat with its last card in large form, then the counts of the talon and the défausse. Only
  // public information (T-01-30): the last cards were played face up, the piles are counted, not shown.
  type Props = {
    render: RenderState;
    /** « toi » for the human, a horse name for each bot. */
    names: Record<Color, string>;
    onclose: () => void;
    /** Element that gets the focus back on close. */
    opener?: HTMLElement | null;
  };

  let { render, names, onclose, opener = null }: Props = $props();

  const upper = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

  const rows = $derived(
    COLORS.map((color) => {
      const card = render.lastPlayed[color];
      return { color, card, text: game.tapis.row(upper(names[color]), card && cardName(card)) };
    }),
  );
</script>

<Sheet title={game.tapis.title} {onclose} {opener}>
  <div class="tapis" data-tapis>
    <ul class="seats">
      {#each rows as row (row.color)}
        <li class="seat" data-tapis-seat={row.color}>
          <span class="chip" aria-hidden="true"><SeatChip color={row.color} showName={false} /></span>
          <span class="text" data-tapis-text>{row.text}</span>
          <span class="card" aria-hidden="true">
            {#if row.card !== null}
              <Card card={row.card} state="neutral" interactive={false} />
            {:else}
              <span class="blank"></span>
            {/if}
          </span>
        </li>
      {/each}
    </ul>
    <p class="count" data-tapis-talon={render.talonSize}>{game.tapis.talon(render.talonSize)}</p>
    <p class="count" data-tapis-discard={render.discardSize}>
      {game.tapis.discard(render.discardSize)}
    </p>
  </div>
</Sheet>

<style>
  .tapis {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .seats {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-sm);
    margin: 0 0 var(--space-sm);
    padding: 0;
    list-style: none;
  }

  .seat {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-sm);
    min-height: 100px;
  }

  .text {
    min-width: 0;
    font-weight: 700;
  }

  /* The card in large form: the size of the hand (72 x 100 compact, 88 x 124 regular). */
  .card {
    --card-w: 72px;
    --card-h: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--card-w);
    height: var(--card-h);
  }

  /* A seat without a card yet: an empty outline where it will lie. */
  .blank {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: 2px dashed var(--creme-attenuee);
    border-radius: var(--radius-card);
    opacity: 0.6;
  }

  @media (min-width: 600px) and (min-height: 600px) {
    .card {
      --card-w: 88px;
      --card-h: 124px;
    }

    .seat {
      min-height: 124px;
    }
  }

  .count {
    margin: 0;
  }
</style>
