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

  // The galet board (Romain's choice of 2026-10-14: « galet partout »), the one plateau of the game,
  // in landscape (2:1) on a computer and on a phone held sideways (« paysage obligatoire »); its scene
  // is SCENE. k = the seat at the bottom (bleu 0, vert 1, rouge 2, jaune 3). The drawing never turns:
  // each colour takes its side, the next seat clockwise on the left and the previous one on the right
  // (the seating by colour of D-05, « à confirmer par Romain »), and every child is placed at
  // anchorOf(place, k) = sceneXY(place, k).
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

  const scene = SCENE;
  let width = $state(0);
  const px = $derived(width > 0 ? scene.width / width : 1);

  // The felt button covers the felt's bounding box, as percentages of the scene, and takes the felt's
  // shape, the ellipse: a 50 % radius.
  const pct = (value: number, of: number) => `${(value / of) * 100}%`;
  const felt = {
    left: pct(scene.felt.x, scene.width),
    top: pct(scene.felt.y, scene.height),
    width: pct(scene.felt.w, scene.width),
    height: pct(scene.felt.h, scene.height),
    radius: "50%",
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
  style:aspect-ratio={`${scene.width} / ${scene.height}`}
>
  <!-- The drawing in its own svg, under the game's, promoted to a layer of its own: the knights'
       motions never repaint its noise filters (T-01-51). -->
  <svg
    class="art-layer"
    viewBox={`0 0 ${scene.width} ${scene.height}`}
    xmlns="http://www.w3.org/2000/svg"
  >
    <BoardArt {k} />
  </svg>
  <svg viewBox={`0 0 ${scene.width} ${scene.height}`} xmlns="http://www.w3.org/2000/svg">
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
      style:border-radius={felt.radius}
      onclick={ontapis}
    ></button>
  {/if}
</div>

<style>
  .board {
    /* --board-size is the board's width; its height is the scene's, half of it (the inline
       aspect-ratio). The head of a lifted top-row knight rises --head-room of the width above the
       drawing (SCENE.headRoom): that room stays free above the board and the svg draws outside its
       box. No background: the oak galet and its walnut rim are part of the drawing. */
    --side: var(--board-size, min(100vw, 100dvh / 1.55, 586px));
    position: relative;
    width: var(--side);
    margin-top: calc(var(--side) * var(--head-room, 0.0217));
    container-type: inline-size;
    flex: none;
  }

  /* Invisible button over the felt (its bounding box and shape, placed by its inline percentages). */
  .tapis {
    position: absolute;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  /* Below 314 px of board the felt (448 of the landscape galet's 3200 units) is less than 44 px tall,
     so its button outgrows it and covers the knights around it. No supported screen gets there any
     more (the smallest, 480 x 320, has a 360 px board since plan 01-47), but a window can be
     squeezed. While knights are lit the button then lets the tap through to them: the hit layer
     picks a knight or reports a miss. The felt stays a 44 px target the rest of the time and to the
     keyboard. */
  @container (max-width: 314px) {
    .board:has(:global([data-hit-layer])) .tapis {
      pointer-events: none;
    }
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  /* The static drawing: a compositing layer of its own, never under the pointer. */
  .art-layer {
    will-change: transform;
    pointer-events: none;
  }
</style>
