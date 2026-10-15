<script lang="ts">
  import { type PawnId, pawnColor } from "@toc/engine";
  import { trayLetters } from "../game/turnUi.ts";
  import { clavier } from "../i18n/fr/clavier.ts";
  import { game } from "../i18n/fr/game.ts";
  import KeyHint from "./KeyHint.svelte";

  type Props = {
    /** 2 to 4 knights too close to tell apart on the board. */
    options: readonly PawnId[];
    onpick: (pawn: PawnId) => void;
    onclose: () => void;
    /**
     * What this instance draws. « all »: the chips and « Choisir un autre cheval » together (the
     * computer's bar). In the compact mode of a phone held sideways (plan 01-47): « chips », the chips
     * stacked in the left strip in the hand's place; « close », the button alone, in the right strip.
     */
    part?: "all" | "chips" | "close";
    /** The compact mode: the button's short label « Autre cheval » (its accessible name stays whole). */
    compact?: boolean;
  };

  let { options, onpick, onclose, part = "all", compact = false }: Props = $props();

  const letters = $derived(trayLetters(options));
</script>

<!-- Disambiguation tray (UI-SPEC): one chip per knight, 44 wide x 56 high, with the same letter as the
     badge drawn over the knight on the board. It replaces the prompt; « Choisir un autre cheval »
     closes it and the card stays selected. -->
<div class="tray" class:column={part === "chips"} class:alone={part === "close"} data-tray>
  {#if part !== "close"}
    <ul class="chips">
      {#each options as pawn, i (pawn)}
        <li>
          <button
            type="button"
            class="chip"
            data-tray-option={pawn}
            aria-label={game.tray.chip(letters[i] ?? "", pawnColor(pawn))}
            onclick={() => onpick(pawn)}
          >
            <svg viewBox="0 0 110 190" width="22" height="38" focusable="false" aria-hidden="true">
              <use href={`#knight-${pawnColor(pawn)}`} />
            </svg>
            <span class="letter" aria-hidden="true">{letters[i]}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if part !== "chips"}
    <!-- Échap does what this button does: closeTray and back both return to the tray's flow. -->
    <button
      type="button"
      class="btn btn-secondary other"
      data-tray-close
      aria-label={game.buttons.otherHorse}
      aria-keyshortcuts="Escape"
      title={compact ? game.buttons.otherHorse : undefined}
      onclick={onclose}
    >
      {compact ? game.compact.otherHorse : game.buttons.otherHorse}
      <KeyHint label={clavier.keys.escape} />
    </button>
  {/if}
</div>

<style>
  .tray {
    flex: 1 1 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm) var(--space-md);
  }

  .chips {
    display: flex;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 56px;
    padding: 0;
    border: 2px solid var(--creme);
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:focus-visible {
    outline: 3px solid var(--ambre);
    outline-offset: 2px;
  }

  .letter {
    font-size: var(--label-size);
    font-weight: 700;
    line-height: 1;
  }

  .other {
    position: relative;
    margin-left: auto;
  }

  /* The compact mode's left strip: the chips stacked, 4 px apart, in the hand's place. */
  .tray.column {
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  .column .chips {
    flex-direction: column;
    gap: var(--space-xs);
  }

  /* The compact mode's right strip: « Autre cheval » alone, as wide as the strip's other buttons,
     two lines at most. */
  .tray.alone {
    flex: none;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }

  .alone .other {
    width: var(--strip-button, 56px);
    min-width: 0;
    margin-left: 0;
    padding: 2px 0;
    font-size: var(--label-size);
    letter-spacing: -0.01em;
    line-height: 1.2;
    text-align: center;
  }
</style>
