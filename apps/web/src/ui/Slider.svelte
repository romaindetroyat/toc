<script lang="ts">
  // A labelled slider on a native range input (keyboard and touch come for free). The thumb is a
  // 44 px touch target with a smaller visible knob.
  type Props = {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onchange: (value: number) => void;
    /** Spoken and shown value, e.g. « 30 % ». */
    valueText?: (value: number) => string;
    disabled?: boolean;
    /** Greyed out because another setting makes it moot. */
    dimmed?: boolean;
  };

  let {
    label,
    value,
    min = 0,
    max = 100,
    step = 1,
    onchange,
    valueText = (v) => String(v),
    disabled = false,
    dimmed = false,
  }: Props = $props();

  const uid = $props.id();
  const inputId = `${uid}-input`;
  const fill = $derived(max === min ? 0 : ((value - min) / (max - min)) * 100);
</script>

<div class="slider" class:dimmed={dimmed || disabled}>
  <div class="head">
    <label for={inputId}>{label}</label>
    <span class="value tabular" aria-hidden="true">{valueText(value)}</span>
  </div>
  <input
    id={inputId}
    type="range"
    {min}
    {max}
    {step}
    {value}
    {disabled}
    aria-valuetext={valueText(value)}
    style:--fill="{fill}%"
    oninput={(event) => onchange(Number(event.currentTarget.value))}
  />
</div>

<style>
  .slider.dimmed {
    opacity: 0.4;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .value {
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  input {
    display: block;
    width: 100%;
    height: var(--touch);
    margin: 0;
    padding: 0;
    background: transparent;
    cursor: pointer;
    appearance: none;
    touch-action: pan-y;
    -webkit-tap-highlight-color: transparent;
  }

  /* The whole block is dimmed by `.dimmed`: the input is not dimmed a second time. */
  input:disabled {
    opacity: 1;
    cursor: not-allowed;
  }

  input::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(
      to right,
      var(--creme) 0 var(--fill),
      var(--brun-aide-memoire) var(--fill) 100%
    );
  }

  input::-moz-range-track {
    height: 8px;
    border-radius: 999px;
    background: var(--brun-aide-memoire);
  }

  input::-moz-range-progress {
    height: 8px;
    border-radius: 999px;
    background: var(--creme);
  }

  /* A 44 px thumb carrying a 24 px cream knob drawn with a radial gradient. */
  input::-webkit-slider-thumb {
    width: var(--touch);
    height: var(--touch);
    margin-top: -18px;
    border: 0;
    border-radius: 50%;
    background: radial-gradient(circle, var(--creme) 0 11px, var(--noyer) 11px 13px, transparent 13px);
    appearance: none;
  }

  input::-moz-range-thumb {
    width: var(--touch);
    height: var(--touch);
    border: 0;
    border-radius: 50%;
    background: radial-gradient(circle, var(--creme) 0 11px, var(--noyer) 11px 13px, transparent 13px);
  }
</style>
