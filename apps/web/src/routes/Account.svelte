<script lang="ts">
  import type { MeAccount } from "@toc/protocol";
  import { onMount, tick } from "svelte";
  import { me as fetchMe, logOut, newBackupCode } from "../account/api.ts";
  import { browserPushManager } from "../account/browserPush.ts";
  import { accountSeats, dateText, signOutBody } from "../account/flow.ts";
  import { disablePush } from "../account/push.ts";
  import { account, requireSignIn, setAccount, signedOut } from "../account/store.svelte.ts";
  import { compte } from "../i18n/fr/compte.ts";
  import { browserApi } from "../net/api.ts";
  import { pageStorage } from "../net/device.ts";
  import { loadTables } from "../net/tables.ts";
  import BackupCodeScreen from "../ui/BackupCodeScreen.svelte";
  import ConfirmDialog from "../ui/ConfirmDialog.svelte";
  import Icon from "../ui/Icon.svelte";
  import NotificationsPanel from "../ui/NotificationsPanel.svelte";
  import OfflinePage from "../ui/OfflinePage.svelte";
  import Page from "../ui/Page.svelte";
  import PasskeyList from "../ui/PasskeyList.svelte";
  import { showToast } from "../ui/toast.svelte.ts";

  // « Mon compte » at #/compte (plan 04-10, D-02, D-08, D-12, SC1; 04-UI-SPEC « Mon compte »), the
  // « Page » layout shared with « Mes amis »: the header (« Accueil », the h1), the identity column
  // (« Ton pseudo », the pseudo, « Compte créé le {date} », « Se déconnecter » and « Sur cet appareil
  // seulement. ») and three sections in this order: « Notifications », « Clés d’accès », « Code de
  // secours ». The cached pseudo shows at once; each section says « Chargement… » until its answer and
  // has its own error with « Réessayer ». Signed out: the home, the sign-in sheet open and the
  // session-ended toast. Offline: the offline page. The update strip sits at the bottom of the right
  // column (after the header in one column).
  //
  // « Se déconnecter » (D-12) asks first (not destructive: signing in again gives everything back),
  // naming how many of this device's games it concerns; then this device's push subscription goes,
  // the session ends (logOut), the account and its rows hide, and the guest home says « Session fermée
  // sur cet appareil. ». « Créer un nouveau code » (D-02) asks, then the passkey (step-up), then shows
  // the new code once (BackupCodeScreen, its regeneration form) and comes back with its toast.

  let online = $state(typeof navigator === "undefined" || navigator.onLine !== false);
  let info = $state<MeAccount | null>(null);
  let status = $state<"loading" | "ready" | "error">("loading");
  let now = $state(Date.now());

  const pseudo = $derived(info?.pseudo ?? account.current?.pseudo ?? "");

  /** Leaving for the home: after « Se déconnecter », or signed out. */
  let leaving = false;

  /** Signed out (a 401, or no session at all): the home, the sign-in sheet, the toast. */
  function signedOutHere() {
    if (leaving) return;
    leaving = true;
    requireSignIn();
  }

  async function load(): Promise<void> {
    if (!browserApi.online()) {
      online = false;
      return;
    }
    online = true;
    status = "loading";
    let answered: number | null = null;
    const answer = await fetchMe({
      online: browserApi.online,
      fetch: async (input, init) => {
        const response = await browserApi.fetch(input, init);
        answered = response.status;
        return response;
      },
    });
    if (answer === "offline") {
      if (answered === null && !browserApi.online()) online = false;
      else status = "error";
      return;
    }
    if (answer === null) {
      signedOutHere();
      return;
    }
    setAccount(answer);
    info = answer;
    now = Date.now();
    status = "ready";
  }

  onMount(() => {
    void load();
  });

  // The store cleared the account meanwhile (its own GET /api/me met a 401).
  let hadAccount = account.current !== null;
  $effect(() => {
    if (account.current !== null) {
      hadAccount = true;
      return;
    }
    if (hadAccount) signedOutHere();
  });

  // --- « Se déconnecter » ---

  let signOutButton = $state<HTMLButtonElement | null>(null);
  let signOutAsk = $state<string | null>(null);
  /** The confirmation's body, kept while it slides out. */
  let signOutText = $state("");
  let signingOut = $state(false);

  function askSignOut() {
    const id = account.current?.id ?? info?.id ?? null;
    const seats = id === null ? 0 : accountSeats(loadTables(pageStorage()), id);
    signOutText = signOutBody(seats);
    signOutAsk = signOutText;
  }

  async function signOut() {
    signOutAsk = null;
    if (signingOut) return;
    signingOut = true;
    leaving = true;
    // This device's notifications end first, while the session still allows it (the server also
    // drops the session's subscriptions with it).
    try {
      await disablePush({ manager: browserPushManager(false) });
    } catch {
      // The session's end removes the server's row anyway.
    }
    await logOut({ forget: signedOut });
    location.hash = "#/";
    showToast(compte.signOut.done);
  }

  // --- « Créer un nouveau code » ---

  let codeButton = $state<HTMLButtonElement | null>(null);
  let codeAsk = $state(false);
  let renewing = $state(false);
  let renewed = $state<string | null>(null);

  async function renew() {
    codeAsk = false;
    if (renewing) return;
    renewing = true;
    const result = await newBackupCode();
    renewing = false;
    if (result.ok) {
      renewed = result.backupCode;
      return;
    }
    if (result.reason === "cancelled") showToast(compte.code.notConfirmed);
    else if (result.reason === "signed-out") signedOutHere();
    else if (result.reason === "offline") showToast(compte.keys.offline);
    else showToast(compte.code.failed);
    codeButton?.focus();
  }

  async function kept() {
    renewed = null;
    showToast(compte.code.saved);
    await tick();
    codeButton?.focus();
    await load();
  }
</script>

{#snippet sectionState()}
  {#if status === "loading"}
    <p class="t-label muted">{compte.account.loading}</p>
  {:else}
    <div class="error-row">
      <p class="t-label">{compte.account.sectionError}</p>
      <button type="button" class="btn btn-text" onclick={() => void load()}>
        {compte.account.retry}
      </button>
    </div>
  {/if}
{/snippet}

{#if renewed !== null}
  <BackupCodeScreen code={renewed} form="regeneration" onkept={() => void kept()} />
{:else if !online}
  <OfflinePage onretry={() => void load()} />
{:else}
  <Page
    title={compte.account.title}
    homeLabel={compte.account.home}
    busy={signingOut}
    attrs={{ "data-account": "" }}
    leftAttrs={{ "data-account-identity": "" }}
    rightAttrs={{ "data-account-right": "" }}
  >
    {#snippet left()}
      <p class="t-label muted">{compte.account.pseudoLabel}</p>
      <p class="t-heading pseudo" title={pseudo} data-account-pseudo>{pseudo}</p>
      <p class="t-label muted created">
        {info === null
          ? compte.account.loading
          : compte.account.created(dateText(info.createdAt, now))}
      </p>
      <button
        type="button"
        class="btn btn-secondary wide"
        aria-haspopup="dialog"
        aria-busy={signingOut}
        bind:this={signOutButton}
        onclick={askSignOut}
      >
        <Icon name="log-out" size={20} />
        {compte.account.signOut}
      </button>
      <p class="t-label muted note">{compte.account.signOutNote}</p>
    {/snippet}

    {#snippet right()}
      <section
        class="section"
        data-account-section="notifications"
        aria-labelledby="notifications-heading"
      >
        <h2 id="notifications-heading" class="t-heading">{compte.notifications.heading}</h2>
        <NotificationsPanel onsignedout={signedOutHere} />
      </section>

      <section class="section" data-account-section="cles" aria-labelledby="keys-heading">
        <h2 id="keys-heading" class="t-heading">{compte.keys.heading}</h2>
        {#if status === "ready" && info !== null}
          <PasskeyList
            passkeys={info.passkeys}
            {now}
            onchanged={load}
            onsignedout={signedOutHere}
          />
        {:else}
          {@render sectionState()}
        {/if}
      </section>

      <section class="section" data-account-section="code" aria-labelledby="code-heading">
        <h2 id="code-heading" class="t-heading">{compte.code.heading}</h2>
        {#if status === "ready" && info !== null}
          <p class="t-body">
            {info.backupAt === null
              ? compte.code.none
              : compte.code.created(dateText(info.backupAt, now))}
          </p>
          <button
            type="button"
            class="btn btn-secondary wide"
            aria-haspopup="dialog"
            aria-busy={renewing}
            bind:this={codeButton}
            onclick={() => (codeAsk = true)}
          >
            {compte.code.renew}
          </button>
        {:else}
          {@render sectionState()}
        {/if}
      </section>
    {/snippet}
  </Page>
{/if}

{#if signOutAsk !== null}
  <ConfirmDialog
    title={compte.signOut.title}
    body={signOutText}
    safeLabel={compte.signOut.safe}
    otherLabel={compte.signOut.other}
    destructive={false}
    opener={signOutButton}
    onconfirm={() => void signOut()}
    oncancel={() => (signOutAsk = null)}
  />
{/if}

{#if codeAsk}
  <ConfirmDialog
    title={compte.code.confirm.title}
    body={compte.code.confirm.body}
    safeLabel={compte.code.confirm.safe}
    otherLabel={compte.code.confirm.other}
    destructive={false}
    opener={codeButton}
    onconfirm={() => void renew()}
    oncancel={() => (codeAsk = false)}
  />
{/if}

<style>
  h2,
  p {
    margin: 0;
  }

  .muted {
    color: var(--creme-attenuee);
  }

  /* The identity column: « Ton pseudo », the pseudo (ellipsis), the date, « Se déconnecter », the note. */
  .pseudo {
    margin-top: var(--space-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .created {
    margin: var(--space-xs) 0 var(--space-md);
  }

  .note {
    margin-top: var(--space-xs);
  }

  .wide {
    width: 100%;
  }

  .wide[aria-busy="true"] {
    cursor: progress;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .error-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
  }
</style>
