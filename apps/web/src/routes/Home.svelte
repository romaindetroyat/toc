<script lang="ts">
  import { account } from "../account/store.svelte.ts";
  import logo from "../assets/logo/logo-128.webp";
  import { unlock } from "../audio/engine.ts";
  import { accueil } from "../i18n/fr/accueil.ts";
  import { compte } from "../i18n/fr/compte.ts";
  import { browserApi, createTable } from "../net/api.ts";
  import { loadDevice, pageStorage, saveName } from "../net/device.ts";
  import ChoiceTile from "../ui/ChoiceTile.svelte";
  import NamePrompt from "../ui/NamePrompt.svelte";
  import SettingsButton from "../ui/SettingsButton.svelte";
  import SmallTile from "../ui/SmallTile.svelte";
  import { markNewTable } from "../ui/InviteSheet.svelte";
  import TableList from "../ui/TableList.svelte";
  import { screen } from "../ui/screen.svelte.ts";
  import { showToast } from "../ui/toast.svelte.ts";

  // « Accueil » at #/ (02-UI-SPEC « Home « Accueil » », D-09): the game against the computer (the solo
  // setup at #/ordinateur, unchanged and offline) or an online table, the first name this device
  // remembers, and « Mes parties en cours ». No amber here: the two choices are oak tiles.
  // Romain's logo (2026-10-17, plan 02-04b) sits before « TOC »: as high as the title row in the
  // compact layouts (34, no change to the fit), 64 beside the title and the tagline elsewhere. It
  // is decorative (alt=""): the heading already says « TOC ».
  // Plan 04-01: signed in, the small tile « Mon compte » (the pseudo under it) takes the place of the
  // name line (04-UI-SPEC « Small tiles »); the guest home is unchanged.

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

  // « Créer une table en ligne » (D-01, D-02): without a stored first name the prompt comes first; then
  // POST /api/tables, « Création de la table… », and the table's link opens. Offline: the toast only.
  let prompting = $state(false);
  let creating = $state(false);
  let createError = $state<"server" | "offline" | null>(null);

  async function startCreate() {
    creating = true;
    createError = null;
    const result = await createTable();
    creating = false;
    if (result.ok) {
      // The waiting room opens « Inviter à la table » by itself, once (D-02).
      markNewTable(result.id);
      location.hash = `#/table/${result.id}`;
      return;
    }
    if (prompting) createError = result.reason;
    else showToast(result.reason === "offline" ? accueil.home.offline : accueil.name.serverError);
  }

  function create() {
    // The AudioContext must be created and resumed synchronously inside this tap.
    unlock();
    if (creating) return;
    if (!browserApi.online()) {
      showToast(accueil.home.offline);
      return;
    }
    if (device.name === null) {
      prompting = true;
      return;
    }
    void startCreate();
  }

  function named(name: string) {
    const saved = saveName(storage, name);
    if (saved === null) return;
    device = saved;
    void startCreate();
  }

  function backHome() {
    prompting = false;
    createError = null;
  }

  // « Changer » opens the sheet « Changer de prénom », prefilled; the focus returns to « Changer ».
  let changing = $state(false);
  let changeButton = $state<HTMLButtonElement | null>(null);

  function rename(name: string) {
    const saved = saveName(storage, name);
    if (saved !== null) device = saved;
    changing = false;
  }
</script>

<svelte:window bind:innerWidth={width} />

{#if prompting}
  <NamePrompt
    context={accueil.name.creating}
    busy={creating}
    error={createError}
    onsubmit={named}
    onback={backHome}
  />
{:else}
<main class="home" data-layout={layout} data-home>
  <!-- DOM order = keyboard order: the gear, tile 1, tile 2, « Changer », the list. -->
  <div class="gear" data-settings-slot><SettingsButton /></div>

  {#if !compact}
    <header class="header">
      <img class="logo" src={logo} alt="" width="64" height="64" data-home-logo />
      <div class="heading-text">
        <h1 class="t-display title">{accueil.home.title}</h1>
        <p class="tagline">{accueil.home.tagline}</p>
      </div>
    </header>
  {/if}

  <div class="columns">
    <section class="choices">
      {#if compact}
        <header class="header">
          <img class="logo" src={logo} alt="" width="34" height="34" data-home-logo />
          <h1 class="t-display title">{accueil.home.title}</h1>
        </header>
      {/if}
      <div class="tiles">
        <ChoiceTile
          data-home-choice="ordinateur"
          href="#/ordinateur"
          picture="knight"
          label={accueil.home.solo.label}
          sub={accueil.home.solo.sub}
          compact={layout !== "computer"}
        />
        <ChoiceTile
          data-home-choice="table"
          picture="users"
          label={creating ? accueil.name.busy : accueil.home.online.label}
          busy={creating}
          sub={accueil.home.online.sub}
          onclick={create}
          compact={layout !== "computer"}
        />
      </div>
      {#if account.current !== null}
        <div class="small-tiles" data-small-tiles>
          <SmallTile
            kind="compte"
            icon="user"
            label={compte.tile.account}
            sub={account.current.pseudo}
            name={compte.tile.accountLabel(account.current.pseudo)}
            href="#/compte"
            wide={layout === "computer"}
          />
        </div>
      {:else if device.name !== null}
        <p class="name-line" data-name-line>
          <span class="name-text">
            {accueil.home.nameLabel}
            <strong title={device.name}>{device.name}</strong>
          </span>
          <button
            type="button"
            class="btn btn-text"
            aria-label={accueil.home.changeLabel}
            aria-haspopup="dialog"
            bind:this={changeButton}
            onclick={() => {
              unlock();
              changing = true;
            }}
          >
            {accueil.home.change}
          </button>
        </p>
      {/if}
    </section>

    <section class="tables" aria-labelledby="tables-heading">
      <h2 id="tables-heading" class="t-heading">{accueil.home.listHeading}</h2>
      <div class="list">
        <TableList {storage} />
      </div>
    </section>
  </div>
</main>
{/if}

{#if changing && device.name !== null}
  <NamePrompt
    initial={device.name}
    onsubmit={rename}
    sheet={{ onclose: () => (changing = false), opener: changeButton }}
  />
{/if}

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
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
  }

  /* The logo's blue square, rounded like its board. */
  .logo {
    flex: none;
    display: block;
    border-radius: 22%;
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

  /* The row of small tiles (136 or 152 wide, 48 high), 8 apart (16 on the computer). */
  .small-tiles {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }

  .home[data-layout="computer"] .small-tiles {
    gap: var(--space-md);
    margin-top: var(--space-md);
  }

  .tables {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .list {
    display: flex;
    flex-direction: column;
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

  /* Both compact layouts: the logo and TOC at the left over the tiles, 8 apart. */
  .home[data-layout="two"] .header,
  .home[data-layout="one"] .header {
    justify-content: flex-start;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
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
