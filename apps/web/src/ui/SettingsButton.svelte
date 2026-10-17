<script lang="ts">
  import { reglages } from "../i18n/fr/reglages.ts";
  import Icon from "./Icon.svelte";
  import SettingsSheet from "./SettingsSheet.svelte";

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
  };

  let { onabandon, online = false, onleave }: Props = $props();

  let settingsOpen = $state(false);
  let gear = $state<HTMLButtonElement | null>(null);
</script>

<button
  type="button"
  class="gear-button"
  aria-label={reglages.openLabel}
  aria-haspopup="dialog"
  bind:this={gear}
  onclick={() => (settingsOpen = true)}
>
  <Icon name="settings" />
</button>

{#if settingsOpen}
  <SettingsSheet onclose={() => (settingsOpen = false)} opener={gear} {onabandon} {online} {onleave} />
{/if}

<style>
  .gear-button {
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
</style>
