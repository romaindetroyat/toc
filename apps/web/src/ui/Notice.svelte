<script lang="ts">
  import type { Snippet } from "svelte";

  // One connecting or error screen of the online table (02-UI-SPEC « Connecting, errors »): a heading,
  // a body, 0 to 2 buttons (the primary first in the DOM, as in the copy table), and whatever the case
  // adds under them (the slow-connection line). Works upright and sideways. data-notice names the case.
  /** busy (plan 04-09): the action runs; its label says so and the button is aria-busy. */
  type Action = { label: string; run: () => void; busy?: boolean };

  type Props = {
    /** The case: introuvable, commencee, ailleurs, version, horsligne, connexion… */
    kind: string;
    heading: string;
    body?: string;
    primary?: Action;
    secondary?: Action;
    /** The heading is read out when it appears (connecting). */
    live?: boolean;
    children?: Snippet;
  };

  let { kind, heading, body, primary, secondary, live = false, children }: Props = $props();
</script>

<main class="notice" data-notice={kind}>
  <h1 class="t-heading" aria-live={live ? "polite" : undefined}>{heading}</h1>
  {#if body}<p class="t-body">{body}</p>{/if}
  {#if children}{@render children()}{/if}
  {#if primary || secondary}
    <div class="buttons">
      {#if primary}
        <button
          type="button"
          class="btn btn-primary"
          aria-busy={primary.busy === true ? true : undefined}
          onclick={primary.run}
        >
          {primary.label}
        </button>
      {/if}
      {#if secondary}
        <button type="button" class="btn btn-secondary" onclick={secondary.run}>
          {secondary.label}
        </button>
      {/if}
    </div>
  {/if}
</main>

<style>
  .notice {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    min-height: 100dvh;
    padding: calc(var(--space-lg) + env(safe-area-inset-top, 0px))
      calc(var(--space-lg) + env(safe-area-inset-right, 0px))
      calc(var(--space-lg) + env(safe-area-inset-bottom, 0px))
      calc(var(--space-lg) + env(safe-area-inset-left, 0px));
    text-align: center;
  }

  h1,
  p {
    margin: 0;
  }

  p {
    max-width: 480px;
    color: var(--creme-attenuee);
  }

  .notice :global(p) {
    max-width: 480px;
  }

  .buttons {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
    width: min(320px, 100%);
  }
</style>
