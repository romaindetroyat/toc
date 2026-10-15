<script lang="ts">
  import { dismissToast, toast } from "./toast.svelte.ts";

  // Mounted once, in App.svelte. The live region stays in the page while it is empty, so a screen
  // reader announces each message that appears in it (a region created with its text is often missed).
  function runAction() {
    const action = toast.current?.action;
    dismissToast();
    action?.run();
  }

  /**
   * In the game's compact mode (a phone held sideways, plan 01-47) the bottom of the screen is the
   * galet's bottom ring row and the strips at its sides: the toast is centred over the felt instead,
   * at most three quarters of the board wide, so it never covers a strip nor the bottom ring row. Elsewhere it
   * keeps its place at the bottom of the screen.
   */
  let place = $state<{ x: number; y: number; width: number } | null>(null);

  function measure() {
    const board = document.querySelector('main.game[data-chrome="compact"] [data-board]');
    if (board === null) {
      place = null;
      return;
    }
    const box = board.getBoundingClientRect();
    const felt = board.querySelector("[data-felt-button]")?.getBoundingClientRect();
    place = {
      x: felt ? felt.left + felt.width / 2 : box.left + box.width / 2,
      y: felt ? felt.top + felt.height / 2 : box.top + box.height / 2,
      width: Math.min(480, box.width * 0.75),
    };
  }

  // A message may come before the game screen is laid out (the sound's failure at the first tap): the
  // board is looked for again on the next frames, for up to two seconds, then on every resize.
  $effect(() => {
    if (!toast.current) return;
    measure();
    let frames = 120;
    let frame = 0;
    const again = () => {
      measure();
      if (place === null && --frames > 0) frame = requestAnimationFrame(again);
    };
    if (place === null) frame = requestAnimationFrame(again);
    return () => cancelAnimationFrame(frame);
  });
</script>

<svelte:window onresize={() => toast.current && measure()} />

<div
  class="toast-region"
  class:over-felt={place !== null}
  aria-live="polite"
  role="status"
  style:left={place ? `${place.x - place.width / 2}px` : undefined}
  style:top={place ? `${place.y}px` : undefined}
  style:width={place ? `${place.width}px` : undefined}
>
  {#if toast.current}
    {#key toast.current.id}
      <div class="toast" data-toast>
        <span class="text">{toast.current.message}</span>
        {#if toast.current.action}
          <button type="button" class="btn btn-text action" onclick={runAction}>
            {toast.current.action.label}
          </button>
        {/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .toast-region {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--space-md) + env(safe-area-inset-bottom, 0px));
    z-index: 50;
    display: flex;
    justify-content: center;
    padding: 0 var(--space-md);
    pointer-events: none;
  }

  /* Over the felt (the compact mode): centred on it, as wide as the place it is given. */
  .toast-region.over-felt {
    right: auto;
    bottom: auto;
    padding: 0;
    transform: translateY(-50%);
  }

  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    max-width: 480px;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
    font-size: var(--label-size);
    line-height: var(--label-line);
    box-shadow: 0 2px 8px rgb(0 0 0 / 40%);
    pointer-events: auto;
  }

  .text {
    flex: 1;
  }

  .action {
    flex: none;
    font-weight: 700;
  }
</style>
