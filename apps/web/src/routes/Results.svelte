<script lang="ts">
  import type { HistoryGame } from "@toc/protocol";
  import { onMount } from "svelte";
  import { account, requireSignIn } from "../account/store.svelte.ts";
  import { resultats } from "../i18n/fr/resultats.ts";
  import { browserApi } from "../net/api.ts";
  import { history } from "../results/api.ts";
  import GameRow from "../ui/GameRow.svelte";
  import OfflinePage from "../ui/OfflinePage.svelte";
  import Page from "../ui/Page.svelte";

  // « Mes résultats » at #/resultats (plan 05-01, HIST-02; 05-UI-SPEC « Mes résultats »), the « Page »
  // layout of « Mon compte »: the header (« Accueil », the h1, which takes the focus), then the
  // history: the signed-in player's finished games, newest first (GET /api/me/results). Plan 05-09
  // adds the navigation, the months, the paging, the detail sheet, « Mes chiffres » and « Classement ».
  // Signed out: the home with the sign-in sheet and the session toast (as « Mon compte »). Offline:
  // the 04 offline page. Not behind « Tourne ton téléphone ».

  let online = $state(typeof navigator === "undefined" || navigator.onLine !== false);
  let status = $state<"loading" | "ready" | "error">("loading");
  let games = $state<HistoryGame[]>([]);
  let now = $state(Date.now());

  let leaving = false;

  function signedOutHere() {
    if (leaving) return;
    leaving = true;
    requireSignIn();
  }

  async function load(): Promise<void> {
    if (!browserApi.online()) {
      online = false;
      return;
    }
    online = true;
    status = "loading";
    const answer = await history(null);
    if (answer === "offline") {
      if (!browserApi.online()) online = false;
      else status = "error";
      return;
    }
    if (answer === "signed-out") {
      signedOutHere();
      return;
    }
    if (answer === "error") {
      status = "error";
      return;
    }
    games = answer.games;
    now = Date.now();
    status = "ready";
  }

  onMount(() => {
    void load();
  });

  // The store cleared the account meanwhile (its own GET /api/me met a 401).
  let hadAccount = account.current !== null;
  $effect(() => {
    if (account.current !== null) {
      hadAccount = true;
      return;
    }
    if (hadAccount) signedOutHere();
  });
</script>

{#if !online}
  <OfflinePage onretry={() => void load()} />
{:else}
  <Page
    title={resultats.title}
    homeLabel={resultats.home}
    busy={status === "loading"}
    attrs={{ "data-results": "" }}
  >
    {#snippet left()}
      <p class="t-label muted">{resultats.since}</p>
    {/snippet}

    {#snippet right()}
      <section class="panel" aria-labelledby="history-heading" data-results-panel="historique">
        <h2 id="history-heading" class="sr-only" tabindex="-1">{resultats.history.heading}</h2>
        {#if status === "loading"}
          <p class="t-label muted">{resultats.history.loading}</p>
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
            <button
              type="button"
              class="btn btn-primary"
              onclick={() => (location.hash = "#/ordinateur")}
            >
              {resultats.history.empty.solo}
            </button>
          </div>
        {:else}
          <ul class="rows" data-history>
            {#each games as game (game.id)}
              <li><GameRow {game} {now} /></li>
            {/each}
          </ul>
        {/if}
      </section>
    {/snippet}
  </Page>
{/if}

<style>
  p {
    margin: 0;
  }

  .muted {
    color: var(--creme-attenuee);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  .strong {
    font-weight: 700;
  }

  .error-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
  }
</style>
