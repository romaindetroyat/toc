<script lang="ts">
  import { accueil } from "../i18n/fr/accueil.ts";
  import { loadDevice, pageStorage } from "../net/device.ts";
  import ChoiceTile from "../ui/ChoiceTile.svelte";
  import SettingsButton from "../ui/SettingsButton.svelte";
  import { screen } from "../ui/screen.svelte.ts";

  // « Accueil » at #/ (02-UI-SPEC « Home « Accueil » », D-09): the game against the computer (the solo
  // setup at #/ordinateur, unchanged and offline) or an online table, the first name this device
  // remembers, and « Mes parties en cours ». No amber here: the two choices are oak tiles.

  const storage = pageStorage();
  let device = $state(loadDevice(storage));

  // The launch screen's layouts (same media queries, same 640 px threshold), never behind « Tourne ton
  // téléphone »: computer (BAR_QUERY), two columns and one column (compact), portrait.
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

  function create() {
    location.hash = "#/table/";
  }

  function changeName() {
    device = loadDevice(storage);
  }
</script>

<svelte:window bind:innerWidth={width} />

<main class="home" data-layout={layout} data-home>
  <!-- DOM order = keyboard order: the gear, tile 1, tile 2, « Changer », the list. -->
  <div class="gear" data-settings-slot><SettingsButton /></div>

  {#if !compact}
    <header class="header">
      <h1 class="t-display title">{accueil.home.title}</h1>
      <p class="tagline">{accueil.home.tagline}</p>
    </header>
  {/if}

  <div class="columns">
    <section class="choices">
      {#if compact}
        <header class="header">
          <h1 class="t-display title">{accueil.home.title}</h1>
        </header>
      {/if}
      <div class="tiles">
        <ChoiceTile
          choice="ordinateur"
          href="#/ordinateur"
          picture="knight"
          label={accueil.home.solo.label}
          sub={accueil.home.solo.sub}
          compact={layout !== "computer"}
        />
        <ChoiceTile
          choice="table"
          picture="users"
          label={accueil.home.online.label}
          sub={accueil.home.online.sub}
          onclick={create}
          compact={layout !== "computer"}
        />
      </div>
      {#if device.name !== null}
        <p class="name-line" data-name-line>
          <span class="name-text">
            {accueil.home.nameLabel}
            <strong title={device.name}>{device.name}</strong>
          </span>
          <button
            type="button"
            class="btn btn-text"
            aria-label={accueil.home.changeLabel}
            onclick={changeName}
          >
            {accueil.home.change}
          </button>
        </p>
      {/if}
    </section>

    <section class="tables" aria-labelledby="tables-heading">
      <h2 id="tables-heading" class="t-heading">{accueil.home.listHeading}</h2>
      <div class="list">
        <div class="empty" data-tables-empty>
          <p class="empty-heading">{accueil.home.emptyHeading}</p>
          <p class="empty-body">{accueil.home.emptyBody}</p>
        </div>
      </div>
    </section>
  </div>
</main>

<style>
  .home {
    --gutter-l: calc(var(--space-md) + env(safe-area-inset-left, 0px));
    --gutter-r: calc(var(--space-md) + env(safe-area-inset-right, 0px));
    position: relative;
    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-inline: var(--gutter-l) var(--gutter-r);
  }

  .gear {
    position: absolute;
    top: calc(12px + env(safe-area-inset-top, 0px));
    right: var(--gutter-r);
    z-index: 1;
  }

  .header {
    text-align: center;
  }

  .title {
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

  .tiles {
    display: flex;
    flex-direction: column;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-height: var(--touch);
    margin: 0;
  }

  .name-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name-line .btn-text {
    flex: none;
  }

  .tables {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .empty p {
    margin: 0;
  }

  .empty-heading {
    font-weight: 700;
  }

  .empty-body {
    color: var(--creme-attenuee);
  }

  /* Computer (BAR_QUERY): the header centred, two columns centred as a group 24 apart: the tiles and
     the name line (320) at the left, the list (480) at the right, scrolling inside its column. */
  .home[data-layout="computer"] {
    gap: var(--space-xl);
    padding-block: calc(var(--space-xl) + env(safe-area-inset-top, 0px))
      calc(var(--space-xl) + env(safe-area-inset-bottom, 0px));
  }

  .home[data-layout="computer"] .columns,
  .home[data-layout="two"] .columns {
    display: grid;
    justify-content: center;
    gap: var(--space-lg);
  }

  .home[data-layout="computer"] .columns {
    grid-template-columns: 320px minmax(0, 480px);
  }

  .home[data-layout="computer"] .tiles {
    gap: var(--space-md);
  }

  .home[data-layout="computer"] .name-line {
    margin-top: var(--space-md);
  }

  /* The list column takes the height of the tiles' column (contain: size keeps its content out of the
     row's sizing) and its list scrolls inside. */
  .home[data-layout="computer"] .tables,
  .home[data-layout="two"] .tables {
    contain: size;
  }

  .home[data-layout="computer"] .tables h2 {
    margin-bottom: var(--space-md);
  }

  .home[data-layout="computer"] .list,
  .home[data-layout="two"] .list {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
  }

  /* Phone held sideways from 640 wide: two columns, the left 280 (TOC, the tiles, the name line), the
     right at most 480; no tagline; vertically centred. */
  .home[data-layout="two"] {
    padding-block: calc(12px + env(safe-area-inset-top, 0px))
      calc(12px + env(safe-area-inset-bottom, 0px));
  }

  .home[data-layout="two"] .columns {
    grid-template-columns: 280px minmax(0, 480px);
  }

  .home[data-layout="two"] .tables h2 {
    margin-bottom: var(--space-sm);
  }

  /* Both compact layouts: TOC at the left over the tiles, 8 apart. */
  .home[data-layout="two"] .header,
  .home[data-layout="one"] .header {
    margin-bottom: var(--space-sm);
    text-align: start;
  }

  .home[data-layout="two"] .title,
  .home[data-layout="one"] .title {
    line-height: 34px;
  }

  .home[data-layout="two"] .tiles {
    gap: var(--space-sm);
  }

  .home[data-layout="two"] .name-line {
    margin-top: var(--space-sm);
  }

  /* Phone held sideways under 640 wide: one column, the page scrolls; the two tiles side by side. */
  .home[data-layout="one"] {
    justify-content: flex-start;
    padding-block: calc(12px + env(safe-area-inset-top, 0px))
      calc(var(--space-md) + env(safe-area-inset-bottom, 0px));
  }

  /* The gear sits at the top right, beside TOC: the header row is as high as the gear. */
  .home[data-layout="one"] .header {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    padding-right: calc(var(--touch) + var(--space-sm));
  }

  .home[data-layout="one"] .tiles {
    flex-direction: row;
    gap: var(--space-sm);
  }

  .home[data-layout="one"] .tiles > :global(*) {
    flex: 1 1 0;
    min-width: 0;
  }

  .home[data-layout="one"] .name-line {
    margin-top: var(--space-sm);
  }

  .home[data-layout="one"] .tables {
    margin-top: var(--space-md);
  }

  .home[data-layout="one"] .tables h2,
  .home[data-layout="portrait"] .tables h2 {
    margin-bottom: var(--space-sm);
  }

  /* Portrait: the phase-1 column (max 480, padding 48 / 16), the tiles stacked, the page scrolls. */
  .home[data-layout="portrait"] {
    max-width: 480px;
    justify-content: flex-start;
    gap: var(--space-xl);
    padding-top: calc(var(--space-2xl) + env(safe-area-inset-top, 0px));
    padding-bottom: calc(var(--space-xl) + env(safe-area-inset-bottom, 0px));
  }

  .home[data-layout="portrait"] .tiles {
    gap: var(--space-sm);
  }

  .home[data-layout="portrait"] .name-line {
    margin-top: var(--space-sm);
  }

  .home[data-layout="portrait"] .tables {
    margin-top: var(--space-lg);
  }
</style>
