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
     * The compact bar of a phone held sideways (plan 01-37): the chips on one line in the prompt's
     * place, « Choisir un autre cheval » in the buttons' area (--band-buttons) at the right.
     */
    band?: boolean;
  };

  let { options, onpick, onclose, band = false }: Props = $props();

  const letters = $derived(trayLetters(options));
</script>

<!-- Disambiguation tray (UI-SPEC): one chip per knight, 44 wide x 56 high, with the same letter as the
     badge drawn over the knight on the board. It replaces the prompt; « Choisir un autre cheval »
     closes it and the card stays selected. -->
<div class="tray" class:band data-tray>
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
  <!-- Échap does what this button does: closeTray and back both return to the tray's flow. -->
  <button
    type="button"
    class="btn btn-secondary other"
    data-tray-close
    aria-label={game.buttons.otherHorse}
    aria-keyshortcuts="Escape"
    onclick={onclose}
  >
    {game.buttons.otherHorse}
    <KeyHint label={clavier.keys.escape} />
  </button>
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

  /* In the band: the same two columns as the action zone's, the chips at the left on one line, the
     button filling the buttons' area, Label 14 bold on two lines at most. */
  .tray.band {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--band-buttons, 184px);
    column-gap: var(--space-sm);
    align-items: center;
    width: 100%;
  }

  .band .chips {
    flex-wrap: nowrap;
    min-width: 0;
  }

  .band .other {
    width: 100%;
    margin-left: 0;
    padding: 0 var(--space-sm);
    font-size: var(--label-size);
    line-height: 1.2;
    text-align: center;
  }
</style>
