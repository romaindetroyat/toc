<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { IconName } from "./icons.ts";

  // A small tile of « Accueil » (04-UI-SPEC « Small tiles »), where the 02 name line was: bois sombre,
  // radius 12, a 2 px border of --creme-attenuee at 40 %, two lines (an icon 20 and the label in
  // Label 700, then the sub line in Label 400 muted, cut with an ellipsis). 136 × 48 on the phone
  // layouts, 152 × 48 on the computer. A link for a page, a button for a sheet. Never amber.
  type Props = {
    /** The test hook: data-small-tile="compte|amis|prenom|connexion". */
    kind: string;
    icon: IconName;
    label: string;
    sub: string;
    /** The accessible name, e.g. « Mon compte (Marie) »; the full sub line goes in title. */
    name: string;
    href?: string;
    onclick?: () => void;
    wide?: boolean;
    /** Plan 04-09: the one-column and portrait layouts share the row between the tiles. */
    fill?: boolean;
    /** The tile's element (the sheet it opens gives the focus back to it). */
    element?: HTMLElement | null | undefined;
  };

  let {
    kind,
    icon,
    label,
    sub,
    name,
    href,
    onclick,
    wide = false,
    fill = false,
    element = $bindable(),
  }: Props = $props();
</script>

{#snippet content()}
  <span class="line1">
    <Icon name={icon} size={20} />
    <span class="label">{label}</span>
  </span>
  <span class="line2" data-small-tile-sub>{sub}</span>
{/snippet}

{#if href !== undefined}
  <a
    class="tile"
    class:wide
    class:fill
    {href}
    data-small-tile={kind}
    aria-label={name}
    title={sub}
    bind:this={element}
    {onclick}
  >
    {@render content()}
  </a>
{:else}
  <button
    type="button"
    class="tile"
    class:wide
    class:fill
    data-small-tile={kind}
    aria-label={name}
    aria-haspopup="dialog"
    title={sub}
    bind:this={element}
    {onclick}
  >
    {@render content()}
  </button>
{/if}

<style>
  /* 48 high: two Label lines of 20 and 4 above and below, the 2 px border inside those 4. */
  .tile {
    display: flex;
    flex-direction: column;
    justify-content: center;
    box-sizing: border-box;
    width: 136px;
    height: 48px;
    min-height: 48px;
    padding: 2px 6px;
    border: 2px solid color-mix(in srgb, var(--creme-attenuee) 40%, transparent);
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
    font: inherit;
    font-size: var(--label-size);
    line-height: 20px;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .tile.wide {
    width: 152px;
  }

  /* One column and portrait: (column − 8) / 2 each. */
  .tile.fill {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
  }

  .line1 {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    min-width: 0;
    font-weight: 700;
    white-space: nowrap;
  }

  .line1 :global(svg) {
    flex: none;
  }

  .label,
  .line2 {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .line2 {
    color: var(--creme-attenuee);
    font-weight: 400;
  }

  @media (hover: hover) and (pointer: fine) {
    .tile:hover {
      border-color: var(--creme-attenuee);
    }
  }

  .tile:active {
    transform: translateY(2px);
  }
</style>
