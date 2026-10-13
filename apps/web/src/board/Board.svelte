<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children?: Snippet } = $props();
</script>

<div class="board">
  <img src="/plateau-1280.webp" alt="Le plateau du jeu de TOC" draggable="false" />
  <svg viewBox="0 0 2560 2560" xmlns="http://www.w3.org/2000/svg">
    {@render children?.()}
  </svg>
</div>

<style>
  .board {
    position: relative;
    width: min(100vw, 100dvh, 880px);
    aspect-ratio: 1;
  }

  img,
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  img {
    pointer-events: none;
  }
</style>
