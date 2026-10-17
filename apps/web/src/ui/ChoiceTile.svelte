<script lang="ts">
  import Icon from "./Icon.svelte";

  // One of the two oak choices of « Accueil » (02-UI-SPEC « Choice tile »): an oak surface, radius 16,
  // a sharp 3 px shadow that sinks on press (the plank buttons' style, no blur), a 40 px pictogram, the
  // label (Body 700) over the sub line (Label 400 at 80 %). A link for the solo choice, a button for the
  // online one. Never amber: the home has no accent.
  type Props = {
    /** The test hook, set by the home: data-home-choice="ordinateur|table". */
    "data-home-choice": "ordinateur" | "table";
    label: string;
    sub: string;
    /** The pictogram: the knight in walnut (solo) or the `users` icon (online). */
    picture: "knight" | "users";
    /** A link (the solo choice); without it the tile is a button. */
    href?: string;
    onclick?: () => void;
    /** The online choice while its table is being created. */
    busy?: boolean;
    compact?: boolean;
  };

  let {
    "data-home-choice": choice,
    label,
    sub,
    picture,
    href,
    onclick,
    busy = false,
    compact = false,
  }: Props = $props();
</script>

{#snippet content()}
  <span class="picture" aria-hidden="true">
    {#if picture === "knight"}
      <span class="knight"></span>
    {:else}
      <Icon name="users" size={32} />
    {/if}
  </span>
  <span class="text">
    <span class="label">{label}</span>
    <span class="sub">{sub}</span>
  </span>
{/snippet}

{#if href !== undefined}
  <a class="tile" class:compact {href} data-home-choice={choice} {onclick}>
    {@render content()}
  </a>
{:else}
  <button
    type="button"
    class="tile"
    class:compact
    data-home-choice={choice}
    aria-busy={busy}
    {onclick}
  >
    {@render content()}
  </button>
{/if}

<style>
  .tile {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    box-sizing: border-box;
    width: 100%;
    min-height: 112px;
    margin: 0 0 3px;
    padding: var(--space-md);
    border: 2px solid color-mix(in srgb, var(--noyer) 30%, transparent);
    border-radius: var(--radius-sheet);
    background: var(--chene);
    box-shadow: 0 3px 0 rgb(42 26 14 / 0.45);
    color: var(--noyer);
    font: inherit;
    text-align: start;
    text-decoration: none;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .tile.compact {
    min-height: 96px;
    padding: 12px;
  }

  .tile:active {
    transform: translateY(3px);
    box-shadow: 0 0 0 rgb(42 26 14 / 0.45);
  }

  @media (hover: hover) and (pointer: fine) {
    .tile:hover {
      border-color: var(--noyer);
    }
  }

  .tile:focus-visible {
    outline: 3px solid var(--ambre);
    outline-offset: 2px;
  }

  .picture {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
  }

  /* The knight picture as a walnut silhouette: its alpha masks a walnut fill (no filter). */
  .knight {
    display: block;
    width: 23px;
    height: 40px;
    background: var(--noyer);
    -webkit-mask: url("/cavaliers/bleu.webp") center / contain no-repeat;
    mask: url("/cavaliers/bleu.webp") center / contain no-repeat;
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .label {
    font-size: var(--body-size);
    font-weight: 700;
    line-height: var(--body-line);
  }

  .sub {
    font-size: var(--label-size);
    font-weight: 400;
    line-height: var(--label-line);
    opacity: 0.8;
  }
</style>
