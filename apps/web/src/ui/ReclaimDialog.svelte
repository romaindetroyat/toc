<script lang="ts">
  import type { Color } from "@toc/engine";
  import { unlock } from "../audio/engine.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import { table as copy } from "../i18n/fr/table.ts";
  import Sheet from "./Sheet.svelte";

  // « Rendre sa place à {Nom} ? » (plan 02-07, 02-UI-SPEC « Reclaim of one's own seat », D-12, A7):
  // the chef de table's answer to someone who asks, from another device or another app, for the seat
  // of a player who is offline. The body quotes the first name the asker typed, so the chef de table
  // judges who it is. A Sheet that a tap outside does not close; « Refuser » (the safe answer, and
  // Échap) has the focus; « Rendre sa place » is the primary button.
  type Props = {
    /** The seat asked for and the first name the asker typed. */
    seat: Color;
    typed: string;
    /** The first name of the seat's player now (offline). */
    holder: string;
    onanswer: (accept: boolean) => void;
  };

  let { seat, typed, holder, onanswer }: Props = $props();

  function answer(accept: boolean) {
    unlock();
    onanswer(accept);
  }
</script>

<Sheet
  title={copy.reclaim.dialog.title(holder)}
  onclose={() => answer(false)}
  closeOnBackdrop={false}
  closeLabel={copy.reclaim.dialog.refuse}
  focusClose
>
  <div class="reclaim" data-reclaim-dialog={seat}>
    <p class="body">{copy.reclaim.dialog.body(typed, holder, seats[seat].name)}</p>
    <button type="button" class="btn btn-primary" data-reclaim-accept onclick={() => answer(true)}>
      {copy.reclaim.dialog.accept}
    </button>
  </div>
</Sheet>

<style>
  .reclaim {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .body {
    margin: 0;
  }
</style>
