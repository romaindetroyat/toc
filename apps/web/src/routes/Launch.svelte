<script lang="ts">
  import { unlock } from "../audio/engine.ts";
  import { launch } from "../i18n/fr/launch.ts";

  function play() {
    // The AudioContext must be created and resumed synchronously inside this tap.
    unlock();
    location.hash = "#/partie";
  }
</script>

<main class="launch">
  <h1>{launch.title}</h1>
  <p class="tagline">{launch.tagline}</p>
  <button type="button" class="primary" onclick={play}>{launch.play}</button>
</main>

<style>
  .launch {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    text-align: center;
  }

  h1 {
    margin: 0;
    font-size: 64px;
    letter-spacing: 0.08em;
  }

  .tagline {
    margin: 0 0 16px;
    color: #cdb89e;
  }

  .primary {
    min-width: 220px;
    height: 48px;
    padding: 0 24px;
    border: 0;
    border-radius: 12px;
    background: var(--ambre);
    color: var(--noyer);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
</style>
