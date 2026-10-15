<script lang="ts">
  // A labelled on/off switch (WAI-ARIA switch): the whole row is the 44 px target, the label is its
  // accessible name and the helper, when there is one, its description.
  type Props = {
    label: string;
    checked: boolean;
    onchange: (checked: boolean) => void;
    /** Greyed out because another setting makes it moot; it still works. */
    dimmed?: boolean;
    disabled?: boolean;
    /** Smaller print under the label. */
    helper?: string;
  };

  let { label, checked, onchange, dimmed = false, disabled = false, helper }: Props = $props();

  const uid = $props.id();
  const helperId = `${uid}-helper`;
</script>

<div class="row" class:dimmed={dimmed || disabled}>
  <button
    type="button"
    role="switch"
    class="switch"
    aria-checked={checked}
    aria-describedby={helper ? helperId : undefined}
    {disabled}
    onclick={() => onchange(!checked)}
  >
    <span class="label">{label}</span>
    <span class="track" aria-hidden="true"><span class="thumb"></span></span>
  </button>
  {#if helper}
    <p class="helper" id={helperId}>{helper}</p>
  {/if}
</div>

<style>
  .row.dimmed {
    opacity: 0.4;
  }

  .switch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    width: 100%;
    min-height: var(--touch);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--creme);
    font-size: var(--body-size);
    line-height: var(--body-line);
    text-align: left;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .switch:disabled {
    opacity: 1;
  }

  .label {
    min-width: 0;
  }

  /* On is told apart by the position of the thumb and the cream fill, not by a hue. */
  .track {
    position: relative;
    flex: none;
    width: 52px;
    height: 32px;
    border: 2px solid var(--creme);
    border-radius: 999px;
    background: transparent;
  }

  .thumb {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--creme);
    transition: transform 150ms ease;
  }

  .switch[aria-checked="true"] .track {
    background: var(--brun-aide-memoire);
  }

  .switch[aria-checked="true"] .thumb {
    transform: translateX(20px);
  }

  @media (prefers-reduced-motion: reduce) {
    .thumb {
      transition: none;
    }
  }

  .helper {
    margin: var(--space-xs) 0 0;
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: var(--label-line);
  }
</style>
