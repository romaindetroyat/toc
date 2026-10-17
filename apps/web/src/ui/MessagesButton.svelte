<script lang="ts">
  import { clavier } from "../i18n/fr/clavier.ts";
  import { messages } from "../i18n/fr/messages.ts";
  import Icon from "./Icon.svelte";
  import KeyHint from "./KeyHint.svelte";

  // « Messages » (02-UI-SPEC « Quick messages », plan 02-08): a 44 x 44 `message-circle` button that
  // opens « Messages rapides ». In the waiting room's action row after « Réglages », at the top of the
  // phone's right strip in the slot « Avance rapide » has offline, and on the computer's fourth bar row
  // next to « À la table ». In the game the key « M » does the same (`keys`: aria-keyshortcuts and the
  // KeyHint, shown on fine pointers only).
  type Props = {
    /** Opens the sheet; the button gets the focus back when it closes. */
    onopen: (opener: HTMLButtonElement) => void;
    /** In the game: « M » opens it too. */
    keys?: boolean;
  };

  let { onopen, keys = false }: Props = $props();

  let el = $state<HTMLButtonElement | null>(null);
</script>

<button
  type="button"
  class="messages-button"
  aria-label={messages.button}
  title={messages.button}
  aria-haspopup="dialog"
  aria-keyshortcuts={keys ? clavier.keys.messages : undefined}
  data-messages-button
  bind:this={el}
  onclick={() => {
    if (el !== null) onopen(el);
  }}
>
  <Icon name="message-circle" />
  {#if keys}<KeyHint label={clavier.keys.messages} />{/if}
</button>

<style>
  .messages-button {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 0;
    border-radius: var(--radius-button);
    background: transparent;
    color: var(--creme);
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
</style>
