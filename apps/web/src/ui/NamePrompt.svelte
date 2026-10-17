<script lang="ts">
  import { normalizeName } from "@toc/protocol";
  import { unlock } from "../audio/engine.ts";
  import { accueil } from "../i18n/fr/accueil.ts";
  import Icon from "./Icon.svelte";

  type Props = {
    /** The context line under the heading (who invites, or what the name is for). */
    context: string;
    /** The normalized first name; the prompt is done. */
    onsubmit: (name: string) => void;
    /** « Retour »: back to the home. */
    onback: () => void;
  };

  let { context, onsubmit, onback }: Props = $props();

  let value = $state("");
  let empty = $state(false);
  let field = $state<HTMLInputElement | null>(null);

  // A phone opens its keyboard when the player taps the field: autofocus with a fine pointer only.
  $effect(() => {
    if (window.matchMedia("(pointer: fine)").matches) field?.focus();
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    unlock();
    const name = normalizeName(value);
    if (name === null) {
      empty = true;
      field?.focus();
      return;
    }
    empty = false;
    onsubmit(name);
  }
</script>

<!-- 02-UI-SPEC « First-name prompt » (D-01): once per device, before joining a table. The name is
     validated like the server does (NFC, no control characters, 1 to 20 characters). -->
<main class="prompt" data-name-prompt>
  <form class="column" onsubmit={submit} novalidate>
    <h1 class="t-heading" id="name-heading">{accueil.name.heading}</h1>
    <p class="t-body context">{context}</p>
    <div class="row">
      <input
        bind:this={field}
        bind:value
        type="text"
        maxlength="20"
        autocomplete="given-name"
        autocapitalize="words"
        enterkeyhint="go"
        spellcheck="false"
        aria-labelledby="name-heading"
        aria-describedby="name-note"
        aria-invalid={empty}
      />
      <button type="submit" class="btn btn-primary">{accueil.name.submit}</button>
    </div>
    {#if empty}
      <p class="t-label note error" id="name-note" role="alert" data-name-empty>
        <Icon name="x" size={16} />
        {accueil.name.empty}
      </p>
    {:else}
      <p class="t-label note" id="name-note">{accueil.name.helper}</p>
    {/if}
    <button type="button" class="btn btn-text back" onclick={onback}>{accueil.name.back}</button>
  </form>
</main>

<style>
  .prompt {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100dvh;
    padding: calc(var(--space-md) + env(safe-area-inset-top)) calc(var(--space-md) + env(safe-area-inset-right))
      calc(var(--space-md) + env(safe-area-inset-bottom)) calc(var(--space-md) + env(safe-area-inset-left));
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

  .context {
    margin-top: var(--space-sm);
    color: var(--creme-attenuee);
  }

  .row {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-md);
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

  .back {
    align-self: flex-start;
    margin-top: var(--space-md);
  }

  /* Compact landscape phones: top-aligned, so the field stays above the on-screen keyboard. */
  @media (orientation: landscape) and (max-height: 500px) {
    .prompt {
      align-items: flex-start;
    }
  }

  /* The computer and portrait: the field full width, « Continuer » under it. */
  @media (orientation: portrait), (min-width: 960px) and (min-height: 600px) {
    .row {
      flex-direction: column;
    }
  }
</style>
