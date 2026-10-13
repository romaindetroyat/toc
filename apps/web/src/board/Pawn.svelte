<script lang="ts">
  import type { Color, PawnId, Place } from "@toc/engine";
  import { board as t } from "../i18n/fr/board.ts";
  import { type Facing, placeKey } from "./geometry.ts";

  type Props = {
    pawn: PawnId;
    color: Color;
    /** Static anchor (cell centre) in board units, already rotated; the feet stand on it. */
    x: number;
    y: number;
    place: Place;
    /** Which way the head points on the screen; the sprite faces right and is mirrored for left. */
    facing?: Facing;
    /** The outer group, for the director to find the animated inner groups. */
    el?: SVGGElement;
    /** Present only on a pawn the player can act on. */
    onselect?: () => void;
    /** Board units the knight is lifted off its shadow (12 for the selected one). */
    lift?: number;
  };

  let {
    pawn,
    color,
    x,
    y,
    place,
    facing = "right",
    el = $bindable(),
    onselect,
    lift = 0,
  }: Props = $props();

  const ring = $derived(place.z === "ring" ? place.cell : -1);
  // Pawns that are home are drawn 10 % smaller in the house (UI-SPEC).
  const size = $derived(place.z === "home" ? 0.9 : 1);

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onselect?.();
    }
  }
</script>

{#snippet body()}
  <g data-role="mover">
    <!-- The shadow stays on the ground: the animator scales and fades it while the knight leaps. -->
    <g transform={`scale(${size})`}>
      <g data-role="shadow">
        <use href="#knight-shadow" />
      </g>
    </g>
    <g data-role="arc">
      <!-- squash scales the body about the feet (the local origin) on landing; rear pivots at the
           feet too, inside the facing mirror so a left-facing knight rears backwards as well. -->
      <g data-role="squash">
        <g transform={`scale(${size})`}>
          <g transform={lift > 0 ? `translate(0 ${-lift})` : undefined}>
            <g data-role="facing" transform={`scale(${facing === "left" ? -1 : 1} 1)`}>
              <g data-role="rear">
                <!-- Feet at the local origin; the footprint is 110 wide and 190 high. -->
                <use href={`#knight-${color}`} x="-55" y="-186" width="110" height="190" />
              </g>
            </g>
          </g>
        </g>
      </g>
      {#if onselect}
        <!-- Invisible hit area, big enough for a finger. -->
        <circle cx="0" cy="-92" r="72" fill="transparent" />
      {/if}
    </g>
  </g>
{/snippet}

<!-- Outer group: static anchor (attribute, never animated). Inside it only the inner groups move:
     mover (translation along the path), arc (hop height), squash (landing), facing (mirror), rear
     (rearing), shadow, all by the Web Animations API. A pawn the player can act on is a button; the others are plain pictures. -->
{#if onselect}
  <g
    bind:this={el}
    transform={`translate(${x} ${y})`}
    data-pawn={pawn}
    data-place={placeKey(place)}
    data-ring={ring}
    data-facing={facing}
    role="button"
    tabindex="0"
    aria-label={t.pawn[color]}
    onclick={() => onselect()}
    {onkeydown}
  >
    {@render body()}
  </g>
{:else}
  <g
    bind:this={el}
    transform={`translate(${x} ${y})`}
    data-pawn={pawn}
    data-place={placeKey(place)}
    data-ring={ring}
    data-facing={facing}
    role="img"
    aria-label={t.pawn[color]}
    pointer-events="none"
  >
    {@render body()}
  </g>
{/if}
