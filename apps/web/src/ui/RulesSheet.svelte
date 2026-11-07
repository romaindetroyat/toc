<script lang="ts">
  import type { Rank } from "@toc/engine";
  import { onDestroy, onMount, tick } from "svelte";
  import { RULES_TABS, type RulesTabId, regles } from "../i18n/fr/regles.ts";
  import CardRule from "./CardRule.svelte";
  import { holdForRules } from "./rulesOpen.svelte.ts";
  import Sheet from "./Sheet.svelte";

  // « Règles du TOC » (plan 05-04, 05-UI-SPEC « The « Règles » sheet »; PLAY-06, D-05, D-06): the large
  // sheet with its ten tabs (a tablist: the arrows, Début and Fin, one tab stop) and their panel (the
  // text of regles.ts, the cards list on « Les cartes », the rule figures). While it is mounted it
  // counts in `rulesOpen`, so the computers of a solo game wait for it, wherever it was opened from.
  type Props = {
    /** The tab on opening; by default « Les cartes » in a game, « Le but » elsewhere. */
    tab?: RulesTabId;
    /** The rank of the card chosen in the game: its row of « Les cartes » is outlined. */
    selectedRank?: Rank | null;
    /** Opened from a game or a lesson. */
    inGame?: boolean;
    onclose: () => void;
    /** Each tab chosen, so the game keeps the last one for its next opening. */
    ontab?: (tab: RulesTabId) => void;
    /** Element that gets the focus back on close. */
    opener?: HTMLElement | null;
  };

  let {
    tab,
    selectedRank = null,
    inGame = false,
    onclose,
    ontab,
    opener = null,
  }: Props = $props();

  const uid = $props.id();
  const panelId = `${uid}-panel`;
  const tabId = (id: RulesTabId) => `${uid}-tab-${id}`;

  // The computers of a solo game wait while any rules sheet is open (05-RESEARCH Pitfall 8).
  onDestroy(holdForRules());

  // svelte-ignore state_referenced_locally
  let current = $state<RulesTabId>(tab ?? (inGame ? "cartes" : "but"));
  const shown = $derived(regles.tabs[current]);

  /** Two columns when the dialog is at least 656 px wide: from a 688 px window (880 or 100vw − 32). */
  const TWO_COLUMNS = "(min-width: 688px)";
  function wide(): boolean {
    try {
      return window.matchMedia(TWO_COLUMNS).matches;
    } catch {
      return true;
    }
  }
  let two = $state(wide());
  onMount(() => {
    let query: MediaQueryList;
    try {
      query = window.matchMedia(TWO_COLUMNS);
    } catch {
      return;
    }
    const follow = () => {
      two = query.matches;
    };
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  });

  let panel = $state<HTMLElement | null>(null);
  const tabEls: Partial<Record<RulesTabId, HTMLButtonElement>> = {};

  function select(id: RulesTabId) {
    if (id !== current) {
      current = id;
      // A new tab is read from its top.
      if (panel !== null) panel.scrollTop = 0;
    }
    ontab?.(id);
  }

  /** The arrows of the layout (Haut / Bas in two columns, Gauche / Droite in one), Début, Fin. */
  function onNavKey(event: KeyboardEvent) {
    const at = RULES_TABS.indexOf(current);
    const last = RULES_TABS.length - 1;
    let next: number | null = null;
    if (event.key === (two ? "ArrowUp" : "ArrowLeft")) next = at === 0 ? last : at - 1;
    else if (event.key === (two ? "ArrowDown" : "ArrowRight")) next = at === last ? 0 : at + 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    const id = RULES_TABS[next] as RulesTabId;
    select(id);
    tabEls[id]?.focus();
    tabEls[id]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  const chosenRow = (ranks: readonly Rank[]) => selectedRank !== null && ranks.includes(selectedRank);

  // The chosen card's row is scrolled into view when the sheet opens on « Les cartes »; the chosen
  // tab is, in the nav.
  onMount(() => {
    void tick().then(() => {
      tabEls[current]?.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (current === "cartes") {
        panel?.querySelector("[data-chosen]")?.scrollIntoView({ block: "nearest" });
      }
    });
  });
</script>

<Sheet title={regles.title} size="large" closeLabel={regles.close} {onclose} {opener}>
  <div class="rules" class:two data-rules-sheet data-rules-current={current}>
    <div
      class="nav"
      role="tablist"
      tabindex="-1"
      aria-label={regles.nav}
      aria-orientation={two ? "vertical" : "horizontal"}
      onkeydown={onNavKey}
    >
      {#each RULES_TABS as id (id)}
        <button
          type="button"
          class="tab"
          role="tab"
          id={tabId(id)}
          aria-selected={id === current}
          aria-controls={panelId}
          tabindex={id === current ? 0 : -1}
          data-rules-tab={id}
          bind:this={tabEls[id]}
          onclick={() => select(id)}
        >
          {regles.tabs[id].name}
        </button>
      {/each}
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="panel"
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId(current)}
      tabindex="0"
      bind:this={panel}
      data-rules-panel={current}
    >
      <h3 class="t-heading">{shown.name}</h3>
      {#if "intro" in shown}
        <p class="intro t-label">{shown.intro}</p>
      {/if}
      {#each shown.text as paragraph, i (i)}
        <p class="text">{paragraph}</p>
      {/each}
      {#if "list" in shown}
        <ul class="house">
          {#each shown.list as item, i (i)}
            <li>{item}</li>
          {/each}
        </ul>
      {/if}
      {#if current === "cartes"}
        <ul class="cards" data-cards-list>
          {#each regles.cards as row (row.names)}
            <CardRule {row} chosen={chosenRow(row.ranks)} onsee={select} />
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</Sheet>

<style>
  /* One column (a dialog under 656 px): the tabs as one row of 44 px chips, the panel under it. */
  .rules {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    flex: 1 1 auto;
    min-height: 0;
  }

  .nav {
    flex: none;
    display: flex;
    gap: var(--space-xs);
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior: contain;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
  }

  .nav:focus {
    outline: none;
  }

  .tab {
    flex: none;
    min-height: var(--touch);
    padding: 0 var(--space-md);
    border: 1px solid var(--creme-attenuee);
    border-radius: var(--radius-card);
    background: var(--bois-sombre);
    color: var(--creme);
    font-family: inherit;
    font-size: var(--body-size);
    font-weight: 700;
    line-height: var(--body-line);
    text-align: left;
    white-space: nowrap;
    scroll-snap-align: start;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  /* The chosen tab: cream fill, walnut text (the Segmented checked option), never amber. */
  .tab[aria-selected="true"] {
    border-color: var(--creme);
    background: var(--creme);
    color: var(--noyer);
  }

  .panel {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: var(--space-xs);
  }

  .panel:focus {
    outline: none;
  }

  .panel:focus-visible {
    outline: 3px solid var(--ambre);
    outline-offset: -3px;
  }

  h3 {
    margin: 0 0 var(--space-sm);
  }

  .text,
  .intro {
    max-width: 36em;
    margin: 0 0 var(--space-md);
  }

  .intro {
    color: var(--creme-attenuee);
  }

  .house {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    max-width: 36em;
    margin: 0 0 var(--space-md);
    padding-left: var(--space-lg);
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    max-width: 36em;
    margin: 0 0 var(--space-md);
    padding: 2px;
    list-style: none;
  }

  /* Two columns (a dialog from 656 px): the nav 208 at the left, 16, the panel. */
  .rules.two {
    display: grid;
    grid-template-columns: 208px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    column-gap: var(--space-md);
  }

  .two .nav {
    flex-direction: column;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    scroll-snap-type: none;
  }

  .two .tab {
    width: 100%;
    border-color: transparent;
  }
</style>
