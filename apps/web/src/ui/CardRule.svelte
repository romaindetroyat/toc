<script lang="ts">
  import { cardFace } from "../cards/faces.ts";
  import { type CardRuleRow, type RulesTabId, regles } from "../i18n/fr/regles.ts";

  // One row of « Les cartes » (plan 05-04, 05-UI-SPEC « The cards list »): the card chips (36 x 48, the
  // rank written as Card.svelte writes it), the effect, and for the Valet and the 7 a text button that
  // opens their tab. The card chosen in the game has its row outlined in cream and named
  // « …, ta carte choisie »; nothing is added under the hand (D-05).
  type Props = {
    row: CardRuleRow;
    /** The card chosen in the game is one of this row's ranks. */
    chosen?: boolean;
    onsee: (tab: RulesTabId) => void;
  };

  let { row, chosen = false, onsee }: Props = $props();

  /** The rank as the card's corner index writes it (« A », « R », « D », « V », « 10 »). */
  const labels = $derived(row.ranks.map((rank) => cardFace(`${rank}S`).rankLabel));
  const name = $derived(regles.cardRowName(row.names, row.effect, chosen));
</script>

<li
  class="row"
  class:chosen
  aria-label={name}
  data-card-rule={row.ranks.join(" ")}
  data-chosen={chosen ? "" : undefined}
>
  <span class="chips" aria-hidden="true">
    {#each labels as label (label)}
      <span class="chip" data-card-chip>{label}</span>
    {/each}
  </span>
  <span class="effect">
    {row.effect}
    {#if row.see !== undefined}
      {@const see = row.see}
      <button type="button" class="btn btn-text see" onclick={() => onsee(see.tab)}>
        {see.label}
      </button>
    {/if}
  </span>
</li>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: var(--touch);
    padding: var(--space-xs);
    border-radius: var(--radius-card);
  }

  /* The card chosen in the game: a 2 px cream outline (never amber). */
  .row.chosen {
    outline: 2px solid var(--creme);
    outline-offset: 0;
  }

  .chips {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    max-width: calc(4 * 36px + 3 * var(--space-xs));
  }

  /* A 3:4 face with its rank in Heading 700 walnut (UI-SPEC: 36 x 48, radius 4, a 1 px line). */
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 36px;
    height: 48px;
    border: 1px solid var(--brun-aide-memoire);
    border-radius: 4px;
    background: var(--carte);
    color: var(--noyer);
    font-size: var(--heading-size);
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .effect {
    min-width: 0;
  }

  /* « Voir « Le Valet » »: a text button at the end of the row, 44 high (the global target rule). */
  .see {
    display: inline-flex;
    vertical-align: middle;
    padding: 0 var(--space-xs);
    font-size: var(--body-size);
  }
</style>
