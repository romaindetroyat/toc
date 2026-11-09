<script lang="ts">
  import { deckCount, type PlayerView, RANKS, type Rank } from "@toc/engine";
  import { rankName } from "../i18n/fr/cards.ts";
  import { paquet } from "../i18n/fr/paquet.ts";
  import Sheet from "./Sheet.svelte";

  // « Les cartes du paquet » (quick task 261109-6an): for each of the 13 ranks, how many of its 4 cards
  // the player has not seen in this pack (four dots, filled for the hidden ones, and the digit), the As,
  // the 7, the Valet and the Roi set apart, and the deal of the pack with the talon. The count is the
  // engine's deckCount on the seat's PlayerView: the very pool the computer players remember
  // (packages/bots/src/knowledge.ts), never a hidden card nor where it lies (T-6an-01).
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
      const hidden = count.hidden[rank];
      return { rank, name, hidden, key: KEY_RANKS.has(rank), line: paquet.rank(name, hidden) };
    }),
  );
</script>

<Sheet title={paquet.title} closeLabel={paquet.close} {onclose} {opener}>
  <div class="paquet">
    <p class="deal t-label" data-deck-deal>{paquet.deal(count.deal, count.talon)}</p>
    <ul class="ranks" data-deck-ranks>
      {#each ranks as item (item.rank)}
        <li
          class="rank"
          class:key={item.key}
          data-deck-rank={item.rank}
          data-hidden={item.hidden}
          data-key-rank={item.key ? "" : undefined}
        >
          <span class="face" aria-hidden="true">
            <span class="name">{item.name}</span>
            <span class="dots">
              {#each DOTS as dot (dot)}
                <span class="dot" class:full={dot < item.hidden}></span>
              {/each}
            </span>
            <span class="digit">{item.hidden}</span>
          </span>
          <span class="sr-only">{item.line}</span>
        </li>
      {/each}
    </ul>
    <p class="intro t-label">{paquet.intro}</p>
  </div>
</Sheet>

<style>
  .paquet {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .deal {
    margin: 0;
    font-weight: 700;
  }

  /* 7 columns in the 432 px body of the 480 px sheet, so the 13 ranks take two rows. */
  .ranks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rank {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    max-height: 64px;
    padding: var(--space-xs);
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
    gap: var(--space-xs);
  }

  .name {
    font-size: var(--label-size);
    line-height: 16px;
    white-space: nowrap;
  }

  .rank.key .name {
    font-weight: 700;
  }

  .dots {
    display: flex;
    gap: 2px;
  }

  .dot {
    width: 8px;
    height: 8px;
    box-sizing: border-box;
    border: 1px solid var(--creme-attenuee);
    border-radius: 50%;
  }

  .dot.full {
    border-color: var(--creme);
    background: var(--creme);
  }

  .digit {
    font-size: var(--body-size);
    font-weight: 700;
    line-height: 16px;
  }

  .intro {
    margin: 0;
    color: var(--creme-attenuee);
  }
</style>
