<script lang="ts">
  import KnightDefs from "./board/KnightDefs.svelte";
  import { game } from "./i18n/fr/game.ts";
  import Game from "./routes/Game.svelte";
  import Launch from "./routes/Launch.svelte";
  import SoundTest from "./routes/SoundTest.svelte";
  import Table from "./routes/Table.svelte";
  import Toast from "./ui/Toast.svelte";

  /** Debug builds only (route #/panne): an error thrown while the screen is drawn, to see the error screen. */
  function explode(): never {
    throw new Error("panne de test");
  }

  /** The bench page's chunk could not load (offline, a new version): the error screen takes over. */
  function rethrow(error: unknown): never {
    throw error;
  }

  /** A fresh start: back on the launch screen, so a reload cannot loop into the same error. */
  function reload() {
    location.hash = "#/";
    location.reload();
  }

  let hash = $state(location.hash);
  // The hash may carry a query (#/partie?debug=geometry): the route is what precedes the "?".
  const route = $derived(hash.split("?")[0] ?? "");
  /** An online table's link: #/table/<id> (the id is checked by the route). */
  const TABLE_PREFIX = "#/table/";
  const tableId = $derived(route.startsWith(TABLE_PREFIX) ? route.slice(TABLE_PREFIX.length) : null);

  $effect(() => {
    const onHashChange = () => {
      hash = location.hash;
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  });
</script>

<!-- The knight symbols, once for the whole document: the board and the colour tiles share them. -->
<KnightDefs />

<!-- An unexpected error never shows its text, stack or the state of the game: only a way out (T-01-33). -->
<svelte:boundary onerror={(error) => console.error(error)}>
  {#if route === "#/partie"}
    <Game />
  {:else if tableId !== null}
    {#key tableId}
      <Table id={tableId} />
    {/key}
  {:else if route === "#/sons"}
    <SoundTest />
  {:else if route === "#/banc"}
    <!-- The bench « Banc d’essai de l’ordinateur » (03-06), in every build and linked from nowhere: its
         own chunk, loaded only here. Not behind « Tourne ton téléphone »: it works held either way. -->
    {#await import("./routes/Bench.svelte") then bench}
      <bench.default />
    {:catch error}
      {rethrow(error)}
    {/await}
  {:else if __TOC_DEBUG__ && route === "#/panne"}
    {explode()}
  {:else}
    <Launch />
  {/if}

  {#snippet failed()}
    <main class="oops" role="alert" data-error-screen>
      <h1 class="t-heading">{game.error.heading}</h1>
      <p>{game.error.body}</p>
      <button type="button" class="btn btn-primary" onclick={reload}>{game.error.reload}</button>
    </main>
  {/snippet}
</svelte:boundary>

<!-- The one transient message of the app (UI-SPEC « Toast »). -->
<Toast />

<style>
  .oops {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    min-height: 100dvh;
    padding: var(--space-lg);
    text-align: center;
  }

  .oops h1,
  .oops p {
    margin: 0;
  }
</style>
