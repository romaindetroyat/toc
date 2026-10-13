<script lang="ts">
  import KnightDefs from "./board/KnightDefs.svelte";
  import Game from "./routes/Game.svelte";
  import Launch from "./routes/Launch.svelte";
  import SoundTest from "./routes/SoundTest.svelte";
  import Toast from "./ui/Toast.svelte";

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

<!-- The knight symbols, once for the whole document: the board and the colour tiles share them. -->
<KnightDefs />

{#if route === "#/partie"}
  <Game />
{:else if route === "#/sons"}
  <SoundTest />
{:else}
  <Launch />
{/if}

<!-- The one transient message of the app (UI-SPEC « Toast »). -->
<Toast />
