<script lang="ts">
  import { markPath, PALETTE, SEAT_MARKS } from "@toc/board";
  import { COLORS } from "@toc/engine";

  // The sixteen knights use four <symbol>s, one per colour (D-09, FX-02). Each symbol shows
  // Romain's own knight picture (assets/cavaliers/cavaliers-source.webp), cut into one sprite per
  // colour by tools/build-knights.mjs: head to the right, feet on the bottom edge of the 110 x 190
  // pawn footprint. Symbol ids: knight-bleu, knight-jaune, knight-rouge, knight-vert (plus
  // knight-shadow and the marks knight-mark-{couleur}). Mounted once for the whole document (App.svelte): the board pawns and the
  // colour tiles of the launch screen reference the same ids with <use>, so they exist only once.
  const OUTLINE = "#2B1D12";

  // Plan 05-02 (APP-05, D-11, D-14): the seat's shape on the knight's base, its own symbol
  // knight-mark-{couleur} in the same 110 x 190 footprint, drawn over the knight by the board pawns
  // and the knight tray only (never by the card back, the colour and seat tiles or the overlay's
  // ghost, which use knight-{couleur} too: 05-RESEARCH Pitfall 7). A cream disc of 60 units with a
  // 3-unit ink line, the shape of 40 units in the seat colour with a 3-unit ink stroke. Centred on the
  // vertical axis (x 55) and on the sprite's pedestal (y 152: the pedestal's bulge spans about 147 to
  // 175 above the foot plate, so the disc covers the base and the collar, never the legs or the
  // neck). The shapes are symmetric, so the mirror of a left-facing knight leaves them unchanged.
  const MARK = { cx: 55, cy: 152, disc: 30, glyph: 20, line: 3 } as const;
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
      <symbol id={`knight-mark-${color}`} viewBox="0 0 110 190">
        <circle
          data-mark-disc
          cx={MARK.cx}
          cy={MARK.cy}
          r={MARK.disc - MARK.line / 2}
          fill={PALETTE.cream}
          stroke={PALETTE.ink}
          stroke-width={MARK.line}
        />
        <path
          d={markPath(SEAT_MARKS[color], MARK.cx, MARK.cy, MARK.glyph)}
          fill={PALETTE.hex[color]}
          stroke={PALETTE.ink}
          stroke-width={MARK.line}
          stroke-linejoin="round"
        />
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
