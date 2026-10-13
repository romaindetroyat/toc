<script lang="ts">
  import { setMix } from "../audio/engine.ts";
  import { mixFromSettings } from "../game/audioSettings.ts";
  import { game } from "../i18n/fr/game.ts";
  import { reglages } from "../i18n/fr/reglages.ts";
  import { settings, updateSettings } from "../settings/store.svelte.ts";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import CreditsSheet from "./CreditsSheet.svelte";
  import Sheet from "./Sheet.svelte";
  import Slider from "./Slider.svelte";
  import Switch from "./Switch.svelte";

  // « Réglages » (UI-SPEC): sound, effects, ambience and its volume, reduced animations, and the links
  // to the sound test and the credits. Every change is applied at once and kept (no Save button): the
  // store writes it to localStorage, and the mix below reaches the audio buses.
  type Props = {
    onclose: () => void;
    /** Element that gets the focus back on close; defaults to the element focused on opening. */
    opener?: HTMLElement | null;
    /** In a game only: offers « Abandonner la partie » and calls this once the player has confirmed. */
    onabandon?: () => void;
  };

  let { onclose, opener = null, onabandon }: Props = $props();

  // The buses follow the settings as long as the sheet is open (the game applies them too, and the
  // engine keeps them until it is unlocked).
  $effect(() => {
    setMix(mixFromSettings(settings));
  });

  let creditsOpen = $state(false);
  let creditsButton = $state<HTMLButtonElement | null>(null);
  let abandonOpen = $state(false);
  let abandonButton = $state<HTMLButtonElement | null>(null);

  // « Son » off dims the other two switches; « Ambiance » off dims and disables the volume.
  const muted = $derived(!settings.sound);
</script>

<Sheet title={reglages.title} {onclose} {opener} closeLabel={reglages.close}>
  <div class="form" data-settings>
    <Switch
      label={reglages.sound}
      helper={reglages.soundHelper}
      checked={settings.sound}
      onchange={(sound) => updateSettings({ sound })}
    />
    <Switch
      label={reglages.sfx}
      checked={settings.sfx}
      dimmed={muted}
      onchange={(sfx) => updateSettings({ sfx })}
    />
    <div class="group">
      <Switch
        label={reglages.ambience}
        checked={settings.ambience}
        dimmed={muted}
        onchange={(ambience) => updateSettings({ ambience })}
      />
      <Slider
        label={reglages.ambienceVolume}
        value={settings.ambienceVolume}
        valueText={reglages.percent}
        disabled={!settings.ambience}
        dimmed={muted}
        onchange={(ambienceVolume) => updateSettings({ ambienceVolume })}
      />
    </div>
    <Switch
      label={reglages.reduceMotion}
      helper={reglages.reduceMotionHelper}
      checked={settings.reduceMotion}
      onchange={(reduceMotion) => updateSettings({ reduceMotion })}
    />

    <nav class="links">
      <a class="btn btn-text" href="#/sons">{reglages.testSounds}</a>
      <button
        type="button"
        class="btn btn-text"
        bind:this={creditsButton}
        onclick={() => (creditsOpen = true)}
      >
        {reglages.credits}
      </button>
    </nav>

    {#if onabandon}
      <button
        type="button"
        class="btn btn-text abandon"
        data-abandon
        bind:this={abandonButton}
        onclick={() => (abandonOpen = true)}
      >
        {game.abandon.confirm}
      </button>
    {/if}
  </div>
</Sheet>

{#if creditsOpen}
  <CreditsSheet onclose={() => (creditsOpen = false)} opener={creditsButton} />
{/if}

{#if abandonOpen && onabandon}
  <ConfirmDialog
    oncancel={() => (abandonOpen = false)}
    onconfirm={onabandon}
    opener={abandonButton}
  />
{/if}

<style>
  /* Rows are 24 apart (UI-SPEC « Réglages sheet »). */
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  /* The destructive text button (cream, underlined: the red fill is for the confirmation), at the bottom. */
  .abandon {
    align-self: flex-start;
  }

  .links {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }
</style>
