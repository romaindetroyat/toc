<script lang="ts">
  import { clavier } from "../i18n/fr/clavier.ts";
  import Sheet from "./Sheet.svelte";

  // « Raccourcis clavier » (UI-SPEC « Addendum 2026-10-14 »): every shortcut of the game screen in
  // French, one row per entry, opened with « ? ». A static list: nothing loads, nothing can fail.
  type Props = {
    onclose: () => void;
    /** Element that gets the focus back on close. */
    opener?: HTMLElement | null;
  };

  let { onclose, opener = null }: Props = $props();
</script>

<Sheet title={clavier.title} closeLabel={clavier.close} {onclose} {opener}>
  <p class="intro">{clavier.intro}</p>
  <dl class="rows" data-shortcuts-sheet>
    {#each clavier.rows as row (row.action)}
      <div class="row" data-shortcut-row>
        <dt class="keys">
          {#each row.keys as key, i (key)}
            {#if i > 0}<span class="or">{clavier.or}</span>{/if}
            <kbd>{key}</kbd>
          {/each}
        </dt>
        <dd class="action">{row.action}</dd>
      </div>
    {/each}
  </dl>
</Sheet>

<style>
  .intro {
    margin: 0 0 var(--space-md);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: 0;
  }

  /* The key caps at the left, what they do at the right; the text wraps under itself. */
  .row {
    display: grid;
    grid-template-columns: minmax(96px, auto) 1fr;
    align-items: baseline;
    gap: var(--space-sm);
  }

  .keys {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-xs);
  }

  .or {
    color: var(--creme-attenuee);
    font-size: var(--label-size);
  }

  /* A key cap (Label 14 / 700): walnut fill, crème border, never amber. */
  kbd {
    display: inline-block;
    min-width: 20px;
    padding: 0 6px;
    border: 1px solid var(--creme);
    border-radius: 4px;
    background: var(--noyer);
    color: var(--creme);
    font-family: inherit;
    font-size: var(--label-size);
    font-weight: 700;
    line-height: 1.4;
    text-align: center;
    white-space: nowrap;
  }

  .action {
    min-width: 0;
    margin: 0;
  }
</style>
