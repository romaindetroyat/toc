<script lang="ts">
  import type { RankingAnswer } from "@toc/protocol";
  import { onDestroy, onMount } from "svelte";
  import { unlock } from "../audio/engine.ts";
  import { resultats } from "../i18n/fr/resultats.ts";
  import { browserApi, createTable } from "../net/api.ts";
  import { ranking } from "../results/api.ts";
  import { markNewTable } from "./InviteSheet.svelte";
  import RankingSheet from "./RankingSheet.svelte";
  import RankRow from "./RankRow.svelte";
  import { showToast } from "./toast.svelte.ts";

  // « Classement » (plan 05-09, HIST-04, D-02, D-13; 05-UI-SPEC Panel 3), GET /api/me/ranking read
  // with RankingAnswer: the signed-in player and their friends, each by all their ranked games (online,
  // finished, two accounts at least); 5 games to enter; the win rate, then wins, then games; tied
  // players share their rank. The intro, the ranked rows (one's own with « toi » and a cream
  // outline), then « Pas encore au classement » with « {n} parties sur 5 ». No friend: « Pas encore
  // d’amis sur TOC » and « Mes amis »; friends but nobody ranked: « Personne n’est encore au
  // classement » and « Créer une table en ligne » (the home's flow). « Comment ça marche ? » opens
  // « Le classement ». Loading, slow, error as the history. Pseudos only, never an id.
  type Props = {
    onsignedout: () => void;
    onoffline: () => void;
  };

  let { onsignedout, onoffline }: Props = $props();

  const SLOW_MS = 10_000;
  const copy = resultats.ranking;

  let status = $state<"loading" | "ready" | "error">("loading");
  let slow = $state(false);
  let answer = $state<RankingAnswer | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function load(): Promise<void> {
    status = "loading";
    slow = false;
    clearTimeout(timer);
    timer = setTimeout(() => (slow = true), SLOW_MS);
    const read = await ranking();
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

  onMount(() => {
    void load();
  });

  onDestroy(() => clearTimeout(timer));

  // --- « Créer une table en ligne » (the home's flow: POST /api/tables, then the table's link) ---
  let creating = $state(false);

  async function create() {
    unlock();
    if (creating) return;
    if (!browserApi.online()) {
      showToast(copy.nobody.offline);
      return;
    }
    creating = true;
    const result = await createTable();
    creating = false;
    if (result.ok) {
      markNewTable(result.id);
      location.hash = `#/table/${result.id}`;
      return;
    }
    showToast(result.reason === "offline" ? copy.nobody.offline : copy.nobody.failed);
  }

  // --- « Comment ça marche ? » ---
  let howOpen = $state(false);
  let howButton = $state<HTMLButtonElement | null>(null);
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
{:else if answer !== null}
  <div class="ranking" data-ranking>
    {#if answer.friends === 0}
      <div class="empty" data-ranking-empty="amis">
        <p class="t-body strong">{copy.noFriend.heading}</p>
        <p class="t-body">{copy.noFriend.body}</p>
        <a class="btn btn-primary link" href="#/amis">{copy.noFriend.friends}</a>
      </div>
    {:else}
      <p class="t-label muted">{copy.intro}</p>
      {#if answer.ranked.length === 0}
        <div class="empty" data-ranking-empty="personne">
          <p class="t-body strong">{copy.nobody.heading}</p>
          <p class="t-body">{copy.nobody.body}</p>
          <button
            type="button"
            class="btn btn-secondary"
            aria-busy={creating}
            onclick={() => void create()}
          >
            {creating ? copy.nobody.creating : copy.nobody.create}
          </button>
        </div>
      {:else}
        <ul class="rows" data-ranked>
          {#each answer.ranked as row (row.pseudo)}
            <RankRow kind="ranked" {row} />
          {/each}
        </ul>
      {/if}
      {#if answer.unranked.length > 0}
        <section class="section" aria-labelledby="ranking-unranked">
          <h3 id="ranking-unranked" class="t-heading">{copy.unranked.heading}</h3>
          <p class="t-label muted">{copy.unranked.line}</p>
          <ul class="rows" data-unranked>
            {#each answer.unranked as row (row.pseudo)}
              <RankRow kind="unranked" {row} />
            {/each}
          </ul>
        </section>
      {/if}
    {/if}
    <button
      type="button"
      class="btn btn-text how"
      aria-haspopup="dialog"
      bind:this={howButton}
      onclick={() => (howOpen = true)}
    >
      {copy.how}
    </button>
  </div>
{/if}

{#if howOpen}
  <RankingSheet opener={howButton} onclose={() => (howOpen = false)} />
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

  .ranking {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
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

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }

  .how {
    align-self: flex-start;
  }
</style>
