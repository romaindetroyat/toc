<script lang="ts">
  import { hopTimeline } from "@toc/board";
  import { onDestroy } from "svelte";
  import { choicesAsText, effectiveChoices, loadPicks, type Picks, saveChoices } from "../audio/choices.ts";
  import {
    availability,
    type EngineStatus,
    now,
    onStatus,
    play,
    scheduleClops,
    setChoices,
    setMix,
    status,
    unlock,
    type VariantState,
  } from "../audio/engine.ts";
  import {
    isSoundEnabled,
    SOUND_IDS,
    SOUNDS,
    type SoundId,
    type SoundVariant,
    type VariantKey,
  } from "../audio/sounds.ts";
  import { mixFromSettings } from "../game/audioSettings.ts";
  import { credits } from "../i18n/fr/credits.ts";
  import { sons } from "../i18n/fr/sons.ts";
  import { licenceOf } from "../licences/licences.ts";
  import { settings } from "../settings/store.svelte.ts";
  import CreditsSheet from "../ui/CreditsSheet.svelte";
  import Icon from "../ui/Icon.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import { showToast } from "../ui/toast.svelte.ts";

  // The sound test page « à choix » (D-22, recette 3 de Romain, 2026-10-15): every sound with its
  // versions to listen to, and a choice per sound kept on this device and heard at once in the game.
  // « Copier mes choix » gives the list Romain sends to make his choices everyone's (DEFAULT_CHOICES).
  // Nothing here is awaited by the game; the page only calls the audio engine.

  function browserStorage(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
  const storage = browserStorage();

  /** The distances (in cells) the page plays the hoof cadence for. */
  const HOOF_CASES = [1, 4, 7, 13] as const;
  // Only the sounds heard in the game have a row (ENABLED_SOUNDS: the hooves alone since Romain's
  // « Oui, que les sabots », 2026-10-15). A section with no sound left is not shown, and one line
  // says the others are cut for now; they come back with their id in ENABLED_SOUNDS.
  const shownIds = SOUND_IDS.filter(isSoundEnabled);
  const someMuted = shownIds.length < SOUND_IDS.length;
  const neighIds = shownIds.filter((id) => id.startsWith("hennissement-"));
  const cardIds = shownIds.filter((id) => id.startsWith("carte-"));

  // --- Audio state ---
  let engineStatus = $state<EngineStatus>(status());
  /** True once the page was tapped: from then on the sounds are being prepared. */
  let started = $state(false);
  /** Where each version stands, by « id:key »; refreshed when the engine is ready and after a play. */
  let versions = $state<Record<string, VariantState>>({});
  let queued: (() => void) | undefined;

  $effect(() => onStatus((next) => (engineStatus = next)));

  function refresh() {
    versions = Object.fromEntries(
      SOUND_IDS.flatMap((id) =>
        SOUNDS[id].variants.map((v) => [`${id}:${v.key}`, availability(id, v.key)]),
      ),
    );
  }

  $effect(() => {
    if (engineStatus !== "ready") return;
    refresh();
    const run = queued;
    queued = undefined;
    run?.();
  });

  /** Unlocks the audio (this must run inside a tap) and starts preparing the sounds. */
  function begin() {
    unlock();
    started = true;
  }

  /** Runs `action` now, or as soon as the sounds are ready when the tap that asked for it was the first. */
  function whenReady(action: () => void) {
    begin();
    if (engineStatus === "ready") action();
    else queued = action;
  }

  const decoding = $derived(started && engineStatus === "pending");

  const stateLine = $derived(
    engineStatus === "failed"
      ? sons.stateFailed
      : engineStatus === "ready"
        ? sons.stateReady
        : sons.statePending,
  );

  // The page plays with everything on; the real mix comes back when the page closes.
  setMix({ sound: true, sfx: true });

  // --- Choices ---
  const picks: Picks = $state(loadPicks(storage));
  const current = $derived(effectiveChoices(picks));

  /** A pick is saved on this device and heard at once in the game (the engine plays it from now on). */
  function choose(id: SoundId, key: VariantKey) {
    picks[id] = key;
    const snapshot = $state.snapshot(picks) as Picks;
    saveChoices(storage, snapshot);
    setChoices(effectiveChoices(snapshot));
  }

  // --- Playing ---
  let playing = $state<string | undefined>();
  let playingTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  function flash(id: string, ms: number) {
    if (playingTimer !== undefined) clearTimeout(playingTimer);
    playing = id;
    playingTimer = setTimeout(() => {
      playing = undefined;
    }, ms);
    // A version heard for the first time is rendered now: its state line follows shortly after.
    if (refreshTimer !== undefined) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 400);
  }

  const LEAD_S = 0.06;
  /** Each hoof version button plays the cadence of a 4-cell move. */
  const VERSION_CELLS = 4;

  /** The hoof cadence of a move of `cells` cells, in `key` (or the chosen version). */
  function playHoof(id: string, cells: number, key?: VariantKey) {
    whenReady(() => {
      const timeline = hopTimeline(cells);
      scheduleClops(timeline.clops, now() + LEAD_S, key);
      flash(id, timeline.total);
    });
  }

  function playVersion(sound: SoundId, key: VariantKey) {
    const id = `${sound}:${key}`;
    if (sound === "sabot") {
      playHoof(id, VERSION_CELLS, key);
      return;
    }
    whenReady(() => {
      play(sound, key);
      flash(id, 1800);
    });
  }

  let distance = $state(6);

  onDestroy(() => {
    if (playingTimer !== undefined) clearTimeout(playingTimer);
    if (refreshTimer !== undefined) clearTimeout(refreshTimer);
    setMix(mixFromSettings(settings));
  });

  // --- Copying the choices ---
  /** Set when the clipboard refused: the choices are shown as selectable text instead. */
  let fallbackText = $state<string | undefined>();

  async function copyChoices() {
    const text = choicesAsText(current, sons.names, shownIds);
    try {
      // Plain text only: nothing in the choices is ever turned into markup.
      await navigator.clipboard.writeText(text);
      fallbackText = undefined;
      showToast(sons.copied);
    } catch {
      fallbackText = text;
      showToast(sons.copyFailed);
    }
  }

  // --- Credits ---
  let creditsOpen = $state(false);
  let creditsButton = $state<HTMLButtonElement | null>(null);

  /** « Généré par le code », or « Fichier libre (CC0) »; « Son indisponible » once it failed. */
  function sourceOf(sound: SoundId, variant: SoundVariant): string {
    if (versions[`${sound}:${variant.key}`] === "failed") return sons.unavailable;
    if (variant.source.kind === "file") return sons.sourceFile;
    if (variant.source.kind === "silence") return sons.sourceSilence;
    return sons.sourceGenerated;
  }

  /** « auteur · licence » from the licence manifest (FX-05): a file version has its own row. */
  function licenceLine(id: string): string {
    const row = licenceOf(id);
    return row ? sons.licenceLine(row.auteur, row.licence) : sons.licenceMissing;
  }

  const choiceOptions = (sound: SoundId) =>
    SOUNDS[sound].variants.map((v) => ({ value: v.key, label: sons.versionLetter(v.key) }));
</script>

<!-- Any tap on the page unlocks the audio (the first tap is the user gesture browsers require). -->
<svelte:window onclick={begin} />

{#snippet soundRow(sound: SoundId)}
  {@const name = sons.names[sound]}
  {@const generated = SOUNDS[sound].variants.some((v) => v.source.kind === "synth")}
  <li class="row" data-sound={sound} data-state={decoding ? "decoding" : "idle"}>
    <span class="name">{name}</span>
    <div class="versions">
      {#each SOUNDS[sound].variants as variant (variant.key)}
        {@const letter = sons.versionLetter(variant.key)}
        {@const what = sons.versionNames[sound]?.[variant.key]}
        <div class="version" data-version={variant.key}>
          <button
            type="button"
            class="play letter"
            class:on={playing === `${sound}:${variant.key}`}
            class:chosen={current[sound] === variant.key}
            aria-label={sons.playVersion(name, letter)}
            disabled={decoding}
            onclick={() => playVersion(sound, variant.key)}
          >
            {letter}
          </button>
          {#if what}<span class="what">{what}</span>{/if}
          <span class="tag source">{decoding ? sons.decoding : sourceOf(sound, variant)}</span>
          {#if variant.source.kind === "file"}
            <span class="tag licence">{licenceLine(variant.source.licence)}</span>
          {/if}
        </div>
      {/each}
    </div>
    {#if generated}
      <span class="tag licence">{licenceLine(sound)}</span>
    {/if}
    <div class="choice">
      <span class="choice-label" aria-hidden="true">{sons.choiceLabel}</span>
      <Segmented
        options={choiceOptions(sound)}
        value={current[sound]}
        label={sons.choiceGroup(name)}
        onchange={(value) => choose(sound, value)}
      />
    </div>
  </li>
{/snippet}

<main class="sons">
  <header>
    <a class="back btn btn-text" href="#/">{sons.back}</a>
    <h1 class="t-heading">{sons.title}</h1>
    <p class="state" role="status" data-state={engineStatus}>{stateLine}</p>
    <p class="hint">{sons.silentSwitchHint}</p>
    <p class="intro">{sons.intro}</p>
    {#if someMuted}
      <p class="hint" data-muted-note>{sons.mutedNote}</p>
    {/if}
  </header>

  <section aria-labelledby="sec-sabots">
    <h2 id="sec-sabots" class="t-heading">{sons.sections.sabots}</h2>
    <ul class="rows">
      {@render soundRow("sabot")}
      <li class="row cadence" data-state={decoding ? "decoding" : "idle"}>
        <span class="name">{sons.cadenceLabel}</span>
        <div class="cases">
          {#each HOOF_CASES as cells (cells)}
            <button
              type="button"
              class="play letter"
              class:on={playing === `sabot-${cells}`}
              aria-label={sons.play(sons.distanceValue(cells))}
              disabled={decoding}
              onclick={() => playHoof(`sabot-${cells}`, cells)}
            >
              {sons.casesButton(cells)}
            </button>
          {/each}
        </div>
      </li>
      <li class="row distance" data-state={decoding ? "decoding" : "idle"}>
        <div class="main">
          <button
            type="button"
            class="play"
            class:on={playing === "distance"}
            aria-label={sons.distancePlay}
            disabled={decoding}
            onclick={() => playHoof("distance", distance)}
          >
            <Icon name="play" />
          </button>
          <div class="text">
            <span class="name">{sons.distanceLabel}</span>
            <span class="tag tabular">{sons.distanceValue(distance)}</span>
          </div>
        </div>
        <input
          type="range"
          min="1"
          max="13"
          step="1"
          aria-label={sons.distanceSlider}
          aria-valuetext={sons.distanceValue(distance)}
          bind:value={distance}
        />
      </li>
    </ul>
  </section>

  {#if neighIds.length > 0}
    <section aria-labelledby="sec-hennissements">
      <h2 id="sec-hennissements" class="t-heading">{sons.sections.hennissements}</h2>
      <ul class="rows">
        {#each neighIds as sound (sound)}
          {@render soundRow(sound)}
        {/each}
      </ul>
    </section>
  {/if}

  {#if cardIds.length > 0}
    <section aria-labelledby="sec-cartes">
      <h2 id="sec-cartes" class="t-heading">{sons.sections.cartes}</h2>
      <ul class="rows">
        {#each cardIds as sound (sound)}
          {@render soundRow(sound)}
        {/each}
      </ul>
    </section>
  {/if}

  <footer>
    <button type="button" class="btn btn-primary copy" onclick={copyChoices}>
      <Icon name="copy" />
      {sons.copy}
    </button>
    <button
      type="button"
      class="btn btn-text credits-link"
      bind:this={creditsButton}
      onclick={() => (creditsOpen = true)}
    >
      {credits.open}
    </button>
    {#if fallbackText !== undefined}
      <textarea
        class="choices-text"
        readonly
        rows={shownIds.length + 1}
        aria-label={sons.choicesText}
        value={fallbackText}
        onfocus={(event) => event.currentTarget.select()}
      ></textarea>
    {/if}
  </footer>
</main>

{#if creditsOpen}
  <CreditsSheet onclose={() => (creditsOpen = false)} opener={creditsButton} />
{/if}

<style>
  .sons {
    box-sizing: border-box;
    width: 100%;
    max-width: 560px;
    min-height: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    padding: var(--space-md) var(--space-md) calc(var(--space-3xl) + env(safe-area-inset-bottom, 0px));
  }

  header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  header p,
  h1,
  h2 {
    margin: 0;
  }

  .back {
    min-height: var(--touch);
    margin-left: calc(-1 * var(--space-sm));
  }

  .state {
    font-weight: 700;
  }

  .hint,
  .tag {
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-md);
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
  }

  .main {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .name {
    font-size: var(--body-size);
    line-height: var(--body-line);
  }

  .play {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 2px solid var(--creme);
    border-radius: 50%;
    background: transparent;
    color: var(--creme);
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .play.on {
    background: var(--creme);
    color: var(--noyer);
  }

  .versions,
  .cases {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-md);
  }

  .version {
    display: flex;
    flex: 1 1 96px;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    min-width: 0;
  }

  .letter {
    font-size: var(--body-size);
    font-weight: 700;
  }

  /* The chosen version is told apart by a thicker ring, not by hue alone. */
  .letter.chosen {
    outline: 3px solid var(--creme);
    outline-offset: 2px;
  }

  .what {
    font-size: var(--label-size);
    line-height: var(--label-line);
    font-weight: 700;
  }

  .choice {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .choice-label {
    flex: none;
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .choice :global(.segmented) {
    flex: 1;
  }

  footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .copy {
    align-self: stretch;
  }

  .credits-link {
    align-self: center;
    min-height: var(--touch);
  }

  .choices-text {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: 2px solid var(--creme-attenuee);
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
    font-family: inherit;
    font-size: var(--body-size);
    line-height: var(--body-line);
    resize: vertical;
  }

  input[type="range"] {
    width: 100%;
    height: var(--touch);
    margin: 0;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
    touch-action: manipulation;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 4px;
    background: var(--chene);
  }

  input[type="range"]::-moz-range-track {
    height: 8px;
    border-radius: 4px;
    background: var(--chene);
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: var(--touch);
    height: var(--touch);
    margin-top: -18px;
    border: 3px solid var(--brun-aide-memoire);
    border-radius: 50%;
    background: var(--creme);
  }

  input[type="range"]::-moz-range-thumb {
    box-sizing: border-box;
    width: var(--touch);
    height: var(--touch);
    border: 3px solid var(--brun-aide-memoire);
    border-radius: 50%;
    background: var(--creme);
  }
</style>
