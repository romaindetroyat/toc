<script lang="ts">
  import { formatBackupCode } from "@toc/protocol";
  import { compte } from "../i18n/fr/compte.ts";
  import { holdUpdates } from "../pwa/update.svelte.ts";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import Icon from "./Icon.svelte";
  import { setLeaveGuard } from "./leaveGuard.ts";
  import { showToast } from "./toast.svelte.ts";

  // « Ton code de secours » (04-UI-SPEC « Backup-code screen », D-02): shown once, full screen (never a
  // sheet: a stray tap must not close it). The cream panel shows the code in five groups that wrap
  // only between groups; « Copier le code »; the warning; « J’ai gardé mon code » asks first, and
  // its safe answer « Revoir mon code » is the primary, focused one.
  // Plan 04-09: the three forms (after a sign-up, a recovery, a regeneration: the heading and the extra
  // line), and the leave guard. While the screen is up, beforeunload is armed (the browser's own
  // « Quitter la page ? »), and a hash change away (the back button, a notification) is undone, before
  // the router acts on it (leaveGuard.ts), and opens the same confirmation. Only « Oui, je l’ai
  // gardé » lets it go.
  type Props = {
    /** The code, 20 symbols, as the server sent it once. */
    code: string;
    /** « Étape 2 sur 2 » in the sign-up flow. */
    step?: string;
    /** Which screen: after a sign-up (default), a recovery or « Créer un nouveau code ». */
    form?: "signup" | "recovery" | "regeneration";
    /** The player confirmed they kept it. */
    onkept: () => void;
  };

  let { code, step, form = "signup", onkept }: Props = $props();

  const groups = $derived(code.match(/.{1,4}/g) ?? []);
  const formatted = $derived(formatBackupCode(code));
  /** « K 7 Q M, 2 X R A, … »: read one symbol at a time, the groups apart. */
  const spelled = $derived(groups.map((group) => [...group].join(" ")).join(", "));
  const title = $derived(form === "signup" ? compte.backup.heading : compte.backup.newHeading);
  const extra = $derived(
    form === "recovery"
      ? compte.backup.afterRecovery
      : form === "regeneration"
        ? compte.backup.afterRegeneration
        : null,
  );

  let heading = $state<HTMLHeadingElement | null>(null);
  let keptButton = $state<HTMLButtonElement | null>(null);
  let confirming = $state(false);

  // Plan 04-08: no « Mettre à jour » while the code is on screen (it would be lost).
  $effect(() => holdUpdates());

  // The focus lands on the heading when the screen appears.
  $effect(() => {
    heading?.focus();
  });

  // The leave guard (plan 04-09): armed until « Oui, je l’ai gardé ».
  let leaving = false;

  $effect(() => {
    const here = location.href;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving) return;
      event.preventDefault();
      // Older browsers need a value to show their dialog.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    // The router (App.svelte) asks this guard first on each hash change: the change is undone (the
    // address back to this screen's, no new hashchange) and the confirmation opens.
    const unguard = setLeaveGuard(() => {
      if (leaving || location.href === here) return false;
      history.pushState(history.state, "", here);
      confirming = true;
      return true;
    });
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      unguard();
    };
  });

  function confirmed() {
    leaving = true;
    confirming = false;
    onkept();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatted);
      showToast(compte.backup.copied);
    } catch {
      showToast(compte.backup.copyFailed);
    }
  }
</script>

<!-- DOM order = the computer's order: the text, the code, the warning, the buttons. -->
<main class="screen" data-backup-code={form}>
  <div class="text">
    {#if step}<p class="t-label step">{step}</p>{/if}
    <h1 class="t-heading" tabindex="-1" bind:this={heading}>{title}</h1>
    <p class="t-body body">{compte.backup.body}</p>
    {#if extra !== null}<p class="t-body extra" data-backup-extra>{extra}</p>{/if}
  </div>
  <div class="panel tabular" role="group" aria-label={compte.backup.groupLabel(spelled)} data-code>
    {#each groups as group, i (i)}{#if i > 0}-<wbr />{/if}<span class="group">{group}</span>{/each}
  </div>
  <p class="t-label warning">
    <Icon name="triangle-alert" size={20} />
    <span>{compte.backup.warning}</span>
  </p>
  <div class="buttons">
    <button type="button" class="btn btn-secondary" onclick={copy} data-copy-code>
      <Icon name="copy" size={20} />
      {compte.backup.copy}
    </button>
    <button
      type="button"
      class="btn btn-primary"
      bind:this={keptButton}
      aria-haspopup="dialog"
      onclick={() => (confirming = true)}
    >
      {compte.backup.kept}
    </button>
  </div>
</main>

{#if confirming}
  <ConfirmDialog
    title={compte.backup.confirm.title}
    body={compte.backup.confirm.body}
    safeLabel={compte.backup.confirm.safe}
    otherLabel={compte.backup.confirm.other}
    destructive={false}
    opener={keptButton}
    oncancel={() => (confirming = false)}
    onconfirm={confirmed}
  />
{/if}

<style>
  /* Computer: one centred column of 480: step, heading, body, the code, the warning, then the two
     buttons side by side (04-UI-SPEC « Layouts and fit »). */
  .screen {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-md);
    width: min(480px, 100%);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(var(--space-md) + env(safe-area-inset-top, 0px))
      calc(var(--space-md) + env(safe-area-inset-right, 0px))
      calc(var(--space-md) + env(safe-area-inset-bottom, 0px))
      calc(var(--space-md) + env(safe-area-inset-left, 0px));
  }

  h1,
  p {
    margin: 0;
  }

  /* The h1 takes the focus on a step change (tabindex -1) for screen readers; it is not a control,
     so it shows no ring. */
  h1:focus,
  h1:focus-visible {
    outline: none;
  }

  .text {
    display: flex;
    flex-direction: column;
  }

  .step {
    margin-bottom: var(--space-xs);
    color: var(--creme-attenuee);
    font-weight: 700;
  }

  .body,
  .extra {
    margin-top: var(--space-sm);
  }

  .extra {
    color: var(--creme-attenuee);
  }

  .warning {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  .warning :global(svg) {
    flex: none;
  }

  .panel {
    padding: var(--space-md);
    border-radius: var(--radius-button);
    background: var(--creme);
    color: var(--noyer);
    font-size: var(--heading-size);
    font-weight: 700;
    line-height: var(--heading-line);
    letter-spacing: 0.06em;
    text-align: center;
    user-select: all;
    -webkit-user-select: all;
  }

  .group {
    white-space: nowrap;
  }

  .buttons {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }

  .buttons .btn {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 var(--space-sm);
  }

  /* Phone held sideways from 640 wide: two columns, 24 apart; the text and the warning at the left,
     the code and the buttons (stacked, full width) at the right. The columns are at most 384, not the
     UI-SPEC's 360: its 312.3 px for the code left out the 0.06em letter-spacing (about 29 px), and
     the code must hold on one line at 844 × 390 (312 + 29 + 2 × 16 of padding = 373). */
  @media (orientation: landscape) and (max-width: 959.98px) and (min-width: 640px),
    (orientation: landscape) and (max-height: 599.98px) and (min-width: 640px) {
    .screen {
      display: grid;
      grid-template-columns: minmax(0, 384px) minmax(0, 384px);
      grid-template-rows: auto auto;
      align-content: center;
      justify-content: center;
      column-gap: var(--space-lg);
      row-gap: var(--space-md);
      width: 100%;
    }

    .text {
      grid-column: 1;
      grid-row: 1;
      align-self: end;
    }

    .warning {
      grid-column: 1;
      grid-row: 2;
    }

    .panel {
      grid-column: 2;
      grid-row: 1;
      align-self: end;
    }

    .buttons {
      grid-column: 2;
      grid-row: 2;
      flex-direction: column;
      margin-top: 0;
    }

    .buttons .btn {
      flex: none;
      width: 100%;
    }
  }

  /* One column under 640 wide and upright: the buttons stacked, full width; the page scrolls. */
  @media (max-width: 639.98px), (orientation: portrait) {
    .screen {
      justify-content: flex-start;
    }

    .buttons {
      flex-direction: column;
    }

    .buttons .btn {
      flex: none;
      width: 100%;
    }
  }
</style>
