<script lang="ts">
  import { game } from "../i18n/fr/game.ts";

  // The invitation to turn the screen (UI-SPEC addendum « Plateau galet », item 5; derived, « à
  // confirmer par Romain »). Romain asked for « paysage obligatoire » and Safari cannot lock the
  // orientation, so every screen taller than wide shows this instead of the game, which waits behind
  // it, hidden and inert (Game.svelte). A phone (coarse pointer) reads « Tourne ton téléphone »; a
  // computer window, under the query of the key hints, « Élargis la fenêtre ». The other title is
  // not displayed, so a screen reader reads one heading only. Nothing here moves.

  type Props = {
    /** The heading, focused by the game screen when the invitation appears. */
    heading?: HTMLHeadingElement | null;
  };

  let { heading = $bindable(null) }: Props = $props();

  const uid = $props.id();
  const titleId = `${uid}-title`;
</script>

<section class="rotate" data-rotate-prompt aria-labelledby={titleId}>
  <svg class="pictogram" viewBox="0 0 120 96" width="120" height="96" aria-hidden="true">
    <!-- The phone held upright, faint, and the same phone a quarter turn later, held sideways. -->
    <rect x="12" y="8" width="40" height="72" rx="7" class="ghost" />
    <rect x="40" y="44" width="72" height="40" rx="7" class="phone" />
    <rect x="102" y="58" width="3" height="12" rx="1.5" class="detail" />
    <!-- The quarter turn, from the upright phone to the sideways one. -->
    <path d="M 62 10 A 40 40 0 0 1 100 34" class="arrow" />
    <path d="M 92 33 L 101 36 L 103 26" class="arrow" />
  </svg>
  <h1 id={titleId} class="t-heading" tabindex="-1" bind:this={heading} data-rotate-title>
    <span class="phone-title">{game.rotate.phone}</span>
    <span class="window-title">{game.rotate.window}</span>
  </h1>
  <p class="t-body">{game.rotate.body}</p>
</section>

<style>
  .rotate {
    position: fixed;
    inset: 0;
    z-index: 70;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    padding: calc(var(--space-lg) + env(safe-area-inset-top, 0px))
      calc(var(--space-lg) + env(safe-area-inset-right, 0px))
      calc(var(--space-lg) + env(safe-area-inset-bottom, 0px))
      calc(var(--space-lg) + env(safe-area-inset-left, 0px));
    background: var(--bois-sombre);
    color: var(--creme);
    text-align: center;
  }

  .pictogram {
    flex: none;
  }

  .ghost {
    fill: none;
    stroke: var(--creme-attenuee);
    stroke-width: 3;
    stroke-dasharray: 6 5;
  }

  .phone {
    fill: none;
    stroke: var(--creme);
    stroke-width: 4;
  }

  .detail {
    fill: var(--creme);
  }

  .arrow {
    fill: none;
    stroke: var(--creme);
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  h1 {
    margin: 0;
    max-width: 480px;
  }

  h1:focus {
    outline: none;
  }

  p {
    margin: 0;
    max-width: 480px;
  }

  .window-title {
    display: none;
  }

  /* A computer (the query of the key hints): its window is to be widened, not turned. */
  @media (hover: hover) and (pointer: fine) {
    .phone-title {
      display: none;
    }

    .window-title {
      display: inline;
    }
  }
</style>
