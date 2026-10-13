<script module lang="ts">
  import type { FlightSpec } from "./cardFx.ts";

  /** A card in flight: the spec says where it goes and when, `onDone` is called when it has landed. */
  export type Flight = { id: number; spec: FlightSpec; onDone: () => void };
</script>

<script lang="ts">
  import CardBack from "../ui/CardBack.svelte";
  import { cancelFlight, runFlight } from "./cardFx.ts";
  import FaceUpCard from "./FaceUpCard.svelte";

  // The cards that move over the board (D-23): the deal, a played card, the exchange, a dead hand
  // laid down. Each is a <g> at the origin of the board's SVG, moved by one Web Animation on
  // transform and opacity only. The cards hold their last pose until the screen takes them away, in
  // the same task in which the felt shows them. Public information only: a card in flight is either a
  // back or a card that was played face up.
  type Props = {
    flights: Flight[];
    /** Board units per screen pixel. */
    px: number;
  };

  let { flights, px }: Props = $props();

  /** Starts the animation of a card as its node appears, and reports when it has landed. */
  function fly(node: SVGGElement, flight: Flight) {
    // The node is hidden by its first keyframe (opacity 0) until the delay has passed.
    runFlight(node, flight.spec).then(flight.onDone);
    return {
      destroy() {
        cancelFlight(node);
      },
    };
  }
</script>

<g data-flights pointer-events="none">
  {#each flights as flight (flight.id)}
    <g data-flight={flight.spec.kind} data-flight-card={flight.spec.card ?? "back"} use:fly={flight}>
      {#if flight.spec.card === null}
        <CardBack x={0} y={0} {px} plain />
      {:else}
        <FaceUpCard card={flight.spec.card} {px} felt={false} />
      {/if}
    </g>
  {/each}
</g>
