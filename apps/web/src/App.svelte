<script lang="ts">
  import { untrack } from "svelte";
  import { noticePlace } from "./account/flow.ts";
  import { connectHub, tableOnScreen } from "./account/hub.svelte.ts";
  import { signInSheet, startAccount } from "./account/store.svelte.ts";
  import KnightDefs from "./board/KnightDefs.svelte";
  import { game } from "./i18n/fr/game.ts";
  import Account from "./routes/Account.svelte";
  import Friends from "./routes/Friends.svelte";
  import Game from "./routes/Game.svelte";
  import Home from "./routes/Home.svelte";
  import Invitation from "./routes/Invitation.svelte";
  import Launch from "./routes/Launch.svelte";
  import Recover from "./routes/Recover.svelte";
  import SoundTest from "./routes/SoundTest.svelte";
  import Table from "./routes/Table.svelte";
  import { pwaUpdate } from "./pwa/update.svelte.ts";
  import { leaveBlocked } from "./ui/leaveGuard.ts";
  import NoticeCard from "./ui/NoticeCard.svelte";
  import SignInSheet from "./ui/SignInSheet.svelte";
  import Toast from "./ui/Toast.svelte";

  /** Debug builds only (route #/panne): an error thrown while the screen is drawn, to see the error screen. */
  function explode(): never {
    throw new Error("panne de test");
  }

  /** The bench page's chunk could not load (offline, a new version): the error screen takes over. */
  function rethrow(error: unknown): never {
    throw error;
  }

  /** A fresh start: back on the home « Accueil », so a reload cannot loop into the same error. */
  function reload() {
    location.hash = "#/";
    location.reload();
  }

  let hash = $state(location.hash);
  // The hash may carry a query (#/partie?debug=geometry): the route is what precedes the "?".
  const route = $derived(hash.split("?")[0] ?? "");
  /** An online table's link: #/table/<id> (the id is checked by the route). */
  const TABLE_PREFIX = "#/table/";
  const tableId = $derived(route.startsWith(TABLE_PREFIX) ? route.slice(TABLE_PREFIX.length) : null);
  /** An account invitation's link: #/invitation/<code> (plan 04-01; the code is checked by the route). */
  const INVITATION_PREFIX = "#/invitation/";
  const invitationCode = $derived(
    route.startsWith(INVITATION_PREFIX) ? route.slice(INVITATION_PREFIX.length) : null,
  );

  // The signed-in account (plan 04-01): the cached one at once, GET /api/me next.
  startAccount();

  // Plan 04-11 (D-07, D-08): the app's own socket to its PlayerHub, open while signed in (connectHub
  // follows the account store: a sign-out closes it), and where the player is for the card's rules:
  // the route, the status of the table on screen, the backup code on screen, a sign-up or a recovery.
  const hub = connectHub();
  $effect(() => {
    const place = noticePlace({
      hash,
      tableStatus: tableOnScreen.status,
      backupCode: pwaUpdate.holds > 0,
    });
    untrack(() => hub.setPlace(place));
  });

  $effect(() => {
    const onHashChange = () => {
      // Plan 04-09: the backup code on screen undoes a stray change (the back button) and asks first.
      if (leaveBlocked()) return;
      hash = location.hash;
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  });
</script>

<!-- The knight symbols, once for the whole document: the board and the colour tiles share them. -->
<KnightDefs />

<!-- The in-app card (plan 04-11): before the routes, so it is first in the Tab order while it is up. -->
<NoticeCard {hub} />

<!-- An unexpected error never shows its text, stack or the state of the game: only a way out (T-01-33). -->
<svelte:boundary onerror={(error) => console.error(error)}>
  {#if route === "#/partie"}
    <Game />
  {:else if route === "#/ordinateur"}
    <!-- The solo setup (the launch screen of phases 1 and 3), one tap from the home (02-04, D-09). -->
    <Launch />
  {:else if tableId !== null}
    {#key tableId}
      <Table id={tableId} />
    {/key}
  {:else if invitationCode !== null}
    <!-- Not behind « Tourne ton téléphone »: a link opened from a messaging app arrives upright. -->
    {#key invitationCode}
      <Invitation code={invitationCode} />
    {/key}
  {:else if route === "#/secours"}
    <!-- « Retrouver mon compte » (plan 04-09): not behind « Tourne ton téléphone » either. -->
    <Recover />
  {:else if route === "#/compte"}
    <!-- « Mon compte » (plan 04-10): signed in only; signed out, the home with the sign-in sheet open
         and the session-ended toast. Not behind « Tourne ton téléphone ». -->
    <Account />
  {:else if route === "#/amis"}
    <!-- « Mes amis » (plan 04-10): signed in only, as « Mon compte ». -->
    <Friends />
  {:else if route === "#/sons"}
    <SoundTest />
  {:else if route === "#/banc"}
    <!-- The bench « Banc d’essai de l’ordinateur » (03-06), in every build and linked from nowhere: its
         own chunk, loaded only here. Not behind « Tourne ton téléphone »: it works held either way. -->
    {#await import("./routes/Bench.svelte") then bench}
      <bench.default />
    {:catch error}
      {rethrow(error)}
    {/await}
  {:else if __TOC_DEBUG__ && route === "#/panne"}
    {explode()}
  {:else}
    <Home />
  {/if}

  {#snippet failed()}
    <main class="oops" role="alert" data-error-screen>
      <h1 class="t-heading">{game.error.heading}</h1>
      <p>{game.error.body}</p>
      <button type="button" class="btn btn-primary" onclick={reload}>{game.error.reload}</button>
    </main>
  {/snippet}
</svelte:boundary>

<!-- « Se connecter » (plan 04-09): one sheet for the whole app, over whatever screen opened it. -->
{#if signInSheet.open}
  <SignInSheet />
{/if}

<!-- The one transient message of the app (UI-SPEC « Toast »). -->
<Toast />

<style>
  .oops {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    min-height: 100dvh;
    padding: var(--space-lg);
    text-align: center;
  }

  .oops h1,
  .oops p {
    margin: 0;
  }
</style>
