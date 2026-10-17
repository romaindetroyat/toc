<script lang="ts">
  import { COLORS, type Color } from "@toc/engine";
  import type { TablePublic } from "@toc/protocol";
  import { seats } from "../i18n/fr/seats.ts";
  import { table as copy } from "../i18n/fr/table.ts";
  import Sheet from "./Sheet.svelte";

  // The creator's « Déplacer {Nom} » sheet (02-UI-SPEC « Creator's sheet »): one secondary button per
  // other seat in COLORS order, « Vers {Couleur} (place libre) » or « Échanger avec {Nom} ({Couleur}) »,
  // then « Fermer ». A tap sends the move (the server checks it, host only) and closes. No drag-and-drop.
  type Props = {
    /** The seat of the person to move. */
    from: Color;
    table: TablePublic;
    onmove: (to: Color) => void;
    onclose: () => void;
    opener?: HTMLElement | null;
  };

  let { from, table, onmove, onclose, opener = null }: Props = $props();

  const name = $derived(table.seats[from].name ?? "");
  const targets = $derived(COLORS.filter((color) => color !== from));

  function label(color: Color): string {
    const seat = table.seats[color];
    const colour = seats[color].name;
    return seat.kind === "human" ? copy.lobby.move.swap(seat.name ?? "", colour) : copy.lobby.move.toFree(colour);
  }

  function pick(color: Color) {
    onmove(color);
    onclose();
  }
</script>

<Sheet title={copy.lobby.move.title(name)} {onclose} {opener}>
  <div class="targets" data-move-sheet={from}>
    {#each targets as color (color)}
      <button type="button" class="btn btn-secondary" data-move-to={color} onclick={() => pick(color)}>
        {label(color)}
      </button>
    {/each}
  </div>
</Sheet>

<style>
  .targets {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .targets .btn {
    width: 100%;
  }
</style>
