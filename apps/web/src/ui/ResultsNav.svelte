<script module lang="ts">
  /** The three panels of « Mes résultats » and their routes (05-UI-SPEC « Navigation »). */
  export type ResultsTab = "historique" | "chiffres" | "classement";

  export const RESULTS_ROUTES: Record<ResultsTab, string> = {
    historique: "#/resultats",
    chiffres: "#/resultats/chiffres",
    classement: "#/resultats/classement",
  };

  /** The panel a route shows: the sub-route after #/resultats, « Historique » by default. */
  export function tabOf(route: string): ResultsTab {
    if (route === RESULTS_ROUTES.chiffres) return "chiffres";
    if (route === RESULTS_ROUTES.classement) return "classement";
    return "historique";
  }
</script>

<script lang="ts">
  import { resultats } from "../i18n/fr/resultats.ts";
  import type { IconName } from "./icons.ts";
  import Icon from "./Icon.svelte";

  // The navigation of « Mes résultats » (plan 05-09; 05-UI-SPEC « Navigation »): a <nav> named
  // « Mes résultats » with three links (hash routes, so the back button walks them), the current one
  // aria-current="page" and filled in cream with walnut text (the Segmented checked style, never
  // amber). In two columns and on the computer: three stacked tabs of 48, 8 apart, in the left
  // column. Under 640 wide and upright (`bar`): one segmented row of 44, icons hidden under 360 wide.
  type Props = {
    current: ResultsTab;
    /** « column » in the left column, « bar » for one column. */
    form: "column" | "bar";
  };

  let { current, form }: Props = $props();

  const links: { tab: ResultsTab; icon: IconName; label: string }[] = [
    { tab: "historique", icon: "history", label: resultats.nav.history },
    { tab: "chiffres", icon: "chart-column", label: resultats.nav.stats },
    { tab: "classement", icon: "trophy", label: resultats.nav.ranking },
  ];
</script>

<nav class="nav {form}" aria-label={resultats.nav.label} data-results-nav={form}>
  {#each links as link (link.tab)}
    <a
      class="tab"
      href={RESULTS_ROUTES[link.tab]}
      aria-current={link.tab === current ? "page" : undefined}
      data-results-tab={link.tab}
    >
      <span class="icon"><Icon name={link.icon} size={20} /></span>
      <span class="label">{link.label}</span>
    </a>
  {/each}
</nav>

<style>
  .nav {
    display: flex;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
    font-size: var(--body-size);
    font-weight: 700;
    line-height: var(--body-line);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }

  .tab[aria-current="page"] {
    background: var(--creme);
    color: var(--noyer);
  }

  .icon {
    display: flex;
    flex: none;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The left column: three stacked tabs of 48, 8 apart, full width. */
  .column {
    flex-direction: column;
    gap: var(--space-sm);
  }

  .column .tab {
    height: var(--button-height);
    padding: 0 var(--space-md);
  }

  /* One column: a segmented row of 44, the three links side by side. */
  .bar {
    border: 2px solid var(--creme);
    border-radius: var(--radius-button);
    overflow: hidden;
  }

  .bar .tab {
    flex: 1 1 0;
    justify-content: center;
    gap: var(--space-xs);
    height: var(--touch);
    padding: 0 var(--space-xs);
    border-left: 2px solid var(--creme);
    border-radius: 0;
    background: transparent;
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .bar .tab:first-child {
    border-left: 0;
  }

  .bar .tab[aria-current="page"] {
    background: var(--creme);
  }

  .bar .tab:focus-visible {
    outline-offset: -5px;
  }

  @media (max-width: 359px) {
    .bar .icon {
      display: none;
    }
  }
</style>
