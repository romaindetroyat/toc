<script lang="ts">
  import { onMount, type Snippet, tick } from "svelte";
  import HomeStrip from "./HomeStrip.svelte";
  import { pageLayout } from "./pageLayout.svelte.ts";

  // The « Page » layout family (plan 04-10; 04-UI-SPEC « Mon compte » and « Mes amis »): a header row
  // of 44 (the text button « Accueil », 8, the h1), then two columns.
  // - Computer (BAR_QUERY): padding 32 + insets, the header, 32, columns 320 + 48 + 520, centred as a
  //   group with the header.
  // - A phone held sideways from 640 wide: padding 12 + insets, gutters 16 + insets, the header, 16,
  //   columns 280 + 24 + at most 480; the page scrolls (no inner scroll).
  // - Under 640 wide: one column (the header, the left content, 24, the right content).
  // - Portrait: one column of at most 480, padding 48 / 16.
  // The update strip (04-UI-SPEC « Update »: these pages may offer it) sits at the bottom of the right
  // column, or right after the header in one column. The h1 takes the focus when the page opens.
  type Attributes = Record<string, string | undefined>;

  type Props = {
    title: string;
    /** The header's text button back to the home. */
    homeLabel: string;
    /** Test hooks of <main>, the left column and the right column. */
    attrs?: Attributes;
    leftAttrs?: Attributes;
    rightAttrs?: Attributes;
    busy?: boolean;
    left: Snippet;
    right: Snippet;
  };

  let {
    title,
    homeLabel,
    attrs = {},
    leftAttrs = {},
    rightAttrs = {},
    busy = false,
    left,
    right,
  }: Props = $props();

  const layout = pageLayout();
  const columns = $derived(layout.value === "computer" || layout.value === "two");

  let heading = $state<HTMLHeadingElement | null>(null);

  onMount(() => {
    void tick().then(() => heading?.focus());
  });
</script>

<main class="page" data-layout={layout.value} aria-busy={busy} {...attrs}>
  <div class="frame">
    <header class="header">
      <a class="btn btn-text back" href="#/">{homeLabel}</a>
      <h1 class="t-heading" tabindex="-1" bind:this={heading}>{title}</h1>
    </header>
    {#if !columns}
      <HomeStrip kinds={["update"]} margin="0 0 var(--space-md)" />
    {/if}
    <div class="columns">
      <div class="left" {...leftAttrs}>{@render left()}</div>
      <div class="right" {...rightAttrs}>
        {@render right()}
        {#if columns}
          <HomeStrip kinds={["update"]} />
        {/if}
      </div>
    </div>
  </div>
</main>

<style>
  .page {
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    min-height: 100dvh;
  }

  .frame {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
  }

  .header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-height: var(--touch);
  }

  .back {
    flex: none;
    margin-left: calc(-1 * var(--space-sm));
  }

  h1 {
    margin: 0;
    min-width: 0;
  }

  h1:focus,
  h1:focus-visible {
    outline: none;
  }

  .columns {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .left,
  .right {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .right {
    gap: var(--space-lg);
  }

  .page[data-layout="computer"] {
    padding: calc(var(--space-xl) + env(safe-area-inset-top, 0px))
      calc(var(--space-xl) + env(safe-area-inset-right, 0px))
      calc(var(--space-xl) + env(safe-area-inset-bottom, 0px))
      calc(var(--space-xl) + env(safe-area-inset-left, 0px));
  }

  .page[data-layout="computer"] .frame {
    width: min(888px, 100%);
  }

  .page[data-layout="computer"] .header {
    margin-bottom: var(--space-xl);
  }

  .page[data-layout="computer"] .columns {
    display: grid;
    grid-template-columns: 320px minmax(0, 520px);
    align-items: start;
    gap: var(--space-2xl);
  }

  .page[data-layout="two"] {
    padding: calc(12px + env(safe-area-inset-top, 0px))
      calc(var(--space-md) + env(safe-area-inset-right, 0px))
      calc(12px + env(safe-area-inset-bottom, 0px))
      calc(var(--space-md) + env(safe-area-inset-left, 0px));
  }

  .page[data-layout="two"] .frame {
    width: min(784px, 100%);
  }

  .page[data-layout="two"] .header {
    margin-bottom: var(--space-md);
  }

  .page[data-layout="two"] .columns {
    display: grid;
    grid-template-columns: 280px minmax(0, 480px);
    align-items: start;
    gap: var(--space-lg);
  }

  .page[data-layout="one"] {
    padding: calc(12px + env(safe-area-inset-top, 0px))
      calc(var(--space-md) + env(safe-area-inset-right, 0px))
      calc(var(--space-md) + env(safe-area-inset-bottom, 0px))
      calc(var(--space-md) + env(safe-area-inset-left, 0px));
  }

  .page[data-layout="one"] .header,
  .page[data-layout="portrait"] .header {
    margin-bottom: var(--space-md);
  }

  .page[data-layout="portrait"] {
    padding: calc(var(--space-2xl) + env(safe-area-inset-top, 0px))
      calc(var(--space-md) + env(safe-area-inset-right, 0px))
      calc(var(--space-xl) + env(safe-area-inset-bottom, 0px))
      calc(var(--space-md) + env(safe-area-inset-left, 0px));
  }

  .page[data-layout="portrait"] .frame {
    width: min(480px, 100%);
  }
</style>
