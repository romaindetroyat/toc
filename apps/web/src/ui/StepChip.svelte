<script lang="ts">
  import { game } from "../i18n/fr/game.ts";

  type Props = {
    /** The number of steps written on the chip. */
    steps: number;
    /** False when the 7 could no longer be finished after these steps: a tap explains why. */
    enabled: boolean;
    onpick: (steps: number) => void;
  };

  let { steps, enabled, onpick }: Props = $props();
</script>

<!-- A step chip of the 7 splitter (UI-SPEC): 44 x 44. It stays tappable when it is off (aria-disabled, not
     disabled) so that a tap can say why. -->
<button
  type="button"
  class="chip tabular"
  data-step={steps}
  aria-label={game.seven.chipAria(steps)}
  aria-disabled={!enabled}
  onclick={() => onpick(steps)}
>
  {steps}
</button>

<style>
  .chip {
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 2px solid var(--creme);
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
    font-family: var(--font-display);
    font-size: var(--heading-size);
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:not([aria-disabled="true"]) {
    border-color: var(--ambre);
  }

  .chip:focus-visible {
    outline: 3px solid var(--ambre);
    outline-offset: 2px;
  }
</style>
