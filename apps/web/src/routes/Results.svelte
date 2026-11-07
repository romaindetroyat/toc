<script lang="ts">
  import { tick } from "svelte";
  import { account, requireSignIn } from "../account/store.svelte.ts";
  import { resultats } from "../i18n/fr/resultats.ts";
  import { browserApi } from "../net/api.ts";
  import HistoryList from "../ui/HistoryList.svelte";
  import OfflinePage from "../ui/OfflinePage.svelte";
  import Page from "../ui/Page.svelte";
  import { pageLayout } from "../ui/pageLayout.svelte.ts";
  import ResultsNav, { type ResultsTab, tabOf } from "../ui/ResultsNav.svelte";
  import RankingPanel from "../ui/RankingPanel.svelte";
  import StatsPanel from "../ui/StatsPanel.svelte";

  // « Mes résultats » at #/resultats (plans 05-01 and 05-09, HIST-02..04; 05-UI-SPEC « Mes
  // résultats »), the « Page » layout of « Mon compte »: the header (« Accueil », the h1, which takes
  // the focus), then the navigation and one panel. The sub-route picks the panel: #/resultats
  // « Historique », #/resultats/chiffres « Mes chiffres », #/resultats/classement « Classement »;
  // they are hash links, so the back button walks them, and a change of panel gives the focus to the
  // panel's h2 (sr-only, tabindex -1). In two columns and on the computer the nav is the left column
  // with the note « Les parties comptent depuis novembre 2026. » (D-04) under it; in one column and
  // upright, a segmented row above the panel and the note at the bottom. One polite live region says
  // what changed (« 25 parties »). Signed out: the home with the sign-in sheet and the session toast.
  // Offline: the 04 offline page. Not behind « Tourne ton téléphone ».

  const layout = pageLayout();
  const form = $derived(
    layout.value === "computer" || layout.value === "two" ? ("column" as const) : ("bar" as const),
  );

  const routeOf = () => location.hash.split("?")[0] ?? "";
  let tab = $state<ResultsTab>(tabOf(routeOf()));
  let online = $state(browserApi.online());
  /** Bumped by « Réessayer » of the offline page: the panel loads again. */
  let attempt = $state(0);
  let live = $state("");
  let heading = $state<HTMLHeadingElement | null>(null);

  const headings: Record<ResultsTab, string> = {
    historique: resultats.history.heading,
    chiffres: resultats.panels.stats,
    classement: resultats.panels.ranking,
  };

  $effect(() => {
    const changed = async () => {
      const next = tabOf(routeOf());
      if (!routeOf().startsWith("#/resultats") || next === tab) return;
      tab = next;
      live = "";
      await tick();
      heading?.focus();
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  });

  let leaving = false;

  function signedOutHere() {
    if (leaving) return;
    leaving = true;
    requireSignIn();
  }

  function offline() {
    online = false;
  }

  function retry() {
    if (!browserApi.online()) return;
    online = true;
    attempt += 1;
  }

  function announce(text: string) {
    live = text;
  }

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

{#snippet note(spaced: boolean)}
  <p class="t-label muted" class:spaced data-results-since>{resultats.since}</p>
{/snippet}

{#if !online}
  <OfflinePage onretry={retry} />
{:else}
  <Page title={resultats.title} homeLabel={resultats.home} attrs={{ "data-results": "" }}>
    {#snippet left()}
      <ResultsNav current={tab} {form} />
      {#if form === "column"}{@render note(true)}{/if}
    {/snippet}

    {#snippet right()}
      <section class="panel" aria-labelledby="results-panel-heading" data-results-panel={tab}>
        <h2 id="results-panel-heading" class="sr-only" tabindex="-1" bind:this={heading}>
          {headings[tab]}
        </h2>
        {#key `${tab}:${attempt}`}
          {#if tab === "historique"}
            <HistoryList onsignedout={signedOutHere} onoffline={offline} {announce} />
          {:else if tab === "chiffres"}
            <StatsPanel onsignedout={signedOutHere} onoffline={offline} {announce} />
          {:else}
            <RankingPanel onsignedout={signedOutHere} onoffline={offline} />
          {/if}
        {/key}
      </section>
      {#if form === "bar"}{@render note(false)}{/if}
      <p class="sr-only" aria-live="polite" data-results-live>{live}</p>
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

  .spaced {
    margin-top: var(--space-md);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
</style>
