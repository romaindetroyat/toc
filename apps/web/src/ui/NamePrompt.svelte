<script lang="ts">
  import { normalizeName } from "@toc/protocol";
  import { unlock } from "../audio/engine.ts";
  import { accueil } from "../i18n/fr/accueil.ts";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";

  // 02-UI-SPEC « First-name prompt » (D-01): once per device, before joining or creating a table, and
  // as the sheet « Changer de prénom » from the home. The name is validated like the server does (NFC,
  // no control characters, 1 to 20 characters); nothing else is refused.
  type Props = {
    /** The context line under the heading (who invites, or what the name is for); screen form only. */
    context?: string;
    /** The normalized first name; the prompt is done (or, while creating, waits for `busy`). */
    onsubmit: (name: string) => void;
    /** « Retour »: back to the home (screen form). */
    onback?: () => void;
    /** The sheet form « Changer de prénom » (prefilled, « Enregistrer », the sheet's « Fermer »). */
    sheet?: { onclose: () => void; opener?: HTMLElement | null };
    /** The field's first value (the stored name, in the sheet). */
    initial?: string;
    /** The table is being created: « Création de la table… », aria-busy. */
    busy?: boolean;
    /** The creation failed: the line under the field says why. */
    error?: "server" | "offline" | null;
  };

  let {
    context = "",
    onsubmit,
    onback,
    sheet,
    initial = "",
    busy = false,
    error = null,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  let value = $state(initial);
  let empty = $state(false);
  let field = $state<HTMLInputElement | null>(null);

  // A phone opens its keyboard when the player taps the field: autofocus with a fine pointer only.
  $effect(() => {
    if (window.matchMedia("(pointer: fine)").matches) field?.focus();
  });

  /** The line under the field: the empty error, a creation error, or the helper. */
  const problem = $derived(
    empty
      ? accueil.name.empty
      : error === "server"
        ? accueil.name.serverError
        : error === "offline"
          ? accueil.name.offlineError
          : null,
  );

  function submit(event: SubmitEvent) {
    event.preventDefault();
    unlock();
    if (busy) return;
    const name = normalizeName(value);
    if (name === null) {
      empty = true;
      field?.focus();
      return;
    }
    empty = false;
    onsubmit(name);
  }

  function back() {
    unlock();
    onback?.();
  }
</script>

{#snippet form(mode: "screen" | "sheet")}
  <form class="column" class:in-sheet={mode === "sheet"} onsubmit={submit} novalidate>
    {#if mode === "screen"}
      <h1 class="t-heading" id="name-heading">{accueil.name.heading}</h1>
      {#if context}<p class="t-body context">{context}</p>{/if}
    {/if}
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
        aria-labelledby={mode === "screen" ? "name-heading" : undefined}
        aria-label={mode === "sheet" ? accueil.name.heading : undefined}
        aria-describedby="name-note"
        aria-invalid={problem !== null}
      />
      <button type="submit" class="btn btn-primary submit" aria-busy={busy} data-name-submit>
        {mode === "sheet" ? accueil.name.save : busy ? accueil.name.busy : accueil.name.submit}
      </button>
    </div>
    {#if problem !== null}
      <p class="t-label note error" id="name-note" role="alert" data-name-error>
        <Icon name="x" size={16} />
        {problem}
      </p>
    {:else}
      <p class="t-label note" id="name-note">{accueil.name.helper}</p>
    {/if}
    {#if mode === "screen"}
      <button type="button" class="btn btn-text back" onclick={back}>{accueil.name.back}</button>
    {/if}
  </form>
{/snippet}

{#if sheet}
  <Sheet title={accueil.name.changeTitle} onclose={sheet.onclose} opener={sheet.opener ?? null}>
    <div data-name-prompt="sheet">{@render form("sheet")}</div>
  </Sheet>
{:else}
  <main class="prompt" data-name-prompt="screen">
    {@render form("screen")}
  </main>
{/if}

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

  /* Room for the focus ring inside the sheet's scrolling body. */
  .column.in-sheet {
    width: 100%;
    padding: 5px;
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

  .in-sheet .row {
    margin-top: 0;
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

  /* Busy keeps its full opacity (only disabled is 40 %). */
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
