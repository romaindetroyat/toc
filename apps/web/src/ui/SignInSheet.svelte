<script lang="ts">
  import { tick } from "svelte";
  import { logIn } from "../account/api.ts";
  import { invitationFromInput, signInLine, signInToast } from "../account/flow.ts";
  import { closeSignIn, sessionEnded, signedIn, signInSheet } from "../account/store.svelte.ts";
  import { browserCeremonies } from "../account/webauthn.ts";
  import { compte } from "../i18n/fr/compte.ts";
  import { pageStorage } from "../net/device.ts";
  import { linkTables } from "../net/tables.ts";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";
  import { showToast } from "./toast.svelte.ts";

  // « Se connecter » (plan 04-09, ACCT-02; 04-UI-SPEC « Sign-in sheet »): the existing Sheet, opened
  // from the home's « Se connecter » tile, « J’ai déjà un compte », a used invitation and the
  // session-ended toast. « Utiliser ma clé d’accès » runs the usernameless login (on a computer the
  // browser offers the phone through its QR code); a failure says why in a polite line under it. On
  // success the sheet closes, this device's guest tables pass to the account (D-05), the toast says
  // « Bonjour {Pseudo} ! » (and that the tables are linked, when there were some), and the focus goes
  // to the home's « Mon compte ». Without WebAuthn the primary and the recovery link are replaced by
  // one line. Mounted once by App.svelte.
  // Plan 04-13 (Romain's iPhone, 2026-10-18): on iOS a tapped link opens Safari, never the installed
  // app, so the hint carries « J’ai une invitation »: the person pastes the link (or the message around
  // it, or the bare code), « Continuer » closes the sheet and opens #/invitation/<code> in the app, where
  // the 04-09 flow takes over. A value flow.invitationFromInput refuses says so under the field. The
  // clipboard is never read by the app: only the person's own paste fills the field.
  const supported = browserCeremonies.supported();

  let busy = $state(false);
  let line = $state<string | null>(null);

  async function use() {
    if (busy) return;
    busy = true;
    line = null;
    const result = await logIn();
    busy = false;
    if (!result.ok) {
      if (result.reason === "signed-out") sessionEnded();
      line = signInLine(result.reason);
      return;
    }
    signedIn(result.me);
    const linked = linkTables(pageStorage(), result.me.id);
    const after = signInSheet.after;
    closeSignIn();
    showToast(signInToast(result.me.pseudo, linked));
    after?.();
    await tick();
    document.querySelector<HTMLElement>('[data-small-tile="compte"]')?.focus();
  }

  function lost() {
    closeSignIn();
  }

  let pasted = $state("");
  let pasteError = $state<string | null>(null);

  function openInvitation(event: SubmitEvent) {
    event.preventDefault();
    const code = invitationFromInput(pasted);
    if (code === null) {
      pasteError = compte.signIn.invite.error;
      return;
    }
    closeSignIn();
    location.hash = `#/invitation/${code}`;
  }
</script>

<Sheet title={compte.signIn.title} onclose={closeSignIn} opener={signInSheet.opener}>
  <div class="content" data-signin-sheet>
    <p class="t-body">{compte.signIn.text}</p>
    {#if supported}
      <div class="group">
        <button
          type="button"
          class="btn btn-primary use"
          aria-busy={busy}
          onclick={() => void use()}
          data-signin-use
        >
          <Icon name="key-round" size={20} />
          {busy ? compte.signIn.busy : compte.signIn.use}
        </button>
        <div aria-live="polite">
          {#if line !== null}
            <p class="t-label" data-signin-line>{line}</p>
          {/if}
        </div>
        <p class="t-label muted">{compte.signIn.note}</p>
      </div>
      <a class="btn btn-text lost" href="#/secours" onclick={lost}>{compte.signIn.lost}</a>
    {:else}
      <p class="t-label" data-signin-line>{signInLine("unsupported")}</p>
    {/if}
    <div class="hint">
      <div>
        <p class="t-label hint-heading">{compte.signIn.hintHeading}</p>
        <p class="t-label muted">{compte.signIn.hintBody}</p>
      </div>
      <form class="paste" onsubmit={openInvitation} novalidate data-invite-paste>
        <label class="t-label hint-heading" for="invite-paste-field">{compte.signIn.invite.label}</label>
        <div class="row">
          <input
            id="invite-paste-field"
            type="text"
            inputmode="url"
            bind:value={pasted}
            oninput={() => (pasteError = null)}
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="go"
            aria-invalid={pasteError !== null}
            aria-describedby={pasteError !== null ? "invite-paste-error" : undefined}
          />
          <button type="submit" class="btn btn-secondary submit">{compte.signIn.invite.submit}</button>
        </div>
        <div aria-live="polite">
          {#if pasteError !== null}
            <p class="t-label error" id="invite-paste-error">
              <Icon name="x" size={16} />
              <span data-invite-paste-error>{pasteError}</span>
            </p>
          {/if}
        </div>
        <p class="t-label muted">{compte.signIn.invite.iphone}</p>
      </form>
    </div>
  </div>
</Sheet>

<style>
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  p {
    margin: 0;
  }

  .use {
    width: 100%;
  }

  .use[aria-busy="true"] {
    cursor: progress;
  }

  /* The primary, its result line and the computer's note, 4 apart. */
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .muted {
    color: var(--creme-attenuee);
  }

  .lost {
    align-self: flex-start;
    min-height: var(--touch);
  }

  /* The hint, after a 1 px rule; « J’ai une invitation » 8 under its text. */
  .hint {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding-top: var(--space-md);
    border-top: 1px solid var(--brun-aide-memoire);
  }

  /* Plan 04-13: the label, [field, flex][Continuer] 8 apart, the error, the iPhone line, 4 apart: the
     field of FriendCodeSheet, with the same tokens. */
  .paste {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .row {
    display: flex;
    gap: var(--space-sm);
  }

  input {
    box-sizing: border-box;
    flex: 1 1 auto;
    min-width: 0;
    height: var(--button-height);
    padding: 0 12px;
    border: 2px solid var(--creme-attenuee);
    border-radius: var(--radius-button);
    background: var(--creme);
    color: var(--noyer);
    font: inherit;
    font-size: var(--body-size);
  }

  input:focus-visible {
    outline: 3px solid var(--ambre);
    outline-offset: 2px;
  }

  .submit {
    flex: none;
  }

  .error {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .error :global(svg) {
    flex: none;
  }

  .hint-heading {
    font-weight: 700;
  }
</style>
