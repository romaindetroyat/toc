<script module lang="ts">
  // The sheets open at this moment, the last one on top. Only the top one answers to Échap and to the
  // focus leaving: a sheet opened from another sheet (« Crédits et licences » in « Réglages ») would
  // otherwise fight it for the focus.
  const open: symbol[] = [];

  // The page scroll lock is shared by every open sheet and counted, not saved and restored by each
  // one: sheets opened from one another (Réglages, then the abandon confirmation) can be torn down in
  // any order (a hash change drops the whole game at once, first sheet first), and a per-sheet restore
  // would then leave the second sheet's saved « hidden » on the body for good.
  let scrollLocks = 0;
  let overflowBeforeLock = "";

  function lockScroll(): () => void {
    if (scrollLocks === 0) {
      overflowBeforeLock = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    scrollLocks += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      scrollLocks -= 1;
      if (scrollLocks === 0) document.body.style.overflow = overflowBeforeLock;
    };
  }
</script>

<script lang="ts">
  import { onDestroy, type Snippet, untrack } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { settings } from "../settings/store.svelte.ts";
  import Icon from "./Icon.svelte";

  // Bottom sheet on compact screens, centred 480 px dialog on larger ones (UI-SPEC « Sheet »).
  // The parent mounts it with `{#if open}`; it closes through `onclose` (Échap, backdrop, « Fermer »).
  type Props = {
    title: string;
    onclose: () => void;
    /** A confirmation must not vanish on a stray tap outside: pass false for those. */
    closeOnBackdrop?: boolean;
    closeLabel?: string;
    /** A confirmation makes its safe answer the primary button, focused on opening. */
    closeIsPrimary?: boolean;
    /**
     * The close button (the safe answer) takes the focus on opening even when it is not the primary
     * one (the reclaim dialog's « Refuser », plan 02-07).
     */
    focusClose?: boolean;
    /** Element that gets the focus back on close; defaults to the element focused on opening. */
    opener?: HTMLElement | null;
    /**
     * « large » (plan 05-04, 05-UI-SPEC « The large sheet »): « Règles du TOC », up to 880 x 720 from
     * 600 px wide, the full height from the bottom under it; a header with the title and a 44 x 44
     * close button named by `closeLabel`, no bottom button, and a body that its content lays out
     * (it scrolls in its own parts). « normal », the default, is unchanged.
     */
    size?: "normal" | "large";
    children: Snippet;
  };

  let {
    title,
    onclose,
    closeOnBackdrop = true,
    closeLabel = "Fermer",
    closeIsPrimary = false,
    focusClose = false,
    opener = null,
    size = "normal",
    children,
  }: Props = $props();

  const large = untrack(() => size === "large");

  const uid = $props.id();
  const titleId = `${uid}-title`;
  const openedFrom = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  let dialog = $state<HTMLElement>();
  let closeButton = $state<HTMLButtonElement>();

  const me = Symbol("sheet");
  open.push(me);
  const onTop = () => open[open.length - 1] === me;

  function compact(): boolean {
    try {
      return window.matchMedia("(max-width: 599px)").matches;
    } catch {
      return true;
    }
  }

  /** No slide under reduced motion (the setting, or the system preference before it was ever set). */
  function still(): boolean {
    if (settings.reduceMotion) return true;
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  // Motion is decided when the sheet opens (the slide in and the slide out use the same values).
  const isCompact = compact();
  const duration = still() ? 0 : 250;

  const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusables(): HTMLElement[] {
    if (!dialog) return [];
    return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    );
  }

  // The focus moves into the sheet when it opens (on the dialog itself, so the title is read first; on
  // the safe answer of a confirmation).
  $effect(() => {
    if (closeIsPrimary || focusClose) closeButton?.focus({ preventScroll: true });
    else dialog?.focus({ preventScroll: true });
  });

  // The page behind does not scroll while the sheet is open.
  $effect(() => lockScroll());

  // The dialog element, kept for onDestroy (the binding may already be cleared when it runs).
  let mounted: HTMLElement | undefined;
  $effect(() => {
    if (dialog) mounted = dialog;
  });

  // On close the focus goes back to the opener, but only if nothing else holds it (plan 04-16): the
  // sheet is torn down at the end of its slide-out, and a sheet or a confirmation opened meanwhile
  // has its focus where it belongs (its safe answer). While the sheet slides out it is inert, so the
  // focus it held has fallen back to the body.
  onDestroy(() => {
    open.splice(open.indexOf(me), 1);
    const target = opener ?? openedFrom;
    const active = document.activeElement;
    const free = active === null || active === document.body || (mounted?.contains(active) ?? false);
    if (free && target?.isConnected) target.focus({ preventScroll: true });
  });

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && onTop()) {
      event.preventDefault();
      onclose();
    }
  }

  /** Tab and Shift+Tab cycle inside the sheet. */
  function trap(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      dialog?.focus();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // If the focus ever leaves the sheet (a click on the page behind), it comes back.
  function onWindowFocusin(event: FocusEvent) {
    if (!onTop()) return;
    if (dialog && event.target instanceof Node && !dialog.contains(event.target)) dialog.focus();
  }

  function onLayerClick(event: MouseEvent) {
    if (closeOnBackdrop && event.target === event.currentTarget) onclose();
  }
</script>

<svelte:window onkeydown={onWindowKeydown} onfocusin={onWindowFocusin} />

<div
  class="layer"
  role="presentation"
  data-sheet-layer
  onclick={onLayerClick}
  transition:fade|global={{ duration }}
>
  <div
    class="sheet"
    class:large
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
    bind:this={dialog}
    onkeydown={trap}
    transition:fly|global={{ y: isCompact ? "100%" : 24, opacity: isCompact ? 1 : 0, duration }}
  >
    {#if large}
      <!-- The large sheet: the title and the close button on one 44 px row, then a body whose
           content scrolls in its own parts (the rules' nav and panel). -->
      <div class="header">
        <h2 id={titleId} class="t-heading">{title}</h2>
        <button
          type="button"
          class="icon-close"
          aria-label={closeLabel}
          title={closeLabel}
          bind:this={closeButton}
          onclick={onclose}
          data-sheet-close
        >
          <Icon name="x" />
        </button>
      </div>
      <div class="body large-body" data-sheet-body>
        {@render children()}
      </div>
    {:else}
      <h2 id={titleId} class="t-heading">{title}</h2>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="body" role="region" aria-labelledby={titleId} tabindex="0" data-sheet-body>
        {@render children()}
      </div>
      <button
        type="button"
        class="btn close"
        class:btn-primary={closeIsPrimary}
        class:btn-secondary={!closeIsPrimary}
        bind:this={closeButton}
        onclick={onclose}
      >
        {closeLabel}
      </button>
    {/if}
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgb(0 0 0 / 55%);
  }

  .sheet {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    width: 100%;
    max-height: 90dvh;
    padding: var(--space-lg) var(--space-lg)
      calc(var(--space-lg) + env(safe-area-inset-bottom, 0px));
    border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
    background: var(--bois-sombre);
    color: var(--creme);
    box-shadow: 0 -2px 16px rgb(0 0 0 / 50%);
  }

  .sheet:focus {
    outline: none;
  }

  h2 {
    flex: none;
    margin: 0;
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .close {
    flex: none;
  }

  /* The large sheet (plan 05-04): the full width and 100dvh − 8 from the bottom, padding 16, the
     body 8 under the header. */
  .sheet.large {
    gap: var(--space-sm);
    height: calc(100dvh - 8px);
    max-height: none;
    padding: var(--space-md) calc(var(--space-md) + env(safe-area-inset-right, 0px))
      calc(var(--space-md) + env(safe-area-inset-bottom, 0px))
      calc(var(--space-md) + env(safe-area-inset-left, 0px));
  }

  .header {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    min-height: var(--touch);
  }

  .header h2 {
    min-width: 0;
  }

  .icon-close {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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

  /* The content lays itself out in the body and scrolls in its own parts. */
  .large-body {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  @media (min-width: 600px) {
    .layer {
      align-items: center;
    }

    .sheet {
      width: 480px;
      max-width: calc(100% - 2 * var(--space-md));
      padding-bottom: var(--space-lg);
      border-radius: var(--radius-sheet);
      box-shadow: 0 4px 24px rgb(0 0 0 / 50%);
    }

    /* Centred, up to 880 x 720: the page stays visible around it on a computer. */
    .sheet.large {
      width: min(880px, 100vw - 32px);
      max-width: none;
      height: min(720px, 100dvh - 16px);
      padding: var(--space-md);
    }
  }
</style>
