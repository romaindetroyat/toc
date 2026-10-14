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
  import { bottomOf, SCENE } from "@toc/board";
  import type { CardId, RenderState } from "@toc/engine";
  import type { Snippet } from "svelte";
  import { game } from "../i18n/fr/game.ts";
  import BoardArt from "./BoardArt.svelte";
  import CardFlights, { type Flight } from "./CardFlights.svelte";
  import FeltTable from "./FeltTable.svelte";
  import Particles from "./Particles.svelte";

  // Board C+ in portrait 2:3 (D-05, D-07: decided by Romain). k = the seat at the bottom (bleu 0,
  // vert 1, rouge 2, jaune 3). The drawing never turns: each colour takes its side, the next seat
  // clockwise on the left and the previous one on the right (the seating by colour of D-05,
  // « à confirmer par Romain »), and every child is placed at anchorOf(place, k) = sceneXY(place, k).
  // `under` and `over` are drawn behind and in front of the knights (`children`), `hits` on top of
  // all; each receives the number of scene units per screen pixel.
  // With a render state the felt is drawn as a card table under all of them (D-08).
  // `burst` puts the particles of the party above the knights; `flights` the cards that are moving.
  let {
    k = 0,
    render,
    discardTop = null,
    burst = null,
    flights = [],
    ontapis,
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
    /** The cards in flight: dealt, played, exchanged or laid down. */
    flights?: Flight[];
    /** A tap (or Entrée) on the felt: the game opens « Sur le tapis ». */
    ontapis?: () => void;
    children?: Snippet;
    under?: Snippet<[number]>;
    over?: Snippet<[number]>;
    hits?: Snippet<[number]>;
  } = $props();

  let width = $state(0);
  const px = $derived(width > 0 ? SCENE.width / width : 1);

  // The felt button covers SCENE.felt, as percentages of the scene.
  const pct = (value: number, of: number) => `${(value / of) * 100}%`;
  const felt = {
    left: pct(SCENE.felt.x, SCENE.width),
    top: pct(SCENE.felt.y, SCENE.height),
    width: pct(SCENE.felt.w, SCENE.width),
    height: pct(SCENE.felt.h, SCENE.height),
  };
</script>

<!-- The drawing is synchronous: `loaded` is the readiness signal the specs wait for, set at once. -->
<div
  class="board loaded"
  data-board
  data-k={k}
  data-bottom={bottomOf(k)}
  bind:clientWidth={width}
  style:--px={px}
>
  <svg viewBox={`0 0 ${SCENE.width} ${SCENE.height}`} xmlns="http://www.w3.org/2000/svg">
    <BoardArt {k} />
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
    {#if flights.length > 0}
      <CardFlights {flights} {px} />
    {/if}
    {@render over?.(px)}
    {@render hits?.(px)}
  </svg>
  {#if render && ontapis}
    <!-- The whole felt is one target (D-08): no knight's body stands on it, so it never hides a tap
         (only the head of a knight on a deepest home slot reaches over its edge; it is tapped on its body). -->
    <button
      type="button"
      class="tapis"
      aria-label={game.tapis.title}
      aria-haspopup="dialog"
      data-felt-button
      style:left={felt.left}
      style:top={felt.top}
      style:width={felt.width}
      style:height={felt.height}
      onclick={ontapis}
    ></button>
  {/if}
</div>

<style>
  .board {
    /* --board-size is the board's width; it is 1.5 times as tall (2:3). The head of a lifted
       top-row knight rises --head-room of the width above the drawing (SCENE.headRoom): that room
       stays free above the board and the svg draws outside its box. No background: the rounded oak
       board and its walnut rim are part of the drawing. */
    --side: var(--board-size, min(100vw, 100dvh / 1.55, 586px));
    position: relative;
    width: var(--side);
    margin-top: calc(var(--side) * var(--head-room, 0.0466));
    aspect-ratio: 2 / 3;
    container-type: inline-size;
    flex: none;
  }

  /* Invisible button over the felt (SCENE.felt, placed by its inline percentages). */
  .tapis {
    position: absolute;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }
</style>
