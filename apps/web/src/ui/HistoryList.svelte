<script lang="ts">
  import type { HistoryGame } from "@toc/protocol";
  import { onDestroy, onMount } from "svelte";
  import { resultats } from "../i18n/fr/resultats.ts";
  import { history } from "../results/api.ts";
  import { gamesCount, groupByMonth } from "../results/format.ts";
  import GameRow from "./GameRow.svelte";
  import GameSheet from "./GameSheet.svelte";
  import { showToast } from "./toast.svelte.ts";

  // « Historique » (plan 05-09; 05-UI-SPEC Panel 1): the signed-in player's finished games, newest
  // first, grouped by month under a heading (one game has its heading too), 20 at a time
  // (GET /api/me/results). « Voir les parties plus anciennes » (busy « Chargement… », aria-busy)
  // adds the next 20 after the last cursor, without a game twice; when nothing is left, « C’est
  // tout… ». A failing next page says so in a toast and the button stays. Loading (« La connexion est
  // lente. » after 10 s), empty, error with « Réessayer »; signed out and offline go up to the page.
  // Each row opens its detail sheet, whose close gives the focus back to the row.
  type Props = {
    /** The page leaves for the home and the sign-in sheet. */
    onsignedout: () => void;
    /** The page shows the offline page. */
    onoffline: () => void;
    /** The page's polite live region. */
    announce: (text: string) => void;
  };

  let { onsignedout, onoffline, announce }: Props = $props();

  const SLOW_MS = 10_000;

  let status = $state<"loading" | "ready" | "error">("loading");
  let slow = $state(false);
  let games = $state<HistoryGame[]>([]);
  let next = $state<string | null>(null);
  let pages = $state(0);
  let loadingMore = $state(false);
  let now = $state(Date.now());
  let timer: ReturnType<typeof setTimeout> | undefined;

  const groups = $derived(groupByMonth(games));

  async function load(): Promise<void> {
    status = "loading";
    slow = false;
    clearTimeout(timer);
    timer = setTimeout(() => (slow = true), SLOW_MS);
    const answer = await history(null);
    clearTimeout(timer);
    if (answer === "signed-out") return onsignedout();
    if (answer === "offline" && typeof navigator !== "undefined" && navigator.onLine === false) {
      return onoffline();
    }
    if (typeof answer === "string") {
      status = "error";
      return;
    }
    games = answer.games;
    next = answer.next;
    pages = 1;
    now = Date.now();
    status = "ready";
  }

  async function more(): Promise<void> {
    if (loadingMore || next === null) return;
    loadingMore = true;
    const answer = await history(next);
    loadingMore = false;
    if (answer === "signed-out") return onsignedout();
    if (typeof answer === "string") {
      showToast(resultats.history.moreFailed);
      return;
    }
    const known = new Set(games.map((game) => game.id));
    games = [...games, ...answer.games.filter((game) => !known.has(game.id))];
    next = answer.next;
    pages += 1;
    announce(gamesCount(games.length));
  }

  onMount(() => {
    void load();
  });

  onDestroy(() => clearTimeout(timer));

  // --- The detail sheet ---
  let open = $state<HistoryGame | null>(null);
  let shown = $state<HistoryGame | null>(null);
  let opener = $state<HTMLElement | null>(null);

  function openGame(game: HistoryGame, button: HTMLButtonElement) {
    opener = button;
    shown = game;
    open = game;
  }
</script>

{#if status === "loading"}
  <p class="t-label muted">{resultats.history.loading}</p>
  {#if slow}<p class="t-label muted">{resultats.slow}</p>{/if}
{:else if status === "error"}
  <div class="error-row">
    <p class="t-label">{resultats.history.error}</p>
    <button type="button" class="btn btn-text" onclick={() => void load()}>
      {resultats.history.retry}
    </button>
  </div>
{:else if games.length === 0}
  <div class="empty" data-history-empty>
    <p class="t-body strong">{resultats.history.empty.heading}</p>
    <p class="t-body">{resultats.history.empty.body}</p>
    <a class="btn btn-primary link" href="#/ordinateur">{resultats.history.empty.solo}</a>
  </div>
{:else}
  <div class="months" data-history>
    {#each groups as group (group.key)}
      <section class="month" aria-labelledby="month-{group.key}">
        <h3 id="month-{group.key}" class="t-label month-heading" data-month>{group.heading}</h3>
        <ul class="rows">
          {#each group.games as game (game.id)}
            <li><GameRow {game} {now} onopen={openGame} /></li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
  {#if next !== null}
    <button
      type="button"
      class="btn btn-secondary wide"
      aria-busy={loadingMore}
      data-history-more
      onclick={() => void more()}
    >
      {loadingMore ? resultats.history.moreBusy : resultats.history.more}
    </button>
  {:else if pages > 1}
    <p class="t-label muted" data-history-end>{resultats.history.end}</p>
  {/if}
{/if}

{#if open !== null && shown !== null}
  <GameSheet game={shown} {now} {opener} onclose={() => (open = null)} />
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
    align-items: flex-start;
    gap: var(--space-sm);
  }

  .link {
    text-decoration: none;
  }

  .error-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
  }

  .months {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .month {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .month-heading {
    color: var(--creme-attenuee);
    font-weight: 700;
    line-height: 20px;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .wide {
    width: 100%;
  }

  .wide[aria-busy="true"] {
    cursor: progress;
  }
</style>
