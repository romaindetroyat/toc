<script lang="ts">
  import { credits } from "../i18n/fr/credits.ts";
  import { LICENCES, type LicenceRow } from "../licences/licences.ts";
  import Sheet from "./Sheet.svelte";

  // The « Crédits et licences » sheet: every row of assets/audio/LICENSES.md, grouped by type, as
  // plain text (Svelte text bindings only: nothing from the manifest is ever turned into markup).
  type Props = {
    onclose: () => void;
    opener?: HTMLElement | null;
    /** Rows to show; defaults to the whole manifest. */
    rows?: readonly LicenceRow[];
  };

  let { onclose, opener = null, rows = LICENCES }: Props = $props();

  const NONE = "—";
  const known = new Set<string>(credits.groups.map((group) => group.type));

  const groups = $derived.by(() => {
    const listed = credits.groups.map((group) => ({
      title: group.title,
      rows: rows.filter((row) => row.type === group.type),
    }));
    const others = rows.filter((row) => !known.has(row.type));
    return [...listed, { title: credits.otherGroup, rows: others }].filter(
      (group) => group.rows.length > 0,
    );
  });

  const hasValue = (value: string) => value !== "" && value !== NONE;
  const authorLine = (row: LicenceRow) =>
    [row.auteur, row.licence].filter(hasValue).join(" · ");
</script>

<Sheet title={credits.title} {onclose} {opener} closeLabel={credits.close}>
  <p class="intro">{credits.intro}</p>
  {#each groups as group (group.title)}
    <section class="group" aria-label={group.title} data-credits-group={group.title}>
      <h3 class="t-label">{group.title}</h3>
      <ul>
        {#each group.rows as row (row.id)}
          <li data-credit={row.id}>
            <span class="name">{credits.names[row.id] ?? row.id}</span>
            <span class="line">{row.source}</span>
            <span class="line">{authorLine(row)}</span>
            {#if hasValue(row.fichier)}
              <span class="line detail">{credits.file} {row.fichier}</span>
            {/if}
            {#if hasValue(row.url)}
              <span class="line detail url">{row.url}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="intro">{credits.empty}</p>
  {/each}
</Sheet>

<style>
  .intro {
    margin: 0 0 var(--space-md);
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .group {
    margin-bottom: var(--space-lg);
  }

  h3 {
    margin: 0 0 var(--space-sm);
    font-weight: 700;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-direction: column;
    overflow-wrap: anywhere;
  }

  .name {
    font-weight: 700;
    line-height: var(--body-line);
  }

  .line {
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .detail {
    color: var(--creme-attenuee);
  }
</style>
