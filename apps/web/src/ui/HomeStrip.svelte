<script lang="ts">
  import type { TransitionConfig } from "svelte/transition";
  import { account } from "../account/store.svelte.ts";
  import { appli } from "../i18n/fr/appli.ts";
  import { hideInstall, install, promptInstall } from "../pwa/install.svelte.ts";
  import { canPromptUpdate, type Strip, stripFor } from "../pwa/rules.ts";
  import { applyUpdate, currentPlace, pwaUpdate } from "../pwa/update.svelte.ts";
  import { settings } from "../settings/store.svelte.ts";
  import Icon from "./Icon.svelte";
  import InstallSheet from "./InstallSheet.svelte";

  // The home strip (04-UI-SPEC « Home strip », plan 04-08): one at most, offline > update > install.
  // Bois sombre, radius 12, a 2 px border of --creme-attenuee at 40 %, padding 8 (the border inside).
  // One row of 56 when the text and the buttons fit side by side; else the buttons wrap under the text
  // (up to two lines) and sit at the right, at most 104. The text is Label 700 cream; the buttons are
  // secondary (never amber on the home) and 44 high; the x is « Plus tard ». Offline and update are a
  // polite status; install is a region « Installer TOC ». In: 200 ms (8 px up and a fade); out: a
  // 150 ms fade; reduced motion: 150 ms fades.
  type Props = {
    /** The strips this page may show (#/ordinateur: the update only). */
    kinds?: readonly Strip[];
    /** Its margin in the page's layout (e.g. "16px 0 0"). */
    margin?: string;
  };

  let { kinds = ["offline", "update", "install-prompt", "install-apple"], margin }: Props = $props();

  let online = $state(typeof navigator === "undefined" || navigator.onLine !== false);
  let sheetOpen = $state(false);
  let howToButton = $state<HTMLButtonElement | null>(null);

  const strip = $derived.by(() => {
    const kind = stripFor({
      online,
      apiReachable: account.reachable,
      needRefresh: pwaUpdate.needRefresh && canPromptUpdate(currentPlace()),
      updateDismissed: pwaUpdate.dismissed,
      installable: install.prompt !== null,
      appleMobile: install.apple,
      standalone: install.standalone,
      installHiddenUntil: install.hiddenUntil,
      now: Date.now(),
    });
    return kind !== null && kinds.includes(kind) ? kind : null;
  });

  function reduced(): boolean {
    if (settings.reduceMotion) return true;
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function enter(_node: Element): TransitionConfig {
    if (reduced()) return { duration: 150, css: (t) => `opacity: ${t}` };
    return {
      duration: 200,
      css: (t) => `opacity: ${t}; transform: translateY(${(1 - t) * 8}px)`,
    };
  }

  function leave(_node: Element): TransitionConfig {
    return { duration: 150, css: (t) => `opacity: ${t}` };
  }
</script>

<svelte:window ononline={() => (online = true)} onoffline={() => (online = false)} />

{#snippet later(onclick: () => void)}
  <button type="button" class="btn close" aria-label={appli.strip.later} title={appli.strip.later} {onclick}>
    <Icon name="x" size={20} />
  </button>
{/snippet}

{#if strip === "offline"}
  <div class="strip" style:margin data-home-strip="offline" role="status" in:enter out:leave>
    <span class="message">
      <Icon name="wifi-off" size={20} />
      <span class="text">{appli.strip.offline}</span>
    </span>
  </div>
{:else if strip === "update"}
  <div class="strip" style:margin data-home-strip="update" role="status" in:enter out:leave>
    <span class="message">
      <Icon name="refresh-cw" size={20} />
      <span class="text">{appli.strip.update}</span>
    </span>
    <span class="actions">
      <button
        type="button"
        class="btn btn-secondary action"
        aria-busy={pwaUpdate.busy}
        onclick={() => void applyUpdate()}
      >
        {pwaUpdate.busy ? appli.strip.updateBusy : appli.strip.updateButton}
      </button>
      {@render later(() => (pwaUpdate.dismissed = true))}
    </span>
  </div>
{:else if strip === "install-prompt" || strip === "install-apple"}
  <section
    class="strip"
    style:margin
    data-home-strip="install"
    data-install-via={strip === "install-apple" ? "apple" : "prompt"}
    aria-label={appli.strip.installRegion}
    in:enter
    out:leave
  >
    <span class="message">
      <Icon name="download" size={20} />
      <span class="text">{appli.strip.install}</span>
    </span>
    <span class="actions">
      {#if strip === "install-prompt"}
        <button type="button" class="btn btn-secondary action" onclick={() => void promptInstall()}>
          {appli.strip.installButton}
        </button>
      {:else}
        <button
          type="button"
          class="btn btn-secondary action"
          aria-haspopup="dialog"
          bind:this={howToButton}
          onclick={() => (sheetOpen = true)}
        >
          {appli.strip.howTo}
        </button>
      {/if}
      {@render later(() => hideInstall())}
    </span>
  </section>
{/if}

{#if sheetOpen}
  <InstallSheet onclose={() => (sheetOpen = false)} opener={howToButton} />
{/if}

<style>
  /* 56 high in one row: the 44 buttons and 6 above and below (the 2 px border inside the 8). */
  .strip {
    box-sizing: border-box;
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    column-gap: var(--space-sm);
    row-gap: var(--space-xs);
    min-height: 56px;
    padding: 4px 6px;
    border: 2px solid color-mix(in srgb, var(--creme-attenuee) 40%, transparent);
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
  }

  /* The text keeps one line while the buttons fit beside it; else they wrap under it, at the right. */
  .message {
    flex: 1 1 auto;
    max-width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
    min-height: 44px;
  }

  .message :global(svg) {
    flex: none;
  }

  .text {
    font-size: var(--label-size);
    font-weight: 700;
    line-height: 20px;
  }

  .actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .action {
    min-height: var(--touch);
    height: var(--touch);
  }

  .close {
    width: var(--touch);
    height: var(--touch);
    padding: 0;
  }
</style>
