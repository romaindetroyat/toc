<script lang="ts">
  import { setMix } from "../audio/engine.ts";
  import { mixFromSettings } from "../game/audioSettings.ts";
  import { clavier } from "../i18n/fr/clavier.ts";
  import { game } from "../i18n/fr/game.ts";
  import { reglages } from "../i18n/fr/reglages.ts";
  import { table as tableCopy } from "../i18n/fr/table.ts";
  import { settings, updateSettings } from "../settings/store.svelte.ts";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import CreditsSheet from "./CreditsSheet.svelte";
  import Sheet from "./Sheet.svelte";
  import ShortcutsSheet from "./ShortcutsSheet.svelte";
  import Switch from "./Switch.svelte";
  import type { TableSpeed } from "./tableSpeed.ts";

  // « Réglages » (UI-SPEC): sound, effects, reduced animations, and the links
  // to the sound test and the credits. Every change is applied at once and kept (no Save button): the
  // store writes it to localStorage, and the mix below reaches the audio buses.
  type Props = {
    onclose: () => void;
    /** Element that gets the focus back on close; defaults to the element focused on opening. */
    opener?: HTMLElement | null;
    /**
     * In a game only: offers « Abandonner la partie » and calls this once the player has confirmed,
     * with the route to go to (the sound test when « Tester les sons » asked for it; the launch screen
     * by default).
     */
    onabandon?: (to?: string) => void;
    /**
     * At an online table (plan 02-05): « Tester les sons » is hidden (leaving the page would drop the
     * table's connection), and « Quitter la table » is offered when `onleave` is given, confirmed first.
     */
    online?: boolean;
    /** Called once the player has confirmed « Quitter la table ». */
    onleave?: () => void;
    /**
     * In an online game (plan 02-07): the leave's confirmation says the game pauses for the others,
     * and « Raccourcis clavier » stays (as in the local game).
     */
    inGame?: boolean;
    /**
     * The chef de table in an online game (plan 02-07): « Arrêter la partie », confirmed with
     * « Arrêter la partie ? » (the game is saved for everyone), in place of « Abandonner la partie ».
     */
    onstop?: () => void;
    /**
     * At an online table (plan 02-10b): the table-wide « Avance rapide », first row of the sheet; the
     * chef de table switches it, the others see it disabled.
     */
    tableSpeed?: TableSpeed;
  };

  let {
    onclose,
    opener = null,
    onabandon,
    online = false,
    onleave,
    inGame = false,
    onstop,
    tableSpeed,
  }: Props = $props();

  let leaveOpen = $state(false);
  let leaveButton = $state<HTMLButtonElement | null>(null);
  let stopOpen = $state(false);
  let stopButton = $state<HTMLButtonElement | null>(null);
  const leaveCopy = $derived(inGame ? tableCopy.confirm.leaveGame : tableCopy.confirm.leaveRoom);

  /** The stop is confirmed: the sheet closes, the plate « Partie sauvegardée » comes. */
  function confirmStop() {
    stopOpen = false;
    onstop?.();
    onclose();
  }

  // The buses follow the settings as long as the sheet is open (the game applies them too, and the
  // engine keeps them until it is unlocked).
  $effect(() => {
    setMix(mixFromSettings(settings));
  });

  let creditsOpen = $state(false);
  let creditsButton = $state<HTMLButtonElement | null>(null);
  let shortcutsOpen = $state(false);
  let shortcutsButton = $state<HTMLButtonElement | null>(null);
  let abandonOpen = $state(false);
  let abandonButton = $state<HTMLButtonElement | null>(null);
  let soundsLink = $state<HTMLAnchorElement | null>(null);
  /** Where the confirmed abandon leads, and the control that asked for it (it gets the focus back). */
  let abandonTo = $state<string | undefined>(undefined);
  let abandonOpener = $state<HTMLElement | null>(null);

  function askAbandon(to: string | undefined, from: HTMLElement | null) {
    abandonTo = to;
    abandonOpener = from;
    abandonOpen = true;
  }

  // In a game, leaving for the sound test loses the game: it asks the same confirmation as
  // « Abandonner la partie » (UI-SPEC « Destructive confirmation ») instead of one stray tap doing it.
  function onSoundsClick(event: MouseEvent) {
    if (!onabandon) return;
    event.preventDefault();
    askAbandon("#/sons", soundsLink);
  }

  // « Son » off dims « Bruitages ».
  const muted = $derived(!settings.sound);
</script>

<Sheet title={reglages.title} {onclose} {opener} closeLabel={reglages.close}>
  <div class="form" data-settings>
    {#if tableSpeed !== undefined}
      <div data-table-fast>
        <Switch
          label={reglages.tableFast}
          helper={tableSpeed.canSet
            ? reglages.tableFastHelper
            : reglages.tableFastOthers(tableSpeed.hostName)}
          checked={tableSpeed.fast}
          disabled={!tableSpeed.canSet}
          onchange={(fast) => tableSpeed.onset(fast)}
        />
      </div>
    {/if}
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
    <Switch
      label={reglages.reduceMotion}
      helper={reglages.reduceMotionHelper}
      checked={settings.reduceMotion}
      onchange={(reduceMotion) => updateSettings({ reduceMotion })}
    />

    <nav class="links">
      {#if !online}
        <a class="btn btn-text" href="#/sons" bind:this={soundsLink} onclick={onSoundsClick}>
          {reglages.testSounds}
        </a>
      {/if}
      <button
        type="button"
        class="btn btn-text"
        bind:this={creditsButton}
        onclick={() => (creditsOpen = true)}
      >
        {reglages.credits}
      </button>
      {#if onabandon || inGame}
        <!-- In a game, on a computer only: the same help as the « ? » key (plan 01-28). -->
        <button
          type="button"
          class="btn btn-text shortcuts"
          data-shortcuts-link
          bind:this={shortcutsButton}
          onclick={() => (shortcutsOpen = true)}
        >
          {clavier.link}
        </button>
      {/if}
    </nav>

    {#if onabandon}
      <button
        type="button"
        class="btn btn-text abandon"
        data-abandon
        bind:this={abandonButton}
        onclick={() => askAbandon(undefined, abandonButton)}
      >
        {game.abandon.confirm}
      </button>
    {/if}

    {#if onstop}
      <button
        type="button"
        class="btn btn-text leave"
        data-stop-game
        bind:this={stopButton}
        onclick={() => (stopOpen = true)}
      >
        {reglages.stopGame}
      </button>
    {/if}

    {#if onleave}
      <button
        type="button"
        class="btn btn-text leave"
        data-leave-table
        bind:this={leaveButton}
        onclick={() => (leaveOpen = true)}
      >
        {reglages.leaveTable}
      </button>
    {/if}
  </div>
</Sheet>

{#if leaveOpen && onleave}
  <ConfirmDialog
    title={leaveCopy.title}
    body={leaveCopy.body}
    safeLabel={leaveCopy.safe}
    otherLabel={leaveCopy.other}
    oncancel={() => (leaveOpen = false)}
    onconfirm={onleave}
    opener={leaveButton}
  />
{/if}

{#if stopOpen && onstop}
  <ConfirmDialog
    title={tableCopy.confirm.stop.title}
    body={tableCopy.confirm.stop.body}
    safeLabel={tableCopy.confirm.stop.safe}
    otherLabel={tableCopy.confirm.stop.other}
    oncancel={() => (stopOpen = false)}
    onconfirm={confirmStop}
    opener={stopButton}
  />
{/if}

{#if creditsOpen}
  <CreditsSheet onclose={() => (creditsOpen = false)} opener={creditsButton} />
{/if}

{#if shortcutsOpen}
  <ShortcutsSheet onclose={() => (shortcutsOpen = false)} opener={shortcutsButton} {online} />
{/if}

{#if abandonOpen && onabandon}
  <ConfirmDialog
    oncancel={() => (abandonOpen = false)}
    onconfirm={() => onabandon(abandonTo)}
    opener={abandonOpener}
  />
{/if}

<style>
  /* Rows are 24 apart (UI-SPEC « Réglages sheet »). */
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  /* The destructive text button (cream, underlined: the red fill is for the confirmation), at the bottom. */
  .abandon,
  .leave {
    align-self: flex-start;
  }

  .links {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  /* « Raccourcis clavier »: computers only. Not drawn on a phone, so neither Tab nor a screen reader
     reaches it there. */
  .shortcuts {
    display: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .shortcuts {
      display: inline-flex;
    }
  }
</style>
