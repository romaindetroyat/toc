<script lang="ts">
  import { clavier } from "../i18n/fr/clavier.ts";
  import { regles } from "../i18n/fr/regles.ts";
  import Icon from "./Icon.svelte";
  import KeyHint from "./KeyHint.svelte";

  // The book button (plan 05-04, 05-UI-SPEC « Where it opens »): 44 x 44, `book-open`, named and
  // titled « Règles du jeu ». In a game it stands under the gear in the phone's right strip and first
  // in the computer's info row; « R » does the same (aria-keyshortcuts, and the KeyHint « R » on fine
  // pointers only). It opens « Règles du TOC » and gets the focus back when the sheet closes.
  type Props = {
    /** Opens the sheet; the button is its opener. */
    onopen: (opener: HTMLButtonElement) => void;
  };

  let { onopen }: Props = $props();

  let el = $state<HTMLButtonElement | null>(null);
</script>

<button
  type="button"
  class="rules-button"
  aria-label={regles.button}
  title={regles.button}
  aria-haspopup="dialog"
  aria-keyshortcuts={clavier.keys.rules}
  data-rules-button
  bind:this={el}
  onclick={() => {
    if (el !== null) onopen(el);
  }}
>
  <Icon name="book-open" />
  <KeyHint label={clavier.keys.rules} />
</button>

<style>
  .rules-button {
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
