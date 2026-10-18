<script lang="ts">
  import { formatBackupCode } from "@toc/protocol";
  import { compte } from "../i18n/fr/compte.ts";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import Icon from "./Icon.svelte";
  import { showToast } from "./toast.svelte.ts";

  // « Ton code de secours » (04-UI-SPEC « Backup-code screen », D-02): shown once, full screen (never a
  // sheet: a stray tap must not close it). The cream panel shows the code in five groups that wrap
  // only between groups; « Copier le code »; the warning; « J’ai gardé mon code » asks first, and
  // its safe answer « Revoir mon code » is the primary, focused one. The leave guard (beforeunload,
  // the hash guard) comes with plan 04-09.
  type Props = {
    /** The code, 20 symbols, as the server sent it once. */
    code: string;
    /** « Étape 2 sur 2 » in the sign-up flow. */
    step?: string;
    /** The player confirmed they kept it. */
    onkept: () => void;
  };

  let { code, step, onkept }: Props = $props();

  const groups = $derived(code.match(/.{1,4}/g) ?? []);
  const formatted = $derived(formatBackupCode(code));
  /** « K 7 Q M, 2 X R A, … »: read one symbol at a time, the groups apart. */
  const spelled = $derived(groups.map((group) => [...group].join(" ")).join(", "));

  let heading = $state<HTMLHeadingElement | null>(null);
  let keptButton = $state<HTMLButtonElement | null>(null);
  let confirming = $state(false);

  // The focus lands on the heading when the screen appears.
  $effect(() => {
    heading?.focus();
  });

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
<main class="screen" data-backup-code>
  <div class="text">
    {#if step}<p class="t-label step">{step}</p>{/if}
    <h1 class="t-heading" tabindex="-1" bind:this={heading}>{compte.backup.heading}</h1>
    <p class="t-body body">{compte.backup.body}</p>
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
    onconfirm={() => {
      confirming = false;
      onkept();
    }}
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

  .body {
    margin-top: var(--space-sm);
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
