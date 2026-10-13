<script lang="ts">
  import { COLORS } from "@toc/engine";

  // The sixteen knights use four <symbol>s, one per colour (D-09, FX-02). Each symbol shows
  // Romain's own knight picture (assets/cavaliers/cavaliers-source.webp), cut into one sprite per
  // colour by tools/build-knights.mjs: head to the right, feet on the bottom edge of the 110 x 190
  // pawn footprint. Symbol ids: knight-bleu, knight-jaune, knight-rouge, knight-vert (plus
  // knight-shadow). Mounted once for the whole document (App.svelte): the board pawns and the
  // colour tiles of the launch screen reference the same ids with <use>, so they exist only once.
  const OUTLINE = "#2B1D12";
</script>

<!-- Zero-size, not display:none: some browsers skip gradients that live in a display:none tree. -->
<svg class="knight-defs" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <!-- One pre-baked shadow for every pawn, offset +6 / +4 from the feet. -->
    <ellipse id="knight-shadow" cx="6" cy="4" rx="60" ry="14" fill={OUTLINE} fill-opacity="0.28" />
    {#each COLORS as color (color)}
      <symbol id={`knight-${color}`} viewBox="0 0 110 190">
        <image href={`./cavaliers/${color}.webp`} x="0" y="0" width="110" height="190" />
      </symbol>
    {/each}
  </defs>
</svg>

<style>
  .knight-defs {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    pointer-events: none;
  }
</style>
