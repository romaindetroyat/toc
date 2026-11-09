<script lang="ts">
  import { deckCount, type PlayerView, RANKS, type Rank } from "@toc/engine";
  import { rankName } from "../i18n/fr/cards.ts";
  import { paquet } from "../i18n/fr/paquet.ts";
  import Sheet from "./Sheet.svelte";

  // « Les cartes jouées » (quick task 261109-80e, the sheet of 261109-6an turned round): for each of
  // the 13 ranks, from the As to the Roi, its short name and how many of its 4 cards were already played
  // in this pack, in a large digit (« As 2 », « Roi 3 ») with four dots (filled for the played ones);
  // the As, the 7, the Valet and the Roi set apart; first the deal of the pack and the cards played,
  // then the talon, quieter. The count is the engine's deckCount on the seat's PlayerView: the discard
  // pile and the dead hands laid down, all public, nothing a seat could not see (T-6an-01).
  // The deal line and the 13 ranks fit without scrolling down to 480 x 320; the rest may scroll.
  type Props = {
    view: PlayerView;
    onclose: () => void;
    /** Element that gets the focus back on close. */
    opener?: HTMLElement | null;
  };

  let { view, onclose, opener = null }: Props = $props();

  /** The ranks that decide a game: the As and the Roi bring a knight out, the 7 splits, the Valet swaps. */
  const KEY_RANKS: ReadonlySet<Rank> = new Set<Rank>([1, 7, 11, 13]);
  const DOTS = [0, 1, 2, 3] as const;

  const count = $derived(deckCount(view));
  const ranks = $derived(
    RANKS.map((rank) => {
      const name = rankName(rank);
      const played = count.played[rank];
      return { rank, name, played, key: KEY_RANKS.has(rank), line: paquet.rank(name, played) };
    }),
  );
</script>

<Sheet title={paquet.title} closeLabel={paquet.close} {onclose} {opener}>
  <div class="jouees">
    <p class="deal t-label" data-deck-deal>{paquet.deal(count.deal, count.playedTotal)}</p>
    <ul class="ranks" data-deck-ranks>
      {#each ranks as item (item.rank)}
        <li
          class="rank"
          class:key={item.key}
          data-deck-rank={item.rank}
          data-played={item.played}
          data-key-rank={item.key ? "" : undefined}
        >
          <span class="face" aria-hidden="true">
            <span class="name">{item.name}</span>
            <span class="count">
              <span class="digit">{item.played}</span>
              <span class="dots">
                {#each DOTS as dot (dot)}
                  <span class="dot" class:full={dot < item.played}></span>
                {/each}
              </span>
            </span>
          </span>
          <span class="sr-only">{item.line}</span>
        </li>
      {/each}
    </ul>
    <p class="talon t-label" data-deck-talon>{paquet.talon(count.talon)}</p>
    <p class="intro t-label">{paquet.intro}</p>
  </div>
</Sheet>

<style>
  .jouees {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .deal {
    margin: 0;
    font-weight: 700;
  }

  /* 7 + 6 columns in the 432 px body of the 480 px sheet: two rows of 46 px, so the deal line and the
     13 ranks hold in the 132 px body of the phone's sheet at 480 x 320. */
  .ranks {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rank {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: 2px;
    border: 2px solid transparent;
    border-radius: var(--radius-card);
    background: var(--noyer);
  }

  /* Set apart by a border and a bold name, not by colour alone. */
  .rank.key {
    border-color: var(--brun-aide-memoire);
  }

  .face {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .name {
    font-size: var(--label-size);
    line-height: 16px;
    white-space: nowrap;
  }

  .rank.key .name {
    font-weight: 700;
  }

  .count {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .digit {
    font-size: 20px;
    font-weight: 700;
    line-height: 20px;
    font-variant-numeric: tabular-nums;
  }

  .dots {
    display: grid;
    grid-template-columns: repeat(2, 6px);
    gap: 2px;
  }

  .dot {
    width: 6px;
    height: 6px;
    box-sizing: border-box;
    border: 1px solid var(--creme-attenuee);
    border-radius: 50%;
  }

  .dot.full {
    border-color: var(--creme);
    background: var(--creme);
  }

  /* With room (a computer, a tablet): larger names and digits, the same grid. */
  @media (min-height: 600px) {
    .rank {
      padding: var(--space-xs);
    }

    .name {
      font-size: var(--body-size);
      line-height: 20px;
    }

    .digit {
      font-size: 24px;
      line-height: 24px;
    }

    .dots {
      grid-template-columns: repeat(2, 8px);
    }

    .dot {
      width: 8px;
      height: 8px;
    }
  }

  .talon,
  .intro {
    margin: 0;
    color: var(--creme-attenuee);
  }
</style>
