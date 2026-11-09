<script lang="ts">
  import type { AccountTable, TableSummary } from "@toc/protocol";
  import { untrack } from "svelte";
  import { forgetMyTable, myTables } from "../account/api.ts";
  import { account } from "../account/store.svelte.ts";
  import { accueil } from "../i18n/fr/accueil.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import { table as copy } from "../i18n/fr/table.ts";
  import { browserApi, tableSummary } from "../net/api.ts";
  import type { StorageLike } from "../net/device.ts";
  import {
    forgetTable,
    loadTables,
    mergeTables,
    restoreTable,
    rowStatus,
    rowText,
    type TableEntry,
    timeAgo,
    visibleTables,
  } from "../net/tables.ts";
  import Icon from "./Icon.svelte";
  import SeatChip from "./SeatChip.svelte";
  import { showToast } from "./toast.svelte.ts";

  // « Mes parties en cours » (02-UI-SPEC, D-06): this device's tables, each row one tap from its table.
  // Rows render at once from the device list with « Vérification… », then each fills in as its summary
  // arrives (no spinner); offline, « État inconnu (hors ligne) » and the row still opens. A table the
  // server no longer knows (404) leaves the list, with one « effacée » toast for all of them. A paused
  // table waiting for this device's seat reads « En pause : on t’attend » (plan 02-07); a saved one
  // « Sauvegardée », and its row opens the saved plate.
  // Plan 04-09 (ACCT-02, D-12; 04-UI-SPEC « Mes parties en cours »): signed in, the device's list is
  // merged with the account's tables from other devices (GET /api/me/tables, at start and after each
  // sign-in); signed out, the rows tagged with an account hide (they stay on the device and come back
  // at the next sign-in). A table gone (404) also leaves the account's list (DELETE /api/me/tables).
  type Props = { storage: StorageLike | null };

  let { storage }: Props = $props();

  type Check = "checking" | "unknown" | TableSummary;

  // svelte-ignore state_referenced_locally
  let device = $state.raw<TableEntry[]>(loadTables(storage));
  let remote = $state.raw<AccountTable[]>([]);
  let checks = $state.raw<Record<string, Check>>({});
  let now = $state(Date.now());

  const accountId = $derived(account.current?.id ?? null);
  const entries = $derived(
    accountId === null ? visibleTables(device, null) : mergeTables(device, remote, accountId),
  );

  async function refresh(signedIn: string | null) {
    device = loadTables(storage);
    remote = [];
    if (!browserApi.online()) {
      checks = Object.fromEntries(entries.map((entry) => [entry.id, "unknown" as const]));
      return;
    }
    if (signedIn !== null) {
      const listed = await myTables();
      // The account changed meanwhile (signed out, another account): this answer is not its own.
      if (accountId !== signedIn) return;
      remote = listed ?? [];
    }
    const list = entries;
    checks = Object.fromEntries(list.map((entry) => [entry.id, "checking" as const]));
    let gone = 0;
    await Promise.all(
      list.map(async (entry) => {
        const result = await tableSummary(entry.id);
        if (result === "gone") {
          gone++;
          forgetTable(storage, entry.id);
          if (entry.account !== undefined) void forgetMyTable(entry.id);
          device = device.filter((each) => each.id !== entry.id);
          remote = remote.filter((row) => row.tableId !== entry.id);
          return;
        }
        now = Date.now();
        checks = { ...checks, [entry.id]: result };
      }),
    );
    if (gone > 0) showToast(copy.list.expired(gone));
  }

  // At start, and again whenever the account changes (a sign-in brings its tables, a sign-out hides
  // them).
  $effect(() => {
    const id = accountId;
    untrack(() => void refresh(id));
  });

  /** Last activity first; a row not checked yet keeps its join date. */
  function activity(entry: TableEntry): number {
    const check = checks[entry.id];
    return typeof check === "object" ? check.updatedAt : entry.joinedAt;
  }

  const rows = $derived([...entries].sort((a, b) => activity(b) - activity(a)));

  function lines(entry: TableEntry): { first: string; second: string } {
    const check = checks[entry.id] ?? "checking";
    if (check === "checking") return { first: copy.list.unknownPlayers, second: copy.list.checking };
    if (check === "unknown") return { first: copy.list.unknownPlayers, second: copy.list.offline };
    return {
      first: rowText(check, entry.seat),
      second: copy.list.line2(rowStatus(check, entry.seat), timeAgo(check.updatedAt, now)),
    };
  }

  function label(entry: TableEntry): string {
    const { first, second } = lines(entry);
    return copy.list.rowLabel(first, second, entry.seat === null ? null : seats[entry.seat].name);
  }

  function remove(entry: TableEntry) {
    const removed = forgetTable(storage, entry.id);
    const index = removed?.index ?? 0;
    device = loadTables(storage);
    // A row of the account leaves the account's list too (every device forgets it); « Remettre »
    // puts it back on this device, tagged with the account.
    if (entry.account !== undefined) {
      remote = remote.filter((row) => row.tableId !== entry.id);
      void forgetMyTable(entry.id);
    }
    showToast(copy.list.removed, {
      label: copy.list.restore,
      run: () => {
        device = restoreTable(storage, removed?.entry ?? entry, index);
      },
    });
  }
</script>

{#if rows.length === 0}
  <div class="empty" data-tables-empty>
    <p class="empty-heading">{accueil.home.emptyHeading}</p>
    <p class="empty-body">{accueil.home.emptyBody}</p>
  </div>
{:else}
  <ul class="rows" data-table-list>
    {#each rows as entry (entry.id)}
      {@const text = lines(entry)}
      <li class="row" data-table-row={entry.id}>
        <a class="open" href={`#/table/${entry.id}`} aria-label={label(entry)}>
          <span class="chip" aria-hidden="true">
            {#if entry.seat !== null}<SeatChip color={entry.seat} small />{/if}
          </span>
          <span class="lines">
            <span class="first">{text.first}</span>
            <span class="second" data-table-status>{text.second}</span>
          </span>
        </a>
        <button
          type="button"
          class="remove"
          aria-label={copy.list.remove}
          title={copy.list.remove}
          onclick={() => remove(entry)}
        >
          <Icon name="x" />
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .empty p {
    margin: 0;
  }

  .empty-heading {
    font-weight: 700;
  }

  .empty-body {
    color: var(--creme-attenuee);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* 64 high: two lines (Body 24 + Label 20) and 8 of padding above and below, rounded up. */
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    height: 64px;
    padding: var(--space-sm) var(--space-xs) var(--space-sm) 12px;
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
  }

  .open {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 12px;
    min-width: 0;
    height: 100%;
    border-radius: var(--radius-card);
    color: var(--creme);
    text-decoration: none;
  }

  /* One width for every colour chip, so the two lines of every row start at the same place. */
  .chip {
    flex: none;
    display: flex;
    width: 72px;
  }

  .lines {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .first,
  .second {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .first {
    font-size: var(--body-size);
    font-weight: 700;
    line-height: 24px;
  }

  .second {
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: 20px;
  }

  .remove {
    flex: none;
    display: grid;
    place-items: center;
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
