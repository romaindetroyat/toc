<script lang="ts">
  import { hopTimeline } from "@toc/board";
  import { onDestroy } from "svelte";
  import {
    type Availability,
    availability,
    cue,
    type EngineStatus,
    loadRecordings,
    now,
    onStatus,
    type RecordingInfo,
    recordings,
    scheduleClops,
    setMix,
    startAmbience,
    status,
    stopAmbience,
    unlock,
  } from "../audio/engine.ts";
  import { SOUND_IDS, SOUNDS, type SoundId } from "../audio/sounds.ts";
  import {
    loadNotes,
    NOTE_KEYS,
    type NoteKey,
    type Notes,
    RATINGS,
    type Rating,
    saveNotes,
  } from "../audio/soundNotes.ts";
  import { sons } from "../i18n/fr/sons.ts";
  import { settings, updateSettings } from "../settings/store.svelte.ts";
  import Icon from "../ui/Icon.svelte";
  import Segmented from "../ui/Segmented.svelte";

  // The listening page for Romain (D-22): every Phase 1 sound, its source, a rating kept on this
  // device. Nothing here is awaited by the game; the page only calls the audio engine.

  function browserStorage(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
  const storage = browserStorage();

  const hoofKeys = NOTE_KEYS.filter((key) => key.startsWith("sabot-"));
  const neighKeys = NOTE_KEYS.filter((key) => key.startsWith("hennissement-"));
  const cardKeys = NOTE_KEYS.filter((key) => key.startsWith("carte-"));

  const ratingOptions = RATINGS.map((value) => ({ value, label: sons.ratings[value] }));
  /** Hoof rows are rated per distance; they all play the one "sabot" sound. */
  const soundOf = (key: NoteKey): SoundId => (key.startsWith("sabot-") ? "sabot" : (key as SoundId));
  const cellsOf = (key: NoteKey): number => Number(key.slice("sabot-".length));

  // --- Audio state ---
  let engineStatus = $state<EngineStatus>(status());
  /** True once the page was tapped: from then on the sounds are being prepared. */
  let started = $state(false);
  let catalogue = $state<Record<string, Availability>>({});
  let sources = $state<Partial<Record<SoundId, RecordingInfo>>>({});
  let queued: (() => void) | undefined;

  $effect(() => onStatus((next) => (engineStatus = next)));

  function refresh() {
    catalogue = Object.fromEntries(SOUND_IDS.map((id) => [id, availability(id)]));
    sources = recordings() ?? {};
  }

  let recordingsLoaded = false;
  $effect(() => {
    if (engineStatus !== "ready") return;
    refresh();
    if (!recordingsLoaded) {
      recordingsLoaded = true;
      void loadRecordings().then(refresh);
    }
    const run = queued;
    queued = undefined;
    run?.();
  });

  /** Unlocks the audio (this must run inside a tap) and starts preparing the sounds. */
  function begin() {
    unlock();
    started = true;
  }

  /** Runs `play` now, or as soon as the sounds are ready when the tap that asked for it was the first. */
  function whenReady(play: () => void) {
    begin();
    if (engineStatus === "ready") play();
    else queued = play;
  }

  const decoding = $derived(started && engineStatus === "pending");

  type RowState = "idle" | "decoding" | "unavailable";
  function stateOf(sound: SoundId): RowState {
    if (decoding) return "decoding";
    if (engineStatus === "ready") {
      const known = catalogue[sound];
      if (known && !known.synth && !known.file) return "unavailable";
    }
    return "idle";
  }

  const ambienceState = $derived(stateOf("ambiance"));

  const stateLine = $derived(
    engineStatus === "failed"
      ? sons.stateFailed
      : engineStatus === "ready"
        ? sons.stateReady
        : sons.statePending,
  );

  // The page plays at the ambience volume of the settings, everything else on; the real mix comes
  // back when the page closes.
  $effect(() => {
    setMix({ sound: true, sfx: true, ambience: true, ambienceVolume: settings.ambienceVolume });
  });

  // --- Playing ---
  let playing = $state<string | undefined>();
  let playingTimer: ReturnType<typeof setTimeout> | undefined;

  function flash(id: string, ms: number) {
    if (playingTimer !== undefined) clearTimeout(playingTimer);
    playing = id;
    playingTimer = setTimeout(() => {
      playing = undefined;
    }, ms);
  }

  const LEAD_S = 0.06;

  function playHoof(id: string, cells: number) {
    whenReady(() => {
      const timeline = hopTimeline(cells);
      scheduleClops(timeline.clops, now() + LEAD_S);
      flash(id, timeline.total);
    });
  }

  function playSound(id: string, sound: SoundId, prefer?: "file" | "synth") {
    whenReady(() => {
      cue(sound, undefined, { prefer });
      flash(id, 1800);
    });
  }

  let distance = $state(6);

  let ambiencePlaying = $state(false);
  function toggleAmbience() {
    if (ambiencePlaying) {
      stopAmbience();
      ambiencePlaying = false;
      return;
    }
    whenReady(() => {
      startAmbience();
      ambiencePlaying = true;
    });
  }

  onDestroy(() => {
    if (playingTimer !== undefined) clearTimeout(playingTimer);
    if (ambiencePlaying) stopAmbience();
    setMix({
      sound: settings.sound,
      sfx: settings.sfx,
      ambience: settings.ambience,
      ambienceVolume: settings.ambienceVolume,
    });
  });

  // --- Ratings ---
  const notes: Notes = $state(loadNotes(storage));

  function rate(key: NoteKey, rating: Rating) {
    notes[key] = rating;
    saveNotes(storage, $state.snapshot(notes));
  }

  function tagOf(sound: SoundId): string {
    return sources[sound]?.source === "file" ? sons.sourceFile : sons.sourceGenerated;
  }
</script>

<!-- Any tap on the page unlocks the audio (the first tap is the user gesture browsers require). -->
<svelte:window onclick={begin} />

{#snippet rating(key: NoteKey)}
  <Segmented
    options={ratingOptions}
    value={notes[key] ?? "a-ecouter"}
    label={sons.ratingGroup(sons.rows[key])}
    onchange={(value) => rate(key, value)}
  />
{/snippet}

{#snippet soundRow(key: NoteKey)}
  {@const sound = soundOf(key)}
  {@const name = sons.rows[key]}
  {@const state = stateOf(sound)}
  {@const known = catalogue[sound]}
  {@const compare = sound !== "sabot" && SOUNDS[sound].files.length > 0}
  {@const fileFailed = compare && (sources[sound]?.recordingUnavailable ?? false)}
  <li class="row" data-sound={key} data-state={state}>
    <div class="main">
      {#if compare}
        <div class="ab">
          <button
            type="button"
            class="play ab-button"
            class:on={playing === `${key}:file`}
            aria-label={sons.playFile(name)}
            disabled={state === "decoding" || !known?.file}
            onclick={() => playSound(`${key}:file`, sound, "file")}
          >
            {sons.fileButton}
          </button>
          <button
            type="button"
            class="play ab-button"
            class:on={playing === `${key}:synth`}
            aria-label={sons.playGenerated(name)}
            disabled={state === "decoding" || !known?.synth}
            onclick={() => playSound(`${key}:synth`, sound, "synth")}
          >
            {sons.generatedButton}
          </button>
        </div>
      {:else}
        <button
          type="button"
          class="play"
          class:on={playing === key}
          aria-label={sons.play(name)}
          disabled={state !== "idle"}
          onclick={() =>
            sound === "sabot" ? playHoof(key, cellsOf(key)) : playSound(key, sound)}
        >
          <Icon name="play" />
        </button>
      {/if}
      <div class="text">
        <span class="name">{name}</span>
        <span class="tag">
          {#if state === "decoding"}
            {sons.decoding}
          {:else if state === "unavailable" || fileFailed}
            {sons.unavailable}
          {:else}
            {tagOf(sound)}
          {/if}
        </span>
      </div>
    </div>
    {@render rating(key)}
  </li>
{/snippet}

<main class="sons">
  <header>
    <a class="back btn btn-text" href="#/">{sons.back}</a>
    <h1 class="t-heading">{sons.title}</h1>
    <p class="state" role="status" data-state={engineStatus}>{stateLine}</p>
    <p class="hint">{sons.silentSwitchHint}</p>
    <p class="intro">{sons.intro}</p>
  </header>

  <section aria-labelledby="sec-sabots">
    <h2 id="sec-sabots" class="t-heading">{sons.sections.sabots}</h2>
    <ul class="rows">
      {#each hoofKeys as key (key)}
        {@render soundRow(key)}
      {/each}
      <li class="row distance" data-state={stateOf("sabot")}>
        <div class="main">
          <button
            type="button"
            class="play"
            class:on={playing === "distance"}
            aria-label={sons.distancePlay}
            disabled={stateOf("sabot") !== "idle"}
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

  <section aria-labelledby="sec-hennissements">
    <h2 id="sec-hennissements" class="t-heading">{sons.sections.hennissements}</h2>
    <ul class="rows">
      {#each neighKeys as key (key)}
        {@render soundRow(key)}
      {/each}
    </ul>
  </section>

  <section aria-labelledby="sec-cartes">
    <h2 id="sec-cartes" class="t-heading">{sons.sections.cartes}</h2>
    <ul class="rows">
      {#each cardKeys as key (key)}
        {@render soundRow(key)}
      {/each}
    </ul>
  </section>

  <section aria-labelledby="sec-ambiance">
    <h2 id="sec-ambiance" class="t-heading">{sons.sections.ambiance}</h2>
    <ul class="rows">
      <li class="row" data-sound="ambiance" data-state={ambienceState}>
        <div class="main">
          <button
            type="button"
            class="play"
            class:on={ambiencePlaying}
            aria-pressed={ambiencePlaying}
            aria-label={ambiencePlaying
              ? sons.stop(sons.rows.ambiance)
              : sons.play(sons.rows.ambiance)}
            disabled={ambienceState !== "idle"}
            onclick={toggleAmbience}
          >
            <Icon name={ambiencePlaying ? "volume-x" : "play"} />
          </button>
          <div class="text">
            <span class="name">{sons.rows.ambiance}</span>
            <span class="tag">
              {#if ambienceState === "decoding"}
                {sons.decoding}
              {:else if ambienceState === "unavailable"}
                {sons.unavailable}
              {:else}
                {tagOf("ambiance")}
              {/if}
            </span>
          </div>
        </div>
        <div class="volume">
          <label for="ambience-volume" class="name">{sons.ambienceVolume}</label>
          <span class="tag tabular">{sons.percent(settings.ambienceVolume)}</span>
        </div>
        <input
          id="ambience-volume"
          type="range"
          min="0"
          max="100"
          step="1"
          value={settings.ambienceVolume}
          oninput={(event) => updateSettings({ ambienceVolume: Number(event.currentTarget.value) })}
        />
        {@render rating("ambiance")}
      </li>
    </ul>
  </section>
</main>

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

  .volume {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
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

  .ab {
    display: flex;
    flex: none;
    gap: var(--space-sm);
  }

  .ab-button {
    width: auto;
    padding: 0 var(--space-md);
    border-radius: var(--radius-button);
    font-size: var(--label-size);
    font-weight: 700;
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
