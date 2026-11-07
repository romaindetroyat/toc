<script lang="ts">
  // One number of « Mes chiffres » (plan 05-09; 05-UI-SPEC Panel 2): 72 high, bois sombre, radius 12,
  // padding 8; the number in Display 28 cream (tabular), its label under it in Label muted. Inside the
  // panel's <dl>: the label is the <dt> and the number the <dd>, read in that order, shown number first.
  // Never amber.
  type Props = {
    /** The test hook: parties, victoires, reussite. */
    name: string;
    label: string;
    value: string;
  };

  let { name, label, value }: Props = $props();
</script>

<div class="tile" data-number-tile={name}>
  <dt class="label t-label">{label}</dt>
  <dd class="value">{value}</dd>
</div>

<style>
  .tile {
    display: flex;
    flex-direction: column-reverse;
    justify-content: center;
    align-items: center;
    min-width: 0;
    height: 72px;
    padding: var(--space-sm);
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
  }

  .label,
  .value {
    margin: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value {
    color: var(--creme);
    font-family: var(--font-display);
    font-size: var(--display-size);
    font-weight: 700;
    line-height: 34px;
    font-variant-numeric: tabular-nums;
  }

  .label {
    color: var(--creme-attenuee);
    line-height: 20px;
  }
</style>
