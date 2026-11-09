<script lang="ts">
  import { normalizePseudo } from "@toc/protocol";
  import { compte } from "../i18n/fr/compte.ts";
  import Icon from "./Icon.svelte";

  // The pseudo step's form (04-UI-SPEC « Step 1: pseudo and passkey », D-04): the field (16 px so iOS
  // never zooms, at most 20 characters), « Créer mon compte » (208 wide so its busy label does not
  // move it), the helper or the error line under them, and the explanation of the passkey. The shared
  // rules (normalizePseudo) run here first: a pseudo they refuse never leaves the page. The caller
  // makes the account and gives back the error to show, if any.
  type Props = {
    /** The h1 that names the field. */
    labelledby: string;
    /** The field's first value (this device's first name, when it is a valid pseudo). */
    initial?: string;
    /** The account is being made: the busy label, aria-busy, the device line. */
    busy?: boolean;
    /** The error the caller got back, shown instead of the helper. */
    error?: string | null;
    onsubmit: (pseudo: string) => void;
  };

  let { labelledby, initial = "", busy = false, error = null, onsubmit }: Props = $props();

  // svelte-ignore state_referenced_locally
  let value = $state(initial);
  let local = $state<string | null>(null);
  let field = $state<HTMLInputElement | null>(null);

  // A phone opens its keyboard when the player taps the field: autofocus with a fine pointer only.
  $effect(() => {
    if (window.matchMedia("(pointer: fine)").matches) field?.focus();
  });

  /** The error line: the shared rules' refusal, else the caller's. */
  const problem = $derived(local ?? error);

  // The caller's error puts the focus back on the field.
  $effect(() => {
    if (error !== null) field?.focus();
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    const checked = normalizePseudo(value);
    if (!checked.ok) {
      local = compte.pseudo.errors[checked.reason];
      field?.focus();
      return;
    }
    local = null;
    value = checked.pseudo;
    onsubmit(checked.pseudo);
  }

  function edited() {
    local = null;
  }
</script>

<form class="form" onsubmit={submit} novalidate data-pseudo-form>
  <div class="row">
    <input
      bind:this={field}
      bind:value
      oninput={edited}
      type="text"
      maxlength="20"
      autocomplete="username"
      autocapitalize="words"
      enterkeyhint="go"
      spellcheck="false"
      aria-labelledby={labelledby}
      aria-describedby="pseudo-note"
      aria-invalid={problem !== null}
    />
    <button type="submit" class="btn btn-primary submit" aria-busy={busy} data-pseudo-submit>
      {busy ? compte.pseudo.busy : compte.pseudo.submit}
    </button>
  </div>
  <div aria-live="polite">
    {#if problem !== null && !busy}
      <p class="t-label note error" id="pseudo-note" data-pseudo-error>
        <Icon name="x" size={16} />
        {problem}
      </p>
    {:else}
      <p class="t-label note" id="pseudo-note">
        {busy ? compte.pseudo.device : compte.pseudo.helper}
      </p>
    {/if}
  </div>
  <p class="t-label explanation">{compte.pseudo.explanation}</p>
</form>

<style>
  .form {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  p {
    margin: 0;
  }

  .row {
    display: flex;
    gap: var(--space-sm);
  }

  input {
    flex: 1;
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

  /* As wide as « Création du compte… », its longer label (04-UI-SPEC exception 208). */
  .submit {
    flex: none;
    width: 208px;
    padding: 0 var(--space-md);
  }

  .submit[aria-busy="true"] {
    cursor: progress;
  }

  .note {
    margin-top: var(--space-sm);
    color: var(--creme-attenuee);
  }

  .note.error {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--creme);
  }

  .note.error :global(svg) {
    flex: none;
  }

  .explanation {
    margin-top: var(--space-md);
    color: var(--creme-attenuee);
  }

  /* The computer and portrait: the field full width, the button under it, full width too. */
  @media (orientation: portrait), (min-width: 960px) and (min-height: 600px) {
    .row {
      flex-direction: column;
    }

    .submit {
      width: 100%;
    }
  }
</style>
