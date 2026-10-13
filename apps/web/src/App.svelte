<script lang="ts">
  import Game from "./routes/Game.svelte";
  import Launch from "./routes/Launch.svelte";

  let hash = $state(location.hash);
  // The hash may carry a query (#/partie?debug=geometry): the route is what precedes the "?".
  const route = $derived(hash.split("?")[0]);

  $effect(() => {
    const onHashChange = () => {
      hash = location.hash;
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  });
</script>

{#if route === "#/partie"}
  <Game />
{:else}
  <Launch />
{/if}
