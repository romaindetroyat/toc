<script lang="ts">
  import { game } from "../i18n/fr/game.ts";
  import Sheet from "./Sheet.svelte";

  // A confirmation (UI-SPEC « destructive confirmation », 02-UI-SPEC « Confirmations »): the safe
  // answer is the primary button and has the focus; Échap and the safe answer keep things as they are,
  // a tap outside the dialog does not close it, and only the other answer goes ahead. Without copy it
  // is « Abandonner la partie ? » of the local game (the other answer destructive, in brique).
  type Props = {
    /** The other answer was chosen: the caller goes ahead. */
    onconfirm: () => void;
    /** The safe answer, Échap. */
    oncancel: () => void;
    /** Element that gets the focus back on close. */
    opener?: HTMLElement | null;
    title?: string;
    body?: string;
    /** The safe answer (primary, focused). */
    safeLabel?: string;
    /** The answer that goes ahead (secondary; destructive for the abandon). */
    otherLabel?: string;
    destructive?: boolean;
  };

  let {
    onconfirm,
    oncancel,
    opener = null,
    title = game.abandon.title,
    body = game.abandon.body,
    safeLabel = game.abandon.keepPlaying,
    otherLabel = game.abandon.confirm,
    destructive,
  }: Props = $props();

  // The abandon (no copy given) is destructive; the online confirmations are not (nothing is lost).
  const isDestructive = $derived(destructive ?? otherLabel === game.abandon.confirm);
</script>

<Sheet
  {title}
  onclose={oncancel}
  closeOnBackdrop={false}
  closeLabel={safeLabel}
  closeIsPrimary
  {opener}
>
  <div class="confirm" data-confirm-dialog>
    <p class="body">{body}</p>
    {#if isDestructive}
      <button type="button" class="btn btn-destructive" data-abandon-confirm onclick={onconfirm}>
        {otherLabel}
      </button>
    {:else}
      <button type="button" class="btn btn-secondary" data-confirm-other onclick={onconfirm}>
        {otherLabel}
      </button>
    {/if}
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
