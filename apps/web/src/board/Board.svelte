<script module lang="ts">
  /** The burst of the fourth knight home: where, when and how long; onDone ends it. */
  export type Burst = {
    x: number;
    y: number;
    delayMs: number;
    durationMs: number;
    onDone: () => void;
  };
</script>

<script lang="ts">
  import type { CardId, RenderState } from "@toc/engine";
  import type { Snippet } from "svelte";
  import { board as t } from "../i18n/fr/board.ts";
  import FeltTable from "./FeltTable.svelte";
  import Particles from "./Particles.svelte";

  // k = clockwise quarter turns of the art (D-05). Only the art turns: the overlay svg stays upright
  // and its children are placed at anchorOf(place, k).
  // `under` and `over` are drawn behind and in front of the knights (`children`), `hits` on top of
  // all; each receives the number of board units per screen pixel.
  // With a render state the felt is drawn as a card table under all of them (D-08).
  // `burst` puts the particles of the party above the knights.
  let {
    k = 0,
    render,
    discardTop = null,
    burst = null,
    children,
    under,
    over,
    hits,
  }: {
    k?: number;
    render?: RenderState | null;
    /** The card on top of the défausse, or null when it is empty. */
    discardTop?: CardId | null;
    burst?: Burst | null;
    children?: Snippet;
    under?: Snippet<[number]>;
    over?: Snippet<[number]>;
    hits?: Snippet<[number]>;
  } = $props();
  const turn = $derived(`rotate(${k * 90}deg)`);

  // The three composites produced by tools/build-board.mjs; the browser picks one from `sizes`.
  const SRCSET = "/plateau-640.webp 640w, /plateau-1280.webp 1280w, /plateau-2560.webp 2560w";
  const FALLBACK = "/plateau-1280.webp";

  let status = $state<"loading" | "loaded" | "error">("loading");
  let attempt = $state(0);
  let width = $state(0);
  const px = $derived(width > 0 ? 2560 / width : 1);
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
  data-k={k}
  bind:clientWidth={width}
  style:--px={px}
>
  <!-- Backdrop while the image loads: oak with the felt square, no spinner. -->
  <div class="felt" aria-hidden="true" style:transform={turn}></div>
  <img
    bind:this={img}
    src={bust(FALLBACK)}
    srcset={bust(SRCSET)}
    sizes={width > 0 ? `${width}px` : "100vw"}
    alt={t.alt}
    style:transform={turn}
    draggable="false"
    onload={() => {
      status = "loaded";
    }}
    onerror={() => {
      status = "error";
    }}
  />
  <svg viewBox="0 0 2560 2560" xmlns="http://www.w3.org/2000/svg">
    {#if render}
      <FeltTable {render} {discardTop} {k} {px} />
    {/if}
    {@render under?.(px)}
    {@render children?.()}
    {#if burst}
      <Particles
        x={burst.x}
        y={burst.y}
        delayMs={burst.delayMs}
        durationMs={burst.durationMs}
        onDone={burst.onDone}
      />
    {/if}
    {@render over?.(px)}
    {@render hits?.(px)}
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
    /* A knight is 190 units tall and the stables closest to the top edge sit about 94 units below
       it, so a head can rise up to 4 % of the board above the art: reserve that room above the
       board and let the overlay draw outside its box. */
    --side: var(--board-size, min(100vw, 100dvh, 880px));
    position: relative;
    width: var(--side);
    margin-top: calc(var(--side) * 0.04);
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

  svg {
    overflow: visible;
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
