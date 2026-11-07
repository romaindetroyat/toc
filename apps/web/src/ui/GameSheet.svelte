<script lang="ts">
  import type { HistoryGame } from "@toc/protocol";
  import { resultats } from "../i18n/fr/resultats.ts";
  import { type SheetSeat, sheetOf } from "../results/format.ts";
  import SeatChip from "./SeatChip.svelte";
  import Sheet from "./Sheet.svelte";

  // The detail of one game of « Mes résultats » (plan 05-09; 05-UI-SPEC « Game detail sheet »): the
  // normal sheet « Partie du samedi 24 octobre », the kind (« En ligne, à la table de {Créateur} » or
  // « Contre l’ordinateur »), the result (Heading), the knights home per team, the two teams (« Ton
  // équipe » first) with each seat's chip, name and tags (« toi », « (sans compte) », « (ordinateur) »,
  // « l’ordinateur a fini à sa place »), the times, the deals, the knights eaten, and what the game
  // counts for. A computer is its level, never its horse name. The focus goes back to the row on
  // close. Text bindings only.
  type Props = {
    game: HistoryGame;
    now: number;
    opener: HTMLElement | null;
    onclose: () => void;
  };

  let { game, now, opener, onclose }: Props = $props();

  const text = $derived(sheetOf(game, now));
  const copy = resultats.sheet;
</script>

{#snippet team(heading: string, seats: SheetSeat[], hook: string)}
  <section class="team" data-sheet-team={hook}>
    <h3 class="t-label team-heading">{heading}</h3>
    <ul class="seats">
      {#each seats as seat (seat.colour)}
        <li class="seat" data-sheet-seat={seat.colour}>
          <SeatChip color={seat.colour} />
          <span class="name" title={seat.name}>{seat.name}</span>
          {#each seat.tags as tag (tag)}
            <span class="tag t-label">{tag}</span>
          {/each}
        </li>
      {/each}
    </ul>
  </section>
{/snippet}

<Sheet title={text.title} closeLabel={copy.close} {opener} {onclose}>
  <div class="detail" data-game-sheet>
    <p class="t-body">{text.kind}</p>
    <p class="t-heading result">{text.result}</p>
    <p class="t-body tabular">{text.score}</p>
    {@render team(copy.mine, text.mine, "mine")}
    {@render team(copy.theirs, text.theirs, "theirs")}
    <ul class="facts t-label tabular">
      <li>{text.span}</li>
      <li>{text.deals}</li>
      <li>{text.eaten}</li>
    </ul>
    <p class="t-label muted" data-sheet-counting>{text.counting}</p>
  </div>
</Sheet>

<style>
  p,
  h3 {
    margin: 0;
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .result {
    margin-top: var(--space-xs);
  }

  .team {
    display: flex;
    flex-direction: column;
    margin-top: var(--space-sm);
  }

  .team-heading {
    color: var(--creme-attenuee);
    font-weight: 700;
    line-height: 20px;
  }

  .seats,
  .facts {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .seat {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: var(--space-sm);
    min-height: 36px;
  }

  .name {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag,
  .muted {
    color: var(--creme-attenuee);
  }

  .facts {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin-top: var(--space-sm);
  }
</style>
