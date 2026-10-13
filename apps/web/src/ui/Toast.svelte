<script lang="ts">
  import { dismissToast, toast } from "./toast.svelte.ts";

  // Mounted once, in App.svelte. The live region stays in the page while it is empty, so a screen
  // reader announces each message that appears in it (a region created with its text is often missed).
  function runAction() {
    const action = toast.current?.action;
    dismissToast();
    action?.run();
  }
</script>

<div class="toast-region" aria-live="polite" role="status">
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
