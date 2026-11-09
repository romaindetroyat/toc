<script lang="ts">
  import type { StatsAnswer } from "@toc/protocol";
  import { onDestroy, onMount } from "svelte";
  import { resultats } from "../i18n/fr/resultats.ts";
  import { stats } from "../results/api.ts";
  import { gamesCount, levelName, partnerLine, partnerName, rate } from "../results/format.ts";
  import NumberTile from "./NumberTile.svelte";
  import Segmented from "./Segmented.svelte";

  // « Mes chiffres » (plan 05-09, HIST-03; 05-UI-SPEC Panel 2), GET /api/me/stats read with
  // StatsAnswer: the filter « Parties comptées » (« Toutes » | « En ligne » | « Contre
  // l’ordinateur », « Toutes » by default, not saved) changes the figures at once and says so in the
  // page's live region; three number tiles (« Parties », « Victoires », « Réussite »), « Chevaux »,
  // « Avec mes partenaires » (8 rows, then « Voir tous mes partenaires » shows the rest in place) and,
  // for « Toutes » and « Contre l’ordinateur », « Contre l’ordinateur, par force » (games against two
  // computers, under the stronger one's level). No counted game: « Pas encore de chiffres »; none for
  // the filter: « Aucune partie de ce genre pour l’instant. ». Loading, slow, error as the history.
  type Props = {
    onsignedout: () => void;
    onoffline: () => void;
    announce: (text: string) => void;
  };

  let { onsignedout, onoffline, announce }: Props = $props();

  type Filter = "all" | "online" | "solo";

  const SLOW_MS = 10_000;
  const PARTNERS_SHOWN = 8;
  const copy = resultats.stats;

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: copy.all },
    { value: "online", label: copy.online },
    { value: "solo", label: copy.solo },
  ];

  let status = $state<"loading" | "ready" | "error">("loading");
  let slow = $state(false);
  let answer = $state<StatsAnswer | null>(null);
  let filter = $state<Filter>("all");
  let allPartners = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const block = $derived(answer === null ? null : answer[filter]);
  const partners = $derived(
    block === null
      ? []
      : allPartners
        ? block.partners
        : block.partners.slice(0, PARTNERS_SHOWN),
  );

  async function load(): Promise<void> {
    status = "loading";
    slow = false;
    clearTimeout(timer);
    timer = setTimeout(() => (slow = true), SLOW_MS);
    const read = await stats();
    clearTimeout(timer);
    if (read === "signed-out") return onsignedout();
    if (read === "offline" && typeof navigator !== "undefined" && navigator.onLine === false) {
      return onoffline();
    }
    if (typeof read === "string") {
      status = "error";
      return;
    }
    answer = read;
    status = "ready";
  }

  function choose(value: Filter) {
    if (value === filter || answer === null) return;
    filter = value;
    allPartners = false;
    const label = filters.find((each) => each.value === value)?.label ?? "";
    announce(copy.announce(label, gamesCount(answer[value].games)));
  }

  function showAll() {
    allPartners = true;
    if (block !== null) announce(copy.partners.shown(block.partners.length));
  }

  onMount(() => {
    void load();
  });

  onDestroy(() => clearTimeout(timer));
</script>

{#if status === "loading"}
  <p class="t-label muted">{copy.loading}</p>
  {#if slow}<p class="t-label muted">{resultats.slow}</p>{/if}
{:else if status === "error"}
  <div class="error-row">
    <p class="t-label">{copy.error}</p>
    <button type="button" class="btn btn-text" onclick={() => void load()}>
      {resultats.history.retry}
    </button>
  </div>
{:else if answer !== null && block !== null}
  {#if answer.all.games === 0}
    <div class="empty" data-stats-empty>
      <p class="t-body strong">{copy.empty.heading}</p>
      <p class="t-body">{copy.empty.body}</p>
    </div>
  {:else}
    <div class="stats" data-stats={filter}>
      <Segmented options={filters} value={filter} label={copy.filter} onchange={choose} />

      {#if block.games === 0}
        <p class="t-body" data-stats-empty-filter>{copy.empty.filter}</p>
      {:else}
        <dl class="tiles" data-number-tiles>
          <NumberTile name="parties" label={copy.tiles.games} value={String(block.games)} />
          <NumberTile name="victoires" label={copy.tiles.wins} value={String(block.wins)} />
          <NumberTile name="reussite" label={copy.tiles.rate} value={rate(block.wins, block.games)} />
        </dl>

        <section class="section" aria-labelledby="stats-knights">
          <h3 id="stats-knights" class="t-heading">{copy.knights.heading}</h3>
          <ul class="lines">
            <li class="line" data-knights="captured">
              <span>{copy.knights.captured}</span><span class="figure">{block.captured}</span>
            </li>
            <li class="line" data-knights="lost">
              <span>{copy.knights.lost}</span><span class="figure">{block.lost}</span>
            </li>
            <li class="line" data-knights="home">
              <span>{copy.knights.home}</span><span class="figure">{block.home}</span>
            </li>
          </ul>
        </section>

        {#if block.partners.length > 0}
          <section class="section" aria-labelledby="stats-partners">
            <h3 id="stats-partners" class="t-heading">{copy.partners.heading}</h3>
            <ul class="lines">
              {#each partners as partner, i (`${partner.kind}:${partner.name ?? ""}:${partner.level ?? ""}:${i}`)}
                {@const name = partnerName(partner)}
                <li class="line" data-partner-row>
                  <span class="name" title={name}>{name}</span>
                  <span class="figure small">{partnerLine(partner.games, partner.wins)}</span>
                </li>
              {/each}
            </ul>
            {#if !allPartners && block.partners.length > PARTNERS_SHOWN}
              <button type="button" class="btn btn-text more" onclick={showAll}>
                {copy.partners.more}
              </button>
            {/if}
          </section>
        {/if}

        {#if filter !== "online" && block.levels.length > 0}
          <section class="section" aria-labelledby="stats-levels">
            <h3 id="stats-levels" class="t-heading">{copy.levels.heading}</h3>
            <p class="t-label muted">{copy.levels.intro}</p>
            <ul class="lines">
              {#each block.levels as entry (entry.level)}
                <li class="line" data-level-row={entry.level}>
                  <span class="name">{levelName(entry.level)}</span>
                  <span class="figure small">{partnerLine(entry.games, entry.wins)}</span>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      {/if}
    </div>
  {/if}
{/if}

<style>
  p,
  h3 {
    margin: 0;
  }

  .muted {
    color: var(--creme-attenuee);
  }

  .strong {
    font-weight: 700;
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .error-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
  }

  .stats {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-sm);
    margin: 0;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }

  .lines {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* A statistic row: 44, the label left in Body, the figure right in Body 700, a 1 px rule between. */
  .line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    min-height: var(--touch);
    border-top: 1px solid var(--brun-aide-memoire);
  }

  .line:first-child {
    border-top: 0;
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .figure {
    flex: none;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .figure.small {
    font-size: var(--label-size);
  }

  .more {
    align-self: flex-start;
  }
</style>
