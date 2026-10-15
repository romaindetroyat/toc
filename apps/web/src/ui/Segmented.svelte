<script lang="ts" generics="T extends string">
  // A row of exclusive choices (WAI-ARIA radio group): one tab stop, arrows move and select.
  type Option = { value: T; label: string };

  type Props = {
    options: readonly Option[];
    value: T;
    /** Accessible name of the group. */
    label: string;
    onchange: (value: T) => void;
  };

  let { options, value, label, onchange }: Props = $props();

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

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as option, i (option.value)}
    <button
      type="button"
      role="radio"
      class="option"
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
    padding: 0 var(--space-sm);
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
