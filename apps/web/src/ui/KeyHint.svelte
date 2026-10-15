<script lang="ts">
  // Key hint (UI-SPEC « Addendum 2026-10-14 — Raccourcis clavier », plan 01-28): the key that does what
  // its host does, as a small badge astride the host's top edge. Only computers show it (a fine pointer
  // that can hover); on phones it is not drawn at all. It is aria-hidden and lets every tap through:
  // the host keeps its size, its accessible name and its Tab stop (the host names itself with
  // aria-label and aria-keyshortcuts).
  type Props = {
    /** The key, as printed on the badge: a digit, a letter, « Entrée », « Échap », « ⌫ ». */
    label: string;
    /**
     * `corner`: astride the top edge near the right corner (buttons). `card`: astride the top edge of
     * the card's visible slice, right of its rank (the next card of the fan covers its right side).
     */
    at?: "corner" | "card";
  };

  let { label, at = "corner" }: Props = $props();
</script>

<kbd class="key-hint {at}" aria-hidden="true" data-key-hint={label}>{label}</kbd>

<style>
  .key-hint {
    position: absolute;
    top: -10px;
    z-index: 1;
    display: none;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-width: 20px;
    min-height: 20px;
    padding: 0 4px;
    border: 1px solid var(--creme);
    border-radius: 4px;
    background: var(--noyer);
    color: var(--creme);
    font-family: var(--font-ui);
    font-size: var(--label-size);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
  }

  .corner {
    right: 8px;
  }

  .card {
    left: 26px;
  }

  /* Computers only: a phone (no hover, coarse pointer) never shows a key. */
  @media (hover: hover) and (pointer: fine) {
    .key-hint {
      display: inline-flex;
    }
  }
</style>
