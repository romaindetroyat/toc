<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    type InvitationView,
    invitationState,
    type SignUpFailure,
    signUp,
  } from "../account/api.ts";
  import { setAccount } from "../account/store.svelte.ts";
  import { browserCeremonies } from "../account/webauthn.ts";
  import { compte } from "../i18n/fr/compte.ts";
  import { loadDevice, pageStorage } from "../net/device.ts";
  import { normalizePseudo } from "@toc/protocol";
  import BackupCodeScreen from "../ui/BackupCodeScreen.svelte";
  import Notice from "../ui/Notice.svelte";
  import PseudoForm from "../ui/PseudoForm.svelte";
  import { screen } from "../ui/screen.svelte.ts";
  import { showToast } from "../ui/toast.svelte.ts";

  // #/invitation/<code> (plan 04-01, 04-UI-SPEC « Invitation », ACCT-01, D-02, D-03, D-06, D-11): the
  // state of the link first (« Ouverture de l’invitation… »), then either a notice (unknown, used,
  // expired, offline, a browser without passkeys) or the two steps of a sign-up: the pseudo and the
  // passkey, then the backup code shown once. After « Oui, je l’ai gardé », the home, signed in, with
  // the welcome toast. data-invitation names the case. Still to come: « J’ai déjà un compte » and
  // « Se connecter » (04-02), the signed-in cases (04-05), the leave guard of the code (04-09).
  type Props = { code: string };

  let { code }: Props = $props();

  type View = InvitationView | { state: "loading" } | { state: "unsupported" };

  let view = $state<View>({ state: "loading" });
  let slow = $state(false);
  let step = $state<"pseudo" | "code">("pseudo");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let backupCode = $state("");
  let pseudo = $state("");
  let heading = $state<HTMLHeadingElement | null>(null);

  const SLOW_MS = 10_000;

  // This device's first name, when it is a valid pseudo (UI-SPEC « Field »).
  const device = loadDevice(pageStorage());
  const named = device.name === null ? null : normalizePseudo(device.name);
  const initial = named?.ok ? named.pseudo : "";

  const inviter = $derived(
    "inviter" in view && view.inviter !== null ? view.inviter : null,
  );
  const inviterName = $derived(inviter ?? compte.invitation.someone);
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
    const timer = setTimeout(() => {
      slow = true;
    }, SLOW_MS);
    const state = await invitationState(code);
    clearTimeout(timer);
    view = state.state === "ok" && !browserCeremonies.supported() ? { state: "unsupported" } : state;
    // The step's h1 takes the focus, except with a fine pointer, where the field's autofocus keeps it.
    if (view.state === "ok" && !window.matchMedia("(pointer: fine)").matches) {
      await tick();
      heading?.focus();
    }
  }

  onMount(() => {
    void load();
  });

  const errorFor: Partial<Record<SignUpFailure, string>> = {
    pseudo: compte.pseudo.errors.chars,
    taken: compte.pseudo.errors.taken,
    "taken-meanwhile": compte.pseudo.errors.takenMeanwhile,
    cancelled: compte.pseudo.errors.cancelled,
    "wrong-address": compte.pseudo.errors.wrongAddress,
    offline: compte.pseudo.errors.offline,
    server: compte.pseudo.errors.server,
  };

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
    if (result.reason === "used" || result.reason === "expired" || result.reason === "unknown") {
      view =
        result.reason === "unknown"
          ? { state: "unknown" }
          : { state: result.reason, inviter };
      return;
    }
    if (result.reason === "unsupported") {
      view = { state: "unsupported" };
      return;
    }
    error = errorFor[result.reason] ?? compte.pseudo.errors.server;
  }

  function kept() {
    showToast(
      bootstrap || inviter === null
        ? compte.welcome.alone(pseudo)
        : compte.welcome.withFriend(pseudo, inviter),
    );
    location.hash = "#/";
  }

  function home() {
    location.hash = "#/";
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast(compte.invitation.unsupported.copied);
    } catch {
      showToast(compte.invitation.unsupported.copyFailed);
    }
  }
</script>

{#if step === "code"}
  <BackupCodeScreen code={backupCode} step={compte.backup.step} onkept={kept} />
{:else if view.state === "loading"}
  <div class="case" data-invitation="loading">
    <Notice
      kind="invitation-loading"
      heading={compte.invitation.loading}
      body={slow ? compte.invitation.slow : undefined}
      secondary={slow ? { label: compte.invitation.home, run: home } : undefined}
      live
    />
  </div>
{:else if view.state === "unknown"}
  <div class="case" data-invitation="unknown">
    <Notice
      kind="invitation-unknown"
      heading={compte.invitation.unknown.heading}
      body={compte.invitation.unknown.body}
      primary={{ label: compte.invitation.home, run: home }}
    />
  </div>
{:else if view.state === "used"}
  <div class="case" data-invitation="used">
    <Notice
      kind="invitation-used"
      heading={compte.invitation.used.heading}
      body={compte.invitation.used.body(inviterName)}
      primary={{ label: compte.invitation.home, run: home }}
    />
  </div>
{:else if view.state === "expired"}
  <div class="case" data-invitation="expired">
    <Notice
      kind="invitation-expired"
      heading={compte.invitation.expired.heading}
      body={compte.invitation.expired.body(inviterName)}
      primary={{ label: compte.invitation.home, run: home }}
    />
  </div>
{:else if view.state === "offline"}
  <div class="case" data-invitation="offline">
    <Notice
      kind="invitation-offline"
      heading={compte.invitation.offline.heading}
      body={compte.invitation.offline.body}
      primary={{ label: compte.invitation.offline.retry, run: () => void load() }}
      secondary={{ label: compte.invitation.home, run: home }}
    />
  </div>
{:else if view.state === "unsupported"}
  <div class="case" data-invitation="unsupported">
    <Notice
      kind="invitation-unsupported"
      heading={compte.invitation.unsupported.heading}
      body={compte.invitation.unsupported.body}
      primary={{ label: compte.invitation.unsupported.copy, run: () => void copyLink() }}
      secondary={{ label: compte.invitation.home, run: home }}
    />
  </div>
{:else}
  <main class="page" data-invitation="ok">
    <div class="column">
      <p class="t-label step" class:sr-only={compact}>{compte.pseudo.step}</p>
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

  .step {
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

  @media (orientation: landscape) and (max-height: 500px) {
    .page {
      align-items: flex-start;
    }
  }
</style>
