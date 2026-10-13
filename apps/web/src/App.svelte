<script lang="ts">
  import Game from "./routes/Game.svelte";
  import Launch from "./routes/Launch.svelte";

  let hash = $state(location.hash);

  $effect(() => {
    const onHashChange = () => {
      hash = location.hash;
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  });
</script>

{#if hash === "#/partie"}
  <Game />
{:else}
  <Launch />
{/if}
