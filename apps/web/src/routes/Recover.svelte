<script lang="ts">
  import type { CreationOptions } from "@toc/protocol";
  import { onMount, tick } from "svelte";
  import { recover, recoverVerify } from "../account/api.ts";
  import { formatCodeInput, recoverError, recoverKeyError } from "../account/flow.ts";
  import { signedIn } from "../account/store.svelte.ts";
  import { compte } from "../i18n/fr/compte.ts";
  import { pageStorage } from "../net/device.ts";
  import { linkTables } from "../net/tables.ts";
  import BackupCodeScreen from "../ui/BackupCodeScreen.svelte";
  import HomeStrip from "../ui/HomeStrip.svelte";
  import Icon from "../ui/Icon.svelte";
  import OfflinePage from "../ui/OfflinePage.svelte";
  import { screen } from "../ui/screen.svelte.ts";
  import { stepIn } from "../ui/stepIn.ts";
  import { showToast } from "../ui/toast.svelte.ts";

  // « Retrouver mon compte » at #/secours (plan 04-09, D-02, SC1; 04-UI-SPEC « Recovery »), in three
  // steps. 1: the pseudo and the backup code (the field adds the dashes as the player types and reads
  // lower case, spaces, O for 0, I and L for 1); a wrong pseudo and a wrong code get the same line
  // (T-04-03), five wrong codes lock the account (« Trop d’essais. Réessaie dans 15 minutes. »).
  // 2: « Code accepté », the new passkey on this device (cancelled: try again; the 5-minute delay
  // over: step 1 again, the code is still valid). 3: the new backup code with the recovery line, then
  // #/compte with « Compte retrouvé. … ». Every other session of the account has ended (the server).
  // The « Form » layout, column 480: the two fields side by side on a phone held sideways (the context
  // line under the primary there), stacked elsewhere. The focus goes to each step's h1.
  let step = $state<1 | 2 | 3>(1);
  let pseudo = $state("");
  let code = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  /** Which fields the error is about (aria-invalid). */
  let invalid = $state<{ pseudo: boolean; code: boolean }>({ pseudo: false, code: false });
  let options = $state<CreationOptions | null>(null);
  let backupCode = $state("");
  let heading = $state<HTMLHeadingElement | null>(null);
  let pseudoField = $state<HTMLInputElement | null>(null);

  const compact = $derived(screen.chrome === "compact");

  // Plan 04-10: without a network, step 1 is the offline page of the online features (04-UI-SPEC
  // « Offline »); it goes by itself when the network is back.
  let online = $state(typeof navigator === "undefined" || navigator.onLine !== false);

  function retry() {
    online = typeof navigator === "undefined" || navigator.onLine !== false;
    if (online) void focusHeading();
  }

  async function focusHeading() {
    await tick();
    heading?.focus();
  }

  // The page opens with the focus on its h1 (04-UI-SPEC « Keyboard and accessibility »).
  onMount(() => {
    void focusHeading();
  });

  function typed(event: Event & { currentTarget: HTMLInputElement }) {
    code = formatCodeInput(event.currentTarget.value);
    event.currentTarget.value = code;
  }

  /** With the keyboard up, the focused field stays in sight. */
  function inSight(event: FocusEvent & { currentTarget: HTMLInputElement }) {
    event.currentTarget.scrollIntoView({ block: "nearest" });
  }

  async function verify(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    const name = pseudo.trim();
    if (name === "" || code === "") {
      error = recoverError({ reason: "empty" });
      invalid = { pseudo: name === "", code: code === "" };
      (name === "" ? pseudoField : null)?.focus();
      return;
    }
    busy = true;
    error = null;
    const result = await recover(name, code);
    busy = false;
    if (result.ok) {
      options = result.optionsJSON;
      invalid = { pseudo: false, code: false };
      step = 2;
      void focusHeading();
      return;
    }
    if (result.reason === "locked") {
      error = recoverError({ reason: "locked", until: result.until, now: Date.now() });
      invalid = { pseudo: false, code: false };
      return;
    }
    error = recoverError({ reason: result.reason });
    invalid =
      result.reason === "wrong"
        ? { pseudo: true, code: true }
        : { pseudo: false, code: result.reason === "format" };
  }

  async function createKey() {
    if (busy || options === null) return;
    busy = true;
    error = null;
    const result = await recoverVerify(options);
    busy = false;
    if (result.ok) {
      signedIn(result.me);
      // This device's guest tables pass to the account, as at a sign-in (D-05).
      linkTables(pageStorage(), result.me.id);
      backupCode = result.backupCode;
      step = 3;
      return;
    }
    const shown = recoverKeyError(result.reason);
    error = shown.line;
    if (shown.back) {
      options = null;
      step = 1;
      void focusHeading();
    }
  }

  function kept() {
    showToast(compte.recover.done);
    location.hash = "#/compte";
  }
</script>

<svelte:window onoffline={() => (online = false)} />

{#if step === 1 && !online}
  <OfflinePage onretry={retry} />
{:else if step === 3}
  <div in:stepIn>
    <BackupCodeScreen code={backupCode} form="recovery" onkept={kept} />
  </div>
{:else}
  <main class="page" aria-busy={busy}>
    {#key step}
      <div class="column" data-recover-step={step} in:stepIn>
        {#if step === 1}
          <h1 class="t-heading" tabindex="-1" bind:this={heading}>{compte.recover.heading}</h1>
          {#if !compact}
            <p class="t-body muted context">{compte.recover.context}</p>
          {/if}
          <form class="form" onsubmit={verify} novalidate>
            <div class="fields" class:side={compact}>
              <div class="field pseudo">
                <label class="t-label label" for="recover-pseudo">{compte.recover.pseudoLabel}</label>
                <input
                  id="recover-pseudo"
                  type="text"
                  bind:this={pseudoField}
                  bind:value={pseudo}
                  maxlength="20"
                  autocomplete="username"
                  autocapitalize="words"
                  spellcheck="false"
                  enterkeyhint="next"
                  aria-invalid={invalid.pseudo}
                  aria-describedby={error !== null ? "recover-error" : undefined}
                  onfocus={inSight}
                />
              </div>
              <div class="field code">
                <label class="t-label label" for="recover-code">{compte.recover.codeLabel}</label>
                <input
                  id="recover-code"
                  class="tabular"
                  type="text"
                  value={code}
                  oninput={typed}
                  maxlength="24"
                  autocomplete="off"
                  autocapitalize="characters"
                  spellcheck="false"
                  enterkeyhint="go"
                  aria-invalid={invalid.code}
                  aria-describedby={error !== null ? "recover-error" : undefined}
                  onfocus={inSight}
                />
              </div>
            </div>
            <div aria-live="polite">
              {#if error !== null}
                <p class="t-label error" id="recover-error" data-recover-error>
                  <Icon name="x" size={16} />
                  {error}
                </p>
              {/if}
            </div>
            <button type="submit" class="btn btn-primary submit" aria-busy={busy}>
              {busy ? compte.recover.verifying : compte.recover.verify}
            </button>
          </form>
          {#if compact}
            <p class="t-label muted context-under">{compte.recover.context}</p>
          {/if}
          <a class="btn btn-text home" href="#/">{compte.recover.home}</a>
        {:else}
          <h1 class="t-heading" tabindex="-1" bind:this={heading}>{compte.recover.key.heading}</h1>
          <p class="t-body context">{compte.recover.key.body(pseudo.trim())}</p>
          <button
            type="button"
            class="btn btn-primary submit"
            aria-busy={busy}
            onclick={() => void createKey()}
          >
            {busy ? compte.recover.key.busy : compte.recover.key.create}
          </button>
          <div aria-live="polite">
            {#if error !== null}
              <p class="t-label error" data-recover-error>
                <Icon name="x" size={16} />
                {error}
              </p>
            {/if}
          </div>
        {/if}
        <!-- Plan 04-09: the update strip's place at the bottom of the column; the rules of 04-08 never
             offer an update during a recovery (04-UI-SPEC « Update »), so it stays empty here. -->
        <HomeStrip kinds={["update"]} margin="var(--space-md) 0 0" />
      </div>
    {/key}
  </main>
{/if}

<style>
  /* The « Form » family, column 480: centred on the computer and upright, top-aligned on the compact
     landscape phones so the fields stay above the on-screen keyboard. */
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
    width: min(480px, 100%);
  }

  h1,
  p {
    margin: 0;
  }

  h1:focus,
  h1:focus-visible {
    outline: none;
  }

  .muted {
    color: var(--creme-attenuee);
  }

  .context {
    margin-top: var(--space-sm);
  }

  .form {
    display: flex;
    flex-direction: column;
    margin-top: var(--space-md);
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  /* A phone held sideways: [pseudo 180][code, flex], 8 apart. */
  .fields.side {
    flex-direction: row;
  }

  .fields.side .pseudo {
    flex: none;
    width: 180px;
  }

  .fields.side .code {
    flex: 1 1 0;
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .label {
    font-weight: 700;
  }

  input {
    box-sizing: border-box;
    width: 100%;
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

  .error {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-top: var(--space-sm);
  }

  .error :global(svg) {
    flex: none;
  }

  .submit {
    width: 100%;
    margin-top: var(--space-md);
  }

  .submit[aria-busy="true"] {
    cursor: progress;
  }

  .context-under {
    margin-top: var(--space-sm);
  }

  .home {
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
