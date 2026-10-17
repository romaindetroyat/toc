<script lang="ts" generics="T extends string">
  // A row of exclusive choices (WAI-ARIA radio group): one tab stop, arrows move and select.
  // Optional, for the strength picker (03-UI-SPEC « Strength row »): a per-option title, the option
  // padding through --segmented-pad (default var(--space-sm)), a wrapped form on two rows and a
  // disabled state. Without them the group looks and behaves as it always did (the sound-test page).
  type Option = { value: T; label: string; title?: string };

  type Props = {
    options: readonly Option[];
    value: T;
    /** Accessible name of the group. */
    label: string;
    onchange: (value: T) => void;
    /** Two rows in one bordered block: a 6-column grid, the first three options span 2, the rest 3. */
    wrap?: boolean;
    /** 40 % opacity, no change, out of the tab order. */
    disabled?: boolean;
  };

  let { options, value, label, onchange, wrap = false, disabled = false }: Props = $props();

  let buttons = $state<(HTMLButtonElement | undefined)[]>([]);

  function onkeydown(event: KeyboardEvent, index: number) {
    const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const delta = step[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const next = options[(index + delta + options.length) % options.length];
    if (!next) return;
    onchange(next.value);
    buttons[(index + delta + options.length) % options.length]?.focus();
  }
</script>

<div
  class="segmented"
  class:wrap
  role="radiogroup"
  aria-label={label}
  aria-disabled={disabled ? "true" : undefined}
>
  {#each options as option, i (option.value)}
    <button
      type="button"
      role="radio"
      class="option"
      title={option.title}
      {disabled}
      aria-checked={option.value === value}
      tabindex={option.value === value ? 0 : -1}
      bind:this={buttons[i]}
      onclick={() => onchange(option.value)}
      onkeydown={(event) => onkeydown(event, i)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    border: 2px solid var(--creme);
    border-radius: var(--radius-button);
    overflow: hidden;
  }

  .option {
    flex: 1 1 0;
    min-width: var(--touch);
    min-height: var(--touch);
    padding: 0 var(--segmented-pad, var(--space-sm));
    border: 0;
    border-left: 2px solid var(--creme);
    background: transparent;
    color: var(--creme);
    font-size: var(--label-size);
    font-weight: 400;
    line-height: var(--label-line);
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .option:first-child {
    border-left: 0;
  }

  /* The wrapped form (narrow strength row): « Poulain Trotteur Galopeur » then « Pur-sang Champion ». */
  .segmented.wrap {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .wrap .option {
    grid-column: span 2;
    min-width: 0;
  }

  .wrap .option:nth-child(n + 4) {
    grid-column: span 3;
    border-top: 2px solid var(--creme);
  }

  .wrap .option:nth-child(4) {
    border-left: 0;
  }

  /* The group carries the 40 % (aria-disabled); its options must not dim a second time. */
  .option:disabled {
    opacity: 1;
    cursor: not-allowed;
  }

  /* The selected option is told apart by fill and weight, not by hue alone (cream on walnut). */
  .option[aria-checked="true"] {
    background: var(--creme);
    color: var(--noyer);
    font-weight: 700;
  }

  .option:focus-visible {
    outline-offset: -5px;
  }
</style>
