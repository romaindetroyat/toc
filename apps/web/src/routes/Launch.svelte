<script lang="ts">
  import type { BotLevel } from "@toc/bots";
  import { COLORS, type Color, nextColor, PARTNER } from "@toc/engine";
  import { unlock } from "../audio/engine.ts";
  import { bots } from "../i18n/fr/bots.ts";
  import { launch } from "../i18n/fr/launch.ts";
  import { reglages } from "../i18n/fr/reglages.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import { settings, updateSettings } from "../settings/store.svelte.ts";
  import type { BotLevels } from "../settings/settings.ts";
  import ColorTile from "../ui/ColorTile.svelte";
  import SettingsSheet from "../ui/SettingsSheet.svelte";
  import StrengthPicker from "../ui/StrengthPicker.svelte";

  // Default selection: the colour used last time, Bleu on a first visit, so « Jouer la partie »
  // is never disabled (settings.lastColor is already validated and falls back to Bleu).
  let selected = $state<Color>(settings.lastColor);
  let tiles = $state<Record<Color, HTMLButtonElement | undefined>>({
    bleu: undefined,
    jaune: undefined,
    rouge: undefined,
    vert: undefined,
  });

  const partner = $derived(PARTNER[selected]);
  const opponents = $derived(COLORS.filter((color) => color !== selected && color !== partner));
  // The computer seats in the order of the section (D-01): the partner, the opponent on the left on
  // the board (the next seat clockwise), then the one on the right. Levels are kept per role, so a
  // change of colour moves the rows' chips and keeps their levels.
  const rows = $derived<{ role: keyof BotLevels; color: Color }[]>([
    { role: "partner", color: partner },
    { role: "left", color: nextColor(selected) },
    { role: "right", color: nextColor(partner) },
  ]);

  function setLevel(role: keyof BotLevels, level: BotLevel) {
    updateSettings({ botLevels: { ...settings.botLevels, [role]: level } });
  }

  function select(color: Color) {
    selected = color;
    updateSettings({ lastColor: color });
  }

  /**
   * Arrow keys move the selection through the 2 x 2 grid (WAI-ARIA radio group): right and left
   * walk the reading order, up and down jump one row; the selection wraps around.
   */
  function onkeydown(event: KeyboardEvent) {
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2 };
    const delta = step[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const count = COLORS.length;
    const next = COLORS[(COLORS.indexOf(selected) + delta + count) % count];
    if (!next) return;
    select(next);
    tiles[next]?.focus();
  }

  let settingsOpen = $state(false);
  let settingsButton = $state<HTMLButtonElement | null>(null);

  function play() {
    // The AudioContext must be created and resumed synchronously inside this tap.
    unlock();
    updateSettings({ lastColor: selected });
    location.hash = "#/partie";
  }
</script>

<main class="launch">
  <header>
    <h1 class="t-display">{launch.title}</h1>
    <p class="tagline">{launch.tagline}</p>
  </header>

  <section class="choice">
    <h2 id="choose-color" class="t-heading">{launch.chooseColor}</h2>
    <div class="grid" role="radiogroup" aria-labelledby="choose-color">
      {#each COLORS as color (color)}
        <ColorTile
          {color}
          selected={color === selected}
          partner={color === partner}
          tabindex={color === selected ? 0 : -1}
          bind:el={tiles[color]}
          onselect={() => select(color)}
          {onkeydown}
        />
      {/each}
    </div>
  </section>

  <section class="strength" aria-labelledby="strength-heading">
    <p class="sr-only">{launch.yourTeam(seats[selected].name, seats[partner].name)}</p>
    <p class="sr-only">{launch.opponents(opponents.map((color) => seats[color].name))}</p>
    <h2 id="strength-heading" class="t-heading">{bots.heading}</h2>
    <div class="rows">
      {#each rows as row (row.role)}
        <StrengthPicker
          color={row.color}
          role={row.role}
          value={settings.botLevels[row.role]}
          onchange={(level) => setLevel(row.role, level)}
        />
      {/each}
    </div>
    <p class="note">{launch.note}</p>
  </section>

  <button type="button" class="btn btn-primary play" onclick={play}>{launch.play}</button>
  <button
    type="button"
    class="btn btn-text settings"
    bind:this={settingsButton}
    onclick={() => (settingsOpen = true)}
  >
    {reglages.open}
  </button>
</main>

{#if settingsOpen}
  <SettingsSheet onclose={() => (settingsOpen = false)} opener={settingsButton} />
{/if}

<style>
  .launch {
    box-sizing: border-box;
    width: 100%;
    max-width: 480px;
    min-height: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 32px;
    padding: 48px 16px;
  }

  header {
    text-align: center;
  }

  h1 {
    margin: 0;
    letter-spacing: 0.08em;
  }

  .tagline {
    margin: 0;
    color: var(--creme-attenuee);
  }

  h2 {
    margin: 0 0 var(--space-md);
    text-align: center;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(128px, 1fr));
    gap: 16px;
  }

  .strength {
    display: flex;
    flex-direction: column;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .note {
    margin: var(--space-md) 0 0;
    color: var(--creme-attenuee);
    text-align: center;
  }

  .play {
    width: 100%;
  }

  /* « Réglages » is a quiet text button under the primary action. */
  .settings {
    align-self: center;
    margin-top: calc(-1 * var(--space-sm));
  }
</style>
