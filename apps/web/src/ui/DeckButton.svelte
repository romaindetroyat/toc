<script lang="ts">
  import { clavier } from "../i18n/fr/clavier.ts";
  import { paquet } from "../i18n/fr/paquet.ts";
  import Icon from "./Icon.svelte";
  import KeyHint from "./KeyHint.svelte";

  // The cards-of-the-pack button (quick task 261109-6an): 44 x 44, `gallery-vertical-end`, named and
  // titled « Les cartes du paquet ». In a game it stands right after « Règles du jeu » in the
  // computer's info row (the phone's right strip is full: there the way in is the felt, then « Sur le
  // tapis »); « T » does the same (aria-keyshortcuts, and the KeyHint « T » on fine pointers only).
  // It opens « Les cartes du paquet » and gets the focus back when the sheet closes.
  type Props = {
    /** Opens the sheet; the button is its opener. */
    onopen: (opener: HTMLButtonElement) => void;
  };

  let { onopen }: Props = $props();

  let el = $state<HTMLButtonElement | null>(null);
</script>

<button
  type="button"
  class="deck-button"
  aria-label={paquet.button}
  title={paquet.button}
  aria-haspopup="dialog"
  aria-keyshortcuts={clavier.keys.deck}
  data-deck-button
  bind:this={el}
  onclick={() => {
    if (el !== null) onopen(el);
  }}
>
  <Icon name="gallery-vertical-end" />
  <KeyHint label={clavier.keys.deck} />
</button>

<style>
  .deck-button {
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
