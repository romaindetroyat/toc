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
  import { screen } from "../ui/screen.svelte.ts";
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

  // The layout follows the game's screen modes (03-UI-SPEC « Launch screen layouts »), plus one width
  // threshold for the phone held sideways. The launch screen is never behind « Tourne ton téléphone ».
  // - computer: screen.chrome "bar" (landscape from 960 x 600), two columns under a centred header;
  // - two: compact from 640 wide, two columns, smaller tiles, no tagline or note;
  // - one: compact under 640 wide, one column that scrolls, the button in a sticky band;
  // - portrait: the phase-1 column, with the same sticky band.
  type Layout = "computer" | "two" | "one" | "portrait";
  const TWO_COLUMNS_FROM = 640;
  let width = $state(typeof window === "undefined" ? 1280 : window.innerWidth);
  const layout = $derived<Layout>(
    screen.chrome === "bar"
      ? "computer"
      : screen.chrome === "rotate"
        ? "portrait"
        : width >= TWO_COLUMNS_FROM
          ? "two"
          : "one",
  );
  const compact = $derived(layout === "two" || layout === "one");

  let settingsOpen = $state(false);
  let settingsButton = $state<HTMLButtonElement | null>(null);

  function play() {
    // The AudioContext must be created and resumed synchronously inside this tap.
    unlock();
    updateSettings({ lastColor: selected });
    location.hash = "#/partie";
  }
</script>

<svelte:window bind:innerWidth={width} />

{#snippet header()}
  <header>
    <h1 class="t-display">{launch.title}</h1>
    <p class="tagline">{launch.tagline}</p>
  </header>
{/snippet}

<main class="launch" data-layout={layout}>
  {#if !compact}{@render header()}{/if}

  <div class="columns">
    <section class="choice">
      {#if compact}{@render header()}{/if}
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
            {compact}
          />
        {/each}
      </div>
    </section>

    <div class="right">
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

      <!-- One button row, DOM order = visual order: [Accueil] 16 [Réglages] 16 [Jouer la partie]. -->
      <div class="actions">
        <a class="btn btn-text home" href="#/" data-home-link>{launch.home}</a>
        <button
          type="button"
          class="btn btn-text settings"
          bind:this={settingsButton}
          onclick={() => (settingsOpen = true)}
        >
          {reglages.open}
        </button>
        <button type="button" class="btn btn-primary play" onclick={play}>{launch.play}</button>
      </div>
    </div>
  </div>
</main>

{#if settingsOpen}
  <SettingsSheet onclose={() => (settingsOpen = false)} opener={settingsButton} />
{/if}

<style>
  .launch {
    --gutter-l: calc(var(--space-md) + env(safe-area-inset-left, 0px));
    --gutter-r: calc(var(--space-md) + env(safe-area-inset-right, 0px));
    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-inline: var(--gutter-l) var(--gutter-r);
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
    margin: 0;
  }

  .grid {
    display: grid;
  }

  .strength,
  .right {
    display: flex;
    flex-direction: column;
  }

  .rows {
    display: flex;
    flex-direction: column;
  }

  .note {
    margin: 0;
    color: var(--creme-attenuee);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .home,
  .settings {
    flex: none;
  }

  .play {
    flex: 1;
  }

  /* Computer (BAR_QUERY): the header centred over two columns, the colours at the left (272), the
     strength rows, the note and the button row at the right (at most 520). */
  .launch[data-layout="computer"] {
    gap: var(--space-xl);
    padding-block: calc(var(--space-xl) + env(safe-area-inset-top, 0px))
      calc(var(--space-xl) + env(safe-area-inset-bottom, 0px));
  }

  .launch[data-layout="computer"] .columns {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: var(--space-2xl);
  }

  .launch[data-layout="computer"] .choice {
    flex: none;
    width: 272px;
  }

  .launch[data-layout="computer"] .right {
    flex: 0 1 520px;
    min-width: 0;
  }

  .launch[data-layout="computer"] h2 {
    margin-bottom: var(--space-md);
  }

  .launch[data-layout="computer"] .grid {
    grid-template-columns: repeat(2, minmax(128px, 1fr));
    gap: var(--space-md);
  }

  .launch[data-layout="computer"] .rows {
    gap: var(--space-md);
  }

  .launch[data-layout="computer"] .note {
    margin-top: var(--space-md);
  }

  .launch[data-layout="computer"] .actions {
    margin-top: var(--space-lg);
  }

  /* Phone held sideways from 640 wide: two columns centred as a group, the left one 200 (TOC, the
     heading, the 2 x 2 tiles of 96 x 88), the right one at most 520 (the rows, the button row). */
  .launch[data-layout="two"] {
    padding-block: calc(12px + env(safe-area-inset-top, 0px))
      calc(12px + env(safe-area-inset-bottom, 0px));
  }

  .launch[data-layout="two"] .columns {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .launch[data-layout="two"] .choice {
    flex: none;
    width: 200px;
  }

  .launch[data-layout="two"] .right {
    flex: 0 1 520px;
    min-width: 0;
  }

  .launch[data-layout="two"] .grid {
    grid-template-columns: repeat(2, 96px);
  }

  .launch[data-layout="two"] .actions {
    margin-top: var(--space-md);
  }

  /* Phone held sideways under 640 wide: one column that scrolls; the four tiles in one row. */
  .launch[data-layout="one"] {
    justify-content: flex-start;
    padding-top: calc(12px + env(safe-area-inset-top, 0px));
  }

  .launch[data-layout="one"] .grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .launch[data-layout="one"] .strength {
    margin-top: var(--space-md);
  }

  .launch[data-layout="one"] .actions {
    margin-top: var(--space-md);
  }

  /* Both compact layouts: TOC, 8, the heading, 8, the tiles 8 apart; no tagline, no note. */
  .launch[data-layout="two"] header,
  .launch[data-layout="one"] header {
    margin-bottom: var(--space-sm);
    text-align: start;
  }

  .launch[data-layout="two"] h2,
  .launch[data-layout="one"] h2 {
    margin-bottom: var(--space-sm);
  }

  .launch[data-layout="two"] .grid,
  .launch[data-layout="one"] .grid,
  .launch[data-layout="two"] .rows,
  .launch[data-layout="one"] .rows {
    gap: var(--space-sm);
  }

  .launch[data-layout="two"] .tagline,
  .launch[data-layout="one"] .tagline,
  .launch[data-layout="two"] .note,
  .launch[data-layout="one"] .note {
    display: none;
  }

  /* Portrait: the phase-1 column (max 480, padding 48 / 16), the page scrolls. */
  .launch[data-layout="portrait"] {
    max-width: 480px;
    justify-content: flex-start;
    gap: var(--space-xl);
    padding-top: calc(var(--space-2xl) + env(safe-area-inset-top, 0px));
  }

  .launch[data-layout="portrait"] h2 {
    margin-bottom: var(--space-md);
    text-align: center;
  }

  .launch[data-layout="portrait"] .grid {
    grid-template-columns: repeat(2, minmax(128px, 1fr));
    gap: var(--space-md);
  }

  .launch[data-layout="portrait"] .rows {
    gap: var(--space-md);
  }

  .launch[data-layout="portrait"] .note {
    margin-top: var(--space-md);
    text-align: center;
  }

  /* One column and portrait: the wrappers step aside, so the button row is a child of the page's
     column and its sticky band stays at the bottom of the screen while the page scrolls. */
  .launch[data-layout="one"] .columns,
  .launch[data-layout="one"] .right,
  .launch[data-layout="portrait"] .columns,
  .launch[data-layout="portrait"] .right {
    display: contents;
  }

  .launch[data-layout="one"] .actions,
  .launch[data-layout="portrait"] .actions {
    position: sticky;
    bottom: 0;
    z-index: 1;
    margin-inline: calc(-1 * var(--gutter-l)) calc(-1 * var(--gutter-r));
    padding: var(--space-sm) var(--gutter-r) max(var(--space-sm), env(safe-area-inset-bottom, 0px))
      var(--gutter-l);
    border-top: 1px solid var(--brun-aide-memoire);
    background: var(--noyer);
  }
</style>
