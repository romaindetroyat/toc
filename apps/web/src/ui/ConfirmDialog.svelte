<script lang="ts">
  import { game } from "../i18n/fr/game.ts";
  import Sheet from "./Sheet.svelte";

  // « Abandonner la partie ? » (UI-SPEC « destructive confirmation »): the safe answer, « Continuer à
  // jouer », is the primary button and has the focus; Échap and « Continuer à jouer » keep the game, a
  // tap outside the dialog does not close it, and only « Abandonner la partie » gives the game up.
  type Props = {
    /** The game is given up: the caller disposes it and leaves the screen. */
    onconfirm: () => void;
    /** The player keeps playing. */
    oncancel: () => void;
    /** Element that gets the focus back on close. */
    opener?: HTMLElement | null;
  };

  let { onconfirm, oncancel, opener = null }: Props = $props();
</script>

<Sheet
  title={game.abandon.title}
  onclose={oncancel}
  closeOnBackdrop={false}
  closeLabel={game.abandon.keepPlaying}
  closeIsPrimary
  {opener}
>
  <div class="confirm" data-confirm-dialog>
    <p class="body">{game.abandon.body}</p>
    <button type="button" class="btn btn-destructive" data-abandon-confirm onclick={onconfirm}>
      {game.abandon.confirm}
    </button>
  </div>
</Sheet>

<style>
  .confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .body {
    margin: 0;
  }
</style>
