<script lang="ts">
  import type { RankingAnswer } from "@toc/protocol";
  import { initial } from "../account/flow.ts";
  import { resultats } from "../i18n/fr/resultats.ts";
  import {
    rankedLine,
    rankLabel,
    rankName,
    rate,
    unrankedLabel,
    unrankedLine,
  } from "../results/format.ts";

  // One player of « Classement » (plan 05-09, HIST-04; 05-UI-SPEC Panel 3): 56 high, bois sombre,
  // radius 12, padding 0 12. Ranked: the rank (Heading, tabular, 28 wide, centred), 8, the initial
  // disc 40 (oak, walnut initial, hidden from screen readers), 12, the pseudo (Body 700, ellipsis)
  // with « toi » for oneself over « {n} parties · {v} victoires », and the rate at the right (Heading).
  // Not ranked yet: the disc, the pseudo and « {n} parties sur 5 ». One's own row has a 2 px cream
  // outline inside it (never amber). The row reads as one sentence (« 2e, Marie, 67 %, 12 parties,
  // 8 victoires »). A pseudo only: no account id. Text bindings only.
  type Props =
    | { kind: "ranked"; row: RankingAnswer["ranked"][number] }
    | { kind: "unranked"; row: RankingAnswer["unranked"][number] };

  let props: Props = $props();

  const row = $derived(props.row);
  const label = $derived(props.kind === "ranked" ? rankLabel(props.row) : unrankedLabel(props.row));
  const second = $derived(
    props.kind === "ranked"
      ? rankedLine(props.row.games, props.row.wins)
      : unrankedLine(props.row.games),
  );
</script>

<li
  class="row"
  class:me={row.me}
  aria-label={label}
  data-rank-row={row.pseudo}
  data-rank={props.kind === "ranked" ? props.row.rank : undefined}
>
  {#if props.kind === "ranked"}
    <span class="rank t-heading" aria-hidden="true">{rankName(props.row.rank)}</span>
  {/if}
  <span class="disc t-heading" aria-hidden="true">{initial(row.pseudo)}</span>
  <span class="text" aria-hidden="true">
    <span class="first">
      <span class="pseudo" title={row.pseudo}>{row.pseudo}</span>
      {#if row.me}<span class="tag t-label">{resultats.ranking.me}</span>{/if}
    </span>
    <span class="second t-label">{second}</span>
  </span>
  {#if props.kind === "ranked"}
    <span class="rate t-heading" aria-hidden="true">{rate(props.row.wins, props.row.games)}</span>
  {/if}
</li>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    box-sizing: border-box;
    height: 56px;
    padding: 0 12px;
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
  }

  .row.me {
    outline: 2px solid var(--creme);
    outline-offset: -2px;
  }

  .rank {
    flex: none;
    width: 28px;
    margin-right: -4px;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .disc {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--chene);
    color: var(--noyer);
  }

  .text {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
  }

  .first {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    min-width: 0;
  }

  .pseudo,
  .second {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pseudo {
    min-width: 0;
    font-weight: 700;
    line-height: 24px;
  }

  .tag {
    flex: none;
    color: var(--creme-attenuee);
  }

  .second {
    color: var(--creme-attenuee);
    line-height: 20px;
    font-variant-numeric: tabular-nums;
  }

  .rate {
    flex: none;
    font-variant-numeric: tabular-nums;
  }
</style>
