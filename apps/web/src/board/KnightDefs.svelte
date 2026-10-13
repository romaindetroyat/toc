<script lang="ts">
  import { COLORS, type Color } from "@toc/engine";

  // The sixteen knights are drawn from four <symbol>s, one per colour (D-09, FX-02). Painted wood:
  // a top-to-bottom gradient, one soft highlight, a few grain strokes clipped to the silhouette,
  // a 3-unit walnut outline, matt. No SVG filter, no blur, nothing animated per frame.
  // Symbol ids: knight-bleu, knight-jaune, knight-rouge, knight-vert (plus knight-shadow).
  // Mounted once for the whole document (App.svelte): the board pawns and the colour tiles of the
  // launch screen reference the same ids with <use>, so the ids must exist only once.

  const BODY: Record<Color, string> = {
    bleu: "#1A22E0",
    jaune: "#F5D000",
    rouge: "#D40100",
    vert: "#019C01",
  };
  const OUTLINE = "#2B1D12";

  function mix(a: string, b: string, t: number): string {
    const pa = [1, 3, 5].map((i) => Number.parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => Number.parseInt(b.slice(i, i + 2), 16));
    const out = pa.map((v, i) => Math.round(v + ((pb[i] ?? 0) - v) * t));
    return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }

  const knights = COLORS.map((color) => ({
    color,
    body: BODY[color],
    light: mix(BODY[color], "#FFFFFF", 0.35),
    dark: mix(BODY[color], OUTLINE, 0.4),
  }));

  // Staunton knight, head to the right. Drawing box 110 x 190, feet at the bottom centre (55, 186).
  const SILHOUETTE =
    "M26 160 C24 128 20 98 33 66 C37 50 39 34 45 14 L58 30 C72 32 88 46 99 68 C105 79 103 91 94 92 " +
    "C86 93 79 87 71 85 C66 98 70 112 82 131 C88 143 91 152 91 160 Z";
  const BASE =
    "M26 160 L91 160 L98 168 L98 176 C98 182 88 186 55 186 C22 186 12 182 12 176 L12 168 Z";
</script>

<!-- Zero-size, not display:none: some browsers skip gradients that live in a display:none tree. -->
<svg class="knight-defs" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <!-- One pre-baked shadow for every pawn, offset +6 / +4 from the feet. -->
    <ellipse id="knight-shadow" cx="6" cy="4" rx="60" ry="14" fill={OUTLINE} fill-opacity="0.28" />
    <radialGradient id="knight-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.35" />
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
    </radialGradient>
    <clipPath id="knight-clip"><path d={SILHOUETTE} /></clipPath>

    {#each knights as knight (knight.color)}
      <linearGradient id={`knight-body-${knight.color}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={knight.light} />
        <stop offset="0.5" stop-color={knight.body} />
        <stop offset="1" stop-color={knight.dark} />
      </linearGradient>

      <symbol id={`knight-${knight.color}`} viewBox="0 0 110 190">
        <path
          d={BASE}
          fill={`url(#knight-body-${knight.color})`}
          stroke={OUTLINE}
          stroke-width="3"
          stroke-linejoin="round"
        />
        <!-- Bevel of the base: a lit edge above, a shaded one below. -->
        <path d="M17 168 L93 168" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="2" fill="none" />
        <path
          d="M15 178 C26 183 42 184.5 55 184.5 C68 184.5 84 183 95 178"
          stroke={OUTLINE}
          stroke-opacity="0.3"
          stroke-width="2"
          fill="none"
        />
        <path
          d={SILHOUETTE}
          fill={`url(#knight-body-${knight.color})`}
          stroke={OUTLINE}
          stroke-width="3"
          stroke-linejoin="round"
        />
        <!-- Highlight, grain and mane strokes, all clipped to the silhouette. -->
        <g clip-path="url(#knight-clip)">
          <ellipse cx="62" cy="52" rx="20" ry="28" fill="url(#knight-glow)" />
          <path d="M34 120 C46 112 62 114 86 124" stroke={OUTLINE} stroke-opacity="0.16" stroke-width="2" fill="none" />
          <path d="M30 100 C44 94 58 96 74 104" stroke={OUTLINE} stroke-opacity="0.14" stroke-width="2" fill="none" />
          <path d="M32 138 C46 134 62 135 84 142" stroke={OUTLINE} stroke-opacity="0.16" stroke-width="2" fill="none" />
          <path d="M28 62 C38 62 45 68 48 76" stroke={OUTLINE} stroke-opacity="0.32" stroke-width="3" fill="none" />
          <path d="M26 82 C37 82 44 88 47 97" stroke={OUTLINE} stroke-opacity="0.32" stroke-width="3" fill="none" />
          <path d="M26 102 C36 102 43 108 46 117" stroke={OUTLINE} stroke-opacity="0.28" stroke-width="3" fill="none" />
        </g>
        <!-- Eye and nostril. -->
        <circle cx="76" cy="52" r="3.5" fill={OUTLINE} />
        <circle cx="77.2" cy="50.8" r="1.1" fill="#FFFFFF" fill-opacity="0.7" />
        <circle cx="97" cy="80" r="2.2" fill={OUTLINE} fill-opacity="0.7" />
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
