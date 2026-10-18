<script lang="ts">
  import { tick } from "svelte";
  import { logIn } from "../account/api.ts";
  import { signInLine, signInToast } from "../account/flow.ts";
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
      <p class="t-label hint-heading">{compte.signIn.hintHeading}</p>
      <p class="t-label muted">{compte.signIn.hintBody}</p>
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

  /* The hint, after a 1 px rule. */
  .hint {
    padding-top: var(--space-md);
    border-top: 1px solid var(--brun-aide-memoire);
  }

  .hint-heading {
    font-weight: 700;
  }
</style>
