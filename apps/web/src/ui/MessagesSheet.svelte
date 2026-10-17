<script lang="ts">
  import type { Color } from "@toc/engine";
  import {
    type ChatEntry,
    QUICK_EMOJIS,
    QUICK_PHRASES,
    type QuickMessageId,
    type TablePublic,
  } from "@toc/protocol";
  import { messages } from "../i18n/fr/messages.ts";
  import { historyRows } from "../net/chat.ts";
  import Sheet from "./Sheet.svelte";

  // « Messages rapides » (02-UI-SPEC « Quick messages », D-07, D-13, plan 02-08): the palette first —
  // the seven phrases as 44 px chips that wrap with 8 px gaps, then the row of five emojis (44 x 44) —
  // then « Derniers messages », the newest five of the 30 the server keeps. One tap sends and closes;
  // the focus goes back to the opener. No text field anywhere: Romain chose ready-made messages only.
  // Every message is drawn from the French catalogue by its id, as a text node (T-02-33).
  type Props = {
    chat: readonly ChatEntry[];
    table: TablePublic;
    /** This device's seat: its own messages read « Toi ». */
    me: Color | null;
    onsend: (msg: QuickMessageId) => void;
    onclose: () => void;
    /** Element that gets the focus back on close (« Messages », or what had it before « M »). */
    opener?: HTMLElement | null;
  };

  let { chat, table, me, onsend, onclose, opener = null }: Props = $props();

  const rows = $derived(historyRows(chat, table, me));

  function send(msg: QuickMessageId) {
    onsend(msg);
    onclose();
  }
</script>

<Sheet title={messages.title} closeLabel={messages.close} {onclose} {opener}>
  <div class="palette" data-messages-sheet>
    <div class="phrases">
      {#each QUICK_PHRASES as id (id)}
        <button
          type="button"
          class="chip phrase"
          aria-label={messages.send(id)}
          data-quick-message={id}
          onclick={() => send(id)}
        >
          {messages.text(id)}
        </button>
      {/each}
    </div>
    <div class="emojis">
      {#each QUICK_EMOJIS as id (id)}
        <button
          type="button"
          class="chip emoji"
          aria-label={messages.send(id)}
          title={messages.spoken(id)}
          data-quick-message={id}
          onclick={() => send(id)}
        >
          <span aria-hidden="true">{messages.text(id)}</span>
        </button>
      {/each}
    </div>
  </div>

  <section class="history" aria-labelledby="messages-history" data-messages-history>
    <h3 id="messages-history" class="history-heading">{messages.history.heading}</h3>
    {#if rows.length === 0}
      <p class="empty">{messages.history.empty}</p>
    {:else}
      <ul class="rows">
        {#each rows as row (row.key)}
          <li class="row" data-history-row={row.msg}>
            <span aria-hidden="true"
              ><span class="name">{row.name}</span>{messages.history.sep}<span class:glyph={row.emoji}
                >{row.text}</span
              ></span
            >
            <span class="sr-only">{row.spoken}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</Sheet>

<style>
  .palette {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .phrases,
  .emojis {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  /* A chip: 44 high, pill radius, 2 px cream outline, cream Label 700; never amber. */
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    height: var(--touch);
    padding: 0 12px;
    border: 2px solid var(--creme);
    border-radius: 999px;
    background: transparent;
    color: var(--creme);
    font-family: inherit;
    font-size: var(--label-size);
    font-weight: 700;
    line-height: 1.4;
    white-space: nowrap;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:active {
    background: var(--noyer);
  }

  .emoji {
    width: var(--touch);
    padding: 0;
    font-size: var(--heading-size);
    line-height: 1;
  }

  .history {
    margin-top: var(--space-md);
  }

  .history-heading {
    margin: 0 0 var(--space-xs);
    font-size: var(--label-size);
    font-weight: 700;
    line-height: 1.4;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row,
  .empty {
    margin: 0;
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: 1.4;
  }

  .name {
    color: var(--creme);
    font-weight: 700;
  }

  .glyph {
    font-size: var(--heading-size);
    line-height: 1;
    vertical-align: middle;
  }
</style>
