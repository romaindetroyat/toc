<script lang="ts">
  import { reglages } from "../i18n/fr/reglages.ts";
  import Icon from "./Icon.svelte";
  import SettingsSheet from "./SettingsSheet.svelte";
  import type { TableSpeed } from "./tableSpeed.ts";

  // The gear of the game screen (« Réglages », 44 x 44): it opens the settings sheet and gets the focus
  // back when the sheet closes. The info bar holds it in its own slot; in the compact mode of a phone
  // held sideways it stands at the top of the right strip (plan 01-47). Either way its parent wraps it
  // in a [data-settings-slot], where the game screen finds it to give it the focus.
  type Props = {
    /** Called once the player has confirmed « Abandonner la partie » (offered by « Réglages »). */
    onabandon?: (to?: string) => void;
    /** At an online table: no sound test, and « Quitter la table » when `onleave` is given. */
    online?: boolean;
    onleave?: () => void;
    /** In an online game (not the waiting room): the leave's in-game confirmation (plan 02-07). */
    inGame?: boolean;
    /** The chef de table in an online game: « Arrêter la partie », confirmed first. */
    onstop?: () => void;
    /**
     * At an online table (plan 02-10b): the table-wide « Avance rapide », switched in the sheet; while
     * it is on, a small badge on the gear says so to everyone.
     */
    tableSpeed?: TableSpeed;
  };

  let { onabandon, online = false, onleave, inGame = false, onstop, tableSpeed }: Props = $props();

  const fast = $derived(tableSpeed?.fast === true);

  let settingsOpen = $state(false);
  let gear = $state<HTMLButtonElement | null>(null);
</script>

<button
  type="button"
  class="gear-button"
  aria-label={fast ? reglages.openLabelFast : reglages.openLabel}
  aria-haspopup="dialog"
  bind:this={gear}
  onclick={() => (settingsOpen = true)}
>
  <Icon name="settings" />
  {#if fast}
    <!-- The table is in « Avance rapide » (plan 02-10b): state, not a target; the name says it. -->
    <span class="fast-badge" data-fast-badge aria-hidden="true">
      <Icon name="fast-forward" size={12} />
    </span>
  {/if}
</button>

{#if settingsOpen}
  <SettingsSheet
    onclose={() => (settingsOpen = false)}
    opener={gear}
    {onabandon}
    {online}
    {onleave}
    {inGame}
    {onstop}
    {tableSpeed}
  />
{/if}

<style>
  .gear-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 0;
    border-radius: var(--radius-button);
    background: transparent;
    color: var(--creme);
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  /* 02-UI-SPEC « Avance rapide for the whole table »: a 20 px walnut disc with a cream border and a
     12 px cream glyph on the gear's top-right corner, inside its 44 px box. */
  .fast-badge {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 20px;
    height: 20px;
    border: 2px solid var(--creme);
    border-radius: 50%;
    background: var(--bois-sombre);
    color: var(--creme);
    pointer-events: none;
  }
</style>
