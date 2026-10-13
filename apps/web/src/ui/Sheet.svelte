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
  import { onDestroy, type Snippet } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { settings } from "../settings/store.svelte.ts";

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
    /** Element that gets the focus back on close; defaults to the element focused on opening. */
    opener?: HTMLElement | null;
    children: Snippet;
  };

  let {
    title,
    onclose,
    closeOnBackdrop = true,
    closeLabel = "Fermer",
    closeIsPrimary = false,
    opener = null,
    children,
  }: Props = $props();

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
    if (closeIsPrimary) closeButton?.focus({ preventScroll: true });
    else dialog?.focus({ preventScroll: true });
  });

  // The page behind does not scroll while the sheet is open.
  $effect(() => lockScroll());

  onDestroy(() => {
    open.splice(open.indexOf(me), 1);
    const target = opener ?? openedFrom;
    if (target?.isConnected) target.focus({ preventScroll: true });
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
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
    bind:this={dialog}
    onkeydown={trap}
    transition:fly|global={{ y: isCompact ? "100%" : 24, opacity: isCompact ? 1 : 0, duration }}
  >
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
  }
</style>
