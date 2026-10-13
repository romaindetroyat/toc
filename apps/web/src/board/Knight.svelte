<script lang="ts">
  import type { Color } from "@toc/engine";

  type Props = {
    pawn: string;
    color: Color;
    /** Static anchor (cell centre) in board units; the feet stand on it. */
    x: number;
    y: number;
    /** Ring index of the cell the knight stands on, or -1 off the ring. */
    ring: number;
    /** 1 = head to the right (sprite default), -1 = mirrored. */
    facing?: 1 | -1;
    mover?: SVGGElement;
    arc?: SVGGElement;
    onselect?: () => void;
  };

  let {
    pawn,
    color,
    x,
    y,
    ring,
    facing = 1,
    mover = $bindable(),
    arc = $bindable(),
    onselect,
  }: Props = $props();

  const BODY: Record<Color, string> = {
    bleu: "#1A22E0",
    jaune: "#F5D000",
    rouge: "#D40100",
    vert: "#019C01",
  };
  const OUTLINE = "#2B1D12";
  const NOM: Record<Color, string> = { bleu: "bleu", jaune: "jaune", rouge: "rouge", vert: "vert" };

  function mix(a: string, b: string, t: number): string {
    const pa = [1, 3, 5].map((i) => Number.parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => Number.parseInt(b.slice(i, i + 2), 16));
    const out = pa.map((v, i) => Math.round(v + ((pb[i] ?? 0) - v) * t));
    return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }

  const body = $derived(BODY[color]);
  const light = $derived(mix(body, "#FFFFFF", 0.35));
  const dark = $derived(mix(body, OUTLINE, 0.4));

  // Staunton knight, head to the right. Drawing box 110 x 190, feet at the bottom centre (55, 186).
  const SILHOUETTE =
    "M26 160 C24 128 20 98 33 66 C37 50 39 34 45 14 L58 30 C72 32 88 46 99 68 C105 79 103 91 94 92 " +
    "C86 93 79 87 71 85 C66 98 70 112 82 131 C88 143 91 152 91 160 Z";
  const BASE = "M26 160 L91 160 L98 168 L98 176 C98 182 88 186 55 186 C22 186 12 182 12 176 L12 168 Z";

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onselect?.();
    }
  }
</script>

<!-- Outer group: static anchor (attribute). Inner groups: animated by the Web Animations API. -->
<g
  transform={`translate(${x} ${y})`}
  data-pawn={pawn}
  data-ring={ring}
  role="button"
  tabindex="0"
  aria-label={`Cavalier ${NOM[color]}`}
  onclick={() => onselect?.()}
  {onkeydown}
>
  <g data-role="mover" bind:this={mover}>
    <g data-role="arc" bind:this={arc}>
      <g transform={`scale(${facing} 1)`}>
        <!-- Shared pre-baked shadow, no filter. -->
        <ellipse cx="6" cy="4" rx="60" ry="14" fill={OUTLINE} fill-opacity="0.28" />
        <g transform="translate(-55 -186)">
          <defs>
            <linearGradient id={`kn-body-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color={light} />
              <stop offset="0.5" stop-color={body} />
              <stop offset="1" stop-color={dark} />
            </linearGradient>
            <radialGradient id={`kn-glow-${color}`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.35" />
              <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
            </radialGradient>
            <clipPath id={`kn-clip-${color}`}><path d={SILHOUETTE} /></clipPath>
          </defs>
          <path d={BASE} fill={`url(#kn-body-${color})`} stroke={OUTLINE} stroke-width="3" stroke-linejoin="round" />
          <path d={SILHOUETTE} fill={`url(#kn-body-${color})`} stroke={OUTLINE} stroke-width="3" stroke-linejoin="round" />
          <g clip-path={`url(#kn-clip-${color})`}>
            <ellipse cx="62" cy="52" rx="20" ry="28" fill={`url(#kn-glow-${color})`} />
            <!-- Faint painted-wood grain: static strokes. -->
            <path d="M34 120 C46 112 62 114 86 124" stroke={OUTLINE} stroke-opacity="0.16" stroke-width="2" fill="none" />
            <path d="M30 100 C44 94 58 96 74 104" stroke={OUTLINE} stroke-opacity="0.14" stroke-width="2" fill="none" />
            <path d="M32 138 C46 134 62 135 84 142" stroke={OUTLINE} stroke-opacity="0.16" stroke-width="2" fill="none" />
          </g>
          <circle cx="76" cy="52" r="3.5" fill={OUTLINE} />
          <circle cx="97" cy="80" r="2.2" fill={OUTLINE} fill-opacity="0.7" />
        </g>
        <!-- Invisible hit area, big enough for a finger. -->
        <circle cx="0" cy="-92" r="72" fill="transparent" />
      </g>
    </g>
  </g>
</g>
