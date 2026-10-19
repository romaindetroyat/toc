<script lang="ts">
  import { onMount, tick } from "svelte";
  import { acceptInvitation, type InvitationView, invitationState, signUp } from "../account/api.ts";
  import { invitationRow, prefill, pseudoError, type RowAction } from "../account/flow.ts";
  import {
    account,
    openSignIn,
    refreshAccount,
    sessionEnded,
    setAccount,
  } from "../account/store.svelte.ts";
  import { browserCeremonies } from "../account/webauthn.ts";
  import { compte } from "../i18n/fr/compte.ts";
  import { browserApi } from "../net/api.ts";
  import { loadDevice, pageStorage } from "../net/device.ts";
  import { loadTables } from "../net/tables.ts";
  import BackupCodeScreen from "../ui/BackupCodeScreen.svelte";
  import HomeStrip from "../ui/HomeStrip.svelte";
  import Notice from "../ui/Notice.svelte";
  import PseudoForm from "../ui/PseudoForm.svelte";
  import { screen } from "../ui/screen.svelte.ts";
  import { stepIn } from "../ui/stepIn.ts";
  import { showToast } from "../ui/toast.svelte.ts";

  // #/invitation/<code> (plans 04-01 and 04-09, 04-UI-SPEC « Invitation », ACCT-01, D-02, D-03, D-04,
  // D-06, D-11): the state of the link first (« Ouverture de l’invitation… », the slow line after
  // 10 s), then the row flow.invitationRow picks: unknown, used (« Se connecter »), expired, offline
  // (« Réessayer »), a browser without passkeys (« Copier le lien »), and for a signed-in player « Ajouter
  // {Inviteur} à tes amis ? », « {Inviteur} est déjà dans tes amis » or « C’est ton invitation »;
  // signed out, the two steps of a sign-up: the pseudo and the passkey, then the backup code shown
  // once. « J’ai déjà un compte » and « Se connecter » open the sign-in sheet; once signed in, the
  // link is asked again and the signed-in rows apply. So does the server's refusal of a second account
  // (signed in meanwhile, in another tab). After the code, the home with the welcome toast.
  // data-invitation names the case ("ok" for the pseudo step).
  type Props = { code: string };

  let { code }: Props = $props();

  let view = $state<InvitationView | { state: "loading" }>({ state: "loading" });
  let slow = $state(false);
  let step = $state<"pseudo" | "code">("pseudo");
  let busy = $state(false);
  let accepting = $state(false);
  let error = $state<string | null>(null);
  let backupCode = $state("");
  let pseudo = $state("");
  let heading = $state<HTMLHeadingElement | null>(null);
  let haveAccount = $state<HTMLButtonElement | null>(null);

  const SLOW_MS = 10_000;

  // This device's first name, when it is a valid pseudo (UI-SPEC « Field »); its guest tables (the
  // seats line: they pass to the account).
  const storage = pageStorage();
  const initial = prefill(loadDevice(storage).name);
  const guestTables = loadTables(storage).some((entry) => entry.account === undefined);

  const row = $derived(
    invitationRow({
      view,
      signedIn: account.current !== null,
      webauthn: browserCeremonies.supported(),
      online: view.state === "loading" || browserApi.online(),
      now: Date.now(),
    }),
  );
  const inviter = $derived("inviter" in view && view.inviter !== null ? view.inviter : null);
  const bootstrap = $derived(view.state === "ok" && "bootstrap" in view && view.bootstrap === true);
  const context = $derived(
    bootstrap
      ? compte.pseudo.bootstrap
      : inviter !== null
        ? compte.pseudo.invitedBy(inviter)
        : compte.pseudo.invited,
  );
  const compact = $derived(screen.chrome === "compact");

  async function load() {
    view = { state: "loading" };
    slow = false;
    error = null;
    const timer = setTimeout(() => {
      slow = true;
    }, SLOW_MS);
    const state = await invitationState(code);
    clearTimeout(timer);
    view = state;
    // The step's h1 takes the focus, except with a fine pointer, where the field's autofocus keeps it.
    if (row.kind === "pseudo" && !window.matchMedia("(pointer: fine)").matches) {
      await tick();
      heading?.focus();
    }
  }

  onMount(() => {
    void load();
  });

  /** Signed in meanwhile (the sheet, or another tab): the account, then the link again. */
  async function signedInMeanwhile() {
    await refreshAccount();
    await load();
  }

  async function create(chosen: string) {
    busy = true;
    error = null;
    const result = await signUp(code, chosen);
    busy = false;
    if (result.ok) {
      setAccount(result.me);
      pseudo = result.me.pseudo;
      backupCode = result.backupCode;
      step = "code";
      return;
    }
    const shown = pseudoError(result.reason);
    if ("line" in shown) {
      error = shown.line;
      return;
    }
    if (shown.row === "signed-in") void signedInMeanwhile();
    else if (shown.row === "unknown") view = { state: "unknown" };
    else if (shown.row === "unsupported") void load();
    else view = { state: shown.row, inviter };
  }

  function kept() {
    showToast(
      bootstrap || inviter === null
        ? compte.welcome.alone(pseudo)
        : compte.welcome.withFriend(pseudo, inviter),
    );
    location.hash = "#/";
  }

  async function accept() {
    if (accepting) return;
    accepting = true;
    const result = await acceptInvitation(code);
    accepting = false;
    if (result.ok) {
      if (result.already) {
        await load();
        return;
      }
      showToast(compte.invitation.addFriend.added(result.friend.pseudo));
      location.hash = "#/amis";
      return;
    }
    switch (result.reason) {
      case "signed-out":
        sessionEnded();
        await load();
        return;
      case "own":
        await load();
        return;
      case "used":
      case "expired":
        view = { state: result.reason, inviter };
        return;
      case "unknown":
        view = { state: "unknown" };
        return;
      case "offline":
        view = { state: "offline" };
        return;
      default:
        showToast(compte.invitation.addFriend.failed);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast(compte.invitation.unsupported.copied);
    } catch {
      showToast(compte.invitation.unsupported.copyFailed);
    }
  }

  function run(action: RowAction, opener: HTMLElement | null = null) {
    switch (action) {
      case "home":
        location.hash = "#/";
        return;
      case "friends":
        location.hash = "#/amis";
        return;
      case "retry":
        void load();
        return;
      case "copy-link":
        void copyLink();
        return;
      case "sign-in":
        openSignIn(opener, () => void load());
        return;
      case "accept":
        void accept();
        return;
    }
  }

  function signIn() {
    openSignIn(haveAccount, () => void load());
  }

  const active = () =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
</script>

{#if step === "code"}
  <div class="step" in:stepIn>
    <BackupCodeScreen code={backupCode} step={compte.backup.step} onkept={kept} />
  </div>
{:else if row.kind === "loading"}
  <div class="case" data-invitation="loading">
    <Notice
      kind="invitation-loading"
      heading={row.heading}
      body={slow ? compte.invitation.slow : undefined}
      secondary={slow ? { label: compte.invitation.home, run: () => run("home") } : undefined}
      live
    />
  </div>
{:else if row.kind !== "pseudo"}
  {@const primary = row.primary}
  {@const secondary = row.secondary}
  <div class="case" data-invitation={row.kind}>
    <Notice
      kind={`invitation-${row.kind}`}
      heading={row.heading}
      body={row.body ?? undefined}
      primary={primary === null
        ? undefined
        : {
            label:
              primary.action === "accept" && accepting
                ? compte.invitation.addFriend.busy
                : primary.label,
            busy: primary.action === "accept" && accepting,
            run: () => run(primary.action, active()),
          }}
      secondary={secondary === null
        ? undefined
        : { label: secondary.label, run: () => run(secondary.action, active()) }}
    />
  </div>
{:else}
  <main class="page" data-invitation="ok" aria-busy={busy}>
    <div class="column" in:stepIn>
      <p class="t-label step-line" class:sr-only={compact}>{compte.pseudo.step}</p>
      <h1
        class="t-heading"
        id="pseudo-heading"
        tabindex="-1"
        bind:this={heading}
        aria-label={compact ? compte.pseudo.headingWithStep : undefined}
      >
        {compte.pseudo.heading}
      </h1>
      <p class="t-body context" data-invitation-context>{context}</p>
      <div class="field">
        <PseudoForm labelledby="pseudo-heading" {initial} {busy} {error} onsubmit={create} />
      </div>
      {#if guestTables}
        <p class="t-label muted seats" data-invitation-seats>{compte.pseudo.seats}</p>
      {/if}
      <button
        type="button"
        class="btn btn-text have-account"
        aria-haspopup="dialog"
        bind:this={haveAccount}
        onclick={signIn}
      >
        {compte.pseudo.haveAccount}
      </button>
      <!-- Plan 04-09: the update strip's place at the bottom of the column; the rules of 04-08 never
           offer an update during a sign-up (04-UI-SPEC « Update »), so it stays empty here. -->
      <HomeStrip kinds={["update"]} margin="var(--space-md) 0 0" />
    </div>
  </main>
{/if}

<style>
  /* The « Form » family (the 02 first-name prompt): a column of at most 400, centred; top-aligned on
     the compact landscape phones so the field stays above the on-screen keyboard. */
  .page {
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100dvh;
    padding: calc(var(--space-md) + env(safe-area-inset-top, 0px))
      calc(var(--space-md) + env(safe-area-inset-right, 0px))
      calc(var(--space-md) + env(safe-area-inset-bottom, 0px))
      calc(var(--space-md) + env(safe-area-inset-left, 0px));
  }

  .column {
    display: flex;
    flex-direction: column;
    width: min(400px, 100%);
  }

  h1,
  p {
    margin: 0;
  }

  /* The h1 takes the focus on a step change (tabindex -1) for screen readers; it is not a control,
     so it shows no ring. */
  h1:focus,
  h1:focus-visible {
    outline: none;
  }

  .step-line {
    margin-bottom: var(--space-xs);
    color: var(--creme-attenuee);
    font-weight: 700;
  }

  .context {
    margin-top: var(--space-sm);
    color: var(--creme-attenuee);
  }

  .field {
    margin-top: var(--space-md);
  }

  .muted {
    color: var(--creme-attenuee);
  }

  .seats {
    margin-top: var(--space-sm);
  }

  .have-account {
    align-self: flex-start;
    min-height: var(--touch);
    margin-top: var(--space-md);
  }

  @media (orientation: landscape) and (max-height: 500px) {
    .page {
      align-items: flex-start;
    }
  }
</style>
