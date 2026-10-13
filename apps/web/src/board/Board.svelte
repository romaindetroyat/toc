<script lang="ts">
  import type { Snippet } from "svelte";
  import { board as t } from "../i18n/fr/board.ts";

  let { children }: { children?: Snippet } = $props();

  // The three composites produced by tools/build-board.mjs; the browser picks one from `sizes`.
  const SRCSET = "/plateau-640.webp 640w, /plateau-1280.webp 1280w, /plateau-2560.webp 2560w";
  const FALLBACK = "/plateau-1280.webp";

  let status = $state<"loading" | "loaded" | "error">("loading");
  let attempt = $state(0);
  let width = $state(0);
  let img = $state<HTMLImageElement>();

  // « Réessayer » reassigns every source with a cache-busting query.
  const bust = (sources: string) =>
    attempt === 0 ? sources : sources.replaceAll(".webp", `.webp?r=${attempt}`);

  // An image served from the cache can finish before the load listener exists.
  $effect(() => {
    if (img?.complete && img.naturalWidth > 0) status = "loaded";
  });

  function retry() {
    attempt += 1;
    status = "loading";
  }
</script>

<div
  class="board"
  class:loaded={status === "loaded"}
  data-board
  bind:clientWidth={width}
  style:--px={width > 0 ? 2560 / width : 1}
>
  <!-- Backdrop while the image loads: oak with the felt square, no spinner. -->
  <div class="felt" aria-hidden="true"></div>
  <img
    bind:this={img}
    src={bust(FALLBACK)}
    srcset={bust(SRCSET)}
    sizes={width > 0 ? `${width}px` : "100vw"}
    alt={t.alt}
    draggable="false"
    onload={() => {
      status = "loaded";
    }}
    onerror={() => {
      status = "error";
    }}
  />
  <svg viewBox="0 0 2560 2560" xmlns="http://www.w3.org/2000/svg">
    {@render children?.()}
  </svg>
  {#if status === "error"}
    <div class="failed" role="alert">
      <p>{t.loadFailed}</p>
      <button type="button" onclick={retry}>{t.retry}</button>
    </div>
  {/if}
</div>

<style>
  .board {
    position: relative;
    width: var(--board-size, min(100vw, 100dvh, 880px));
    aspect-ratio: 1;
    background: #d8c6b0;
    container-type: inline-size;
    flex: none;
  }

  /* Felt square: x and y 853..1707 of 2560 board units. */
  .felt {
    position: absolute;
    left: 33.32%;
    top: 33.32%;
    width: 33.36%;
    height: 33.36%;
    background: #005400;
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
    opacity: 0;
    transition: opacity 200ms ease-out;
  }

  .loaded img {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    img {
      transition: none;
    }
  }

  .failed {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8%;
    text-align: center;
    color: #2b1d12;
    font-size: max(13px, 4.4cqw);
    background: rgb(216 198 176 / 0.92);
  }

  .failed p {
    margin: 0;
  }

  .failed button {
    min-width: 44px;
    min-height: 44px;
    padding: 0 20px;
    border: 0;
    border-radius: 8px;
    background: var(--ambre);
    color: var(--noyer);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
</style>
