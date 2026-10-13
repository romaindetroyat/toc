<script lang="ts">
  import { rotatePoint } from "@toc/board";
  import { type Color, type PawnId, pawnColor, type RenderState } from "@toc/engine";
  import type { Point } from "@toc/board";
  import { type TurnUiState, trayLetters } from "../game/turnUi.ts";
  import { game } from "../i18n/fr/game.ts";
  import { settings } from "../settings/store.svelte.ts";
  import { anchorOf } from "./geometry.ts";

  type Props = {
    /** `under` is drawn behind the knights (glow, halos, path); `over` in front (ghost, badges). */
    layer: "under" | "over";
    /** Board units per screen pixel: text and badges are sized in screen pixels. */
    px: number;
    /** Clockwise quarter turns of the board toward the human. */
    k: number;
    render: RenderState;
    ui: TurnUiState;
    /** Knights that can be played with the selected card. */
    candidates: readonly PawnId[];
    /** The knight the player tapped (previewed); null before. */
    selected: PawnId | null;
    /** Valet: the knight to swap with, once chosen. */
    target?: PawnId | null;
  };

  let { layer, px, k, render, ui, candidates, selected, target = null }: Props = $props();

  const AMBER = "#FFB02E";
  const WALNUT = "#2B1D12";
  const CREAM = "#FFF8E1";
  const BRICK = "#A32018";
  /** Footprint of a knight in board units; the body centre stands 92 units above the feet. */
  const FOOTPRINT = 110;
  const BODY = 92;
  const HALO_R = FOOTPRINT / 2 + 14;

  /** Last card slot of each seat on the felt (UI-SPEC Tapis), unrotated board units. */
  const SLOT: Record<Color, Point> = {
    bleu: [1280, 1570],
    jaune: [990, 1280],
    rouge: [1280, 990],
    vert: [1570, 1280],
  };

  const still = $derived(settings.reduceMotion);
  const preview = $derived(ui.kind === "preview" ? ui : null);

  function pawnAt(pawn: PawnId): Point {
    return anchorOf(render.pawns[pawn], k);
  }

  const points = $derived.by((): Point[] => {
    if (preview === null || selected === null) return [];
    return [pawnAt(selected), ...preview.path.map((place) => anchorOf(place, k))];
  });
  const polyline = $derived(points.map(([x, y]) => `${x},${y}`).join(" "));
  const destination = $derived(points.length > 1 ? (points[points.length - 1] ?? null) : null);

  // A chevron every three cells, turned along the path.
  const chevrons = $derived(
    points.slice(1).flatMap((to, j) => {
      const from = points[j];
      if (j % 3 !== 1 || from === undefined) return [];
      const angle = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
      return [{ x: (from[0] + to[0]) / 2, y: (from[1] + to[1]) / 2, angle }];
    }),
  );

  const badge = $derived.by((): string | null => {
    if (preview === null) return null;
    const d = preview.description;
    if (d.verb === "exit") return null;
    return d.verb === "back" ? game.preview.minus(d.steps) : game.preview.plus(d.steps);
  });

  const ghostColor = $derived(selected === null ? null : pawnColor(selected));

  // Valet: two S-shaped dashed arrows between the knights' bodies that cross half way, and a ghost of each
  // knight at the other's place.
  const swap = $derived(preview?.swap ?? null);
  type Arrow = { d: string; tip: Point; angle: number };
  const arrows = $derived.by((): Arrow[] => {
    if (swap === null) return [];
    const a = pawnAt(swap.a);
    const b = pawnAt(swap.b);
    const from: Point = [a[0], a[1] - BODY];
    const to: Point = [b[0], b[1] - BODY];
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy) || 1;
    const bend = Math.max(40, length * 0.2);
    const nx = (-dy / length) * bend;
    const ny = (dx / length) * bend;
    const one = (p: Point, q: Point, sign: 1 | -1): Arrow => {
      const ux = q[0] - p[0];
      const uy = q[1] - p[1];
      const c1: Point = [p[0] + ux / 3 + sign * nx, p[1] + uy / 3 + sign * ny];
      const c2: Point = [p[0] + (2 * ux) / 3 - sign * nx, p[1] + (2 * uy) / 3 - sign * ny];
      const angle = (Math.atan2(q[1] - c2[1], q[0] - c2[0]) * 180) / Math.PI;
      return {
        d: `M ${p[0]} ${p[1]} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${q[0]} ${q[1]}`,
        tip: q,
        angle,
      };
    };
    return [one(from, to, 1), one(to, from, 1)];
  });
  const ghosts = $derived(
    swap === null
      ? []
      : [
          { pawn: swap.a, at: anchorOf(swap.aTo, k) },
          { pawn: swap.b, at: anchorOf(swap.bTo, k) },
        ],
  );

  // The tray names the knights it offers with the letters of its chips.
  const lettered = $derived(
    ui.kind === "tray"
      ? ui.options.map((pawn, i) => ({ pawn, letter: trayLetters(ui.options)[i] ?? "" }))
      : [],
  );

  // The seat whose turn it is: a glow behind its stable and a ring around its felt slot.
  const turnSeat = $derived(render.phase === "play" ? render.turn : null);
  const glow = $derived.by((): Point | null => {
    if (turnSeat === null) return null;
    const stables = ([0, 1, 2, 3] as const).map((slot) =>
      anchorOf({ z: "stable", color: turnSeat, slot }, k),
    );
    return [
      stables.reduce((sum, [x]) => sum + x, 0) / stables.length,
      stables.reduce((sum, [, y]) => sum + y, 0) / stables.length,
    ];
  });
  const seatSlot = $derived(turnSeat === null ? null : rotatePoint(SLOT[turnSeat], k));
</script>

{#if layer === "under"}
  <g data-overlay="under" pointer-events="none">
    <defs>
      <radialGradient id="seat-glow">
        <stop offset="0" stop-color={AMBER} stop-opacity="0.3" />
        <stop offset="1" stop-color={AMBER} stop-opacity="0" />
      </radialGradient>
    </defs>

    {#if glow !== null && turnSeat !== null}
      <circle data-active-seat={turnSeat} cx={glow[0]} cy={glow[1]} r="260" fill="url(#seat-glow)" />
    {/if}
    {#if seatSlot !== null}
      <rect
        x={seatSlot[0] - 80}
        y={seatSlot[1] - 112}
        width="160"
        height="224"
        rx="12"
        fill="none"
        stroke={AMBER}
        stroke-width={4 * px}
      />
    {/if}

    {#each candidates as pawn (pawn)}
      {@const [x, y] = pawnAt(pawn)}
      {#if pawn !== selected && pawn !== target}
        <g data-halo={pawn} transform={`translate(${x} ${y - BODY})`}>
          <g class="pulse" class:still>
            <circle r={HALO_R - 4} fill="none" stroke={WALNUT} stroke-width="4" />
            <circle r={HALO_R + 2} fill="none" stroke={AMBER} stroke-width="8" />
          </g>
        </g>
      {/if}
    {/each}

    {#each [selected, target] as chosen, i (i)}
      {#if chosen !== null}
        {@const [x, y] = pawnAt(chosen)}
        <g data-selected={chosen} transform={`translate(${x} ${y - BODY})`}>
          <circle r={HALO_R - 4} fill={AMBER} fill-opacity="0.35" />
          <circle r={HALO_R + 1} fill="none" stroke={AMBER} stroke-width="10" />
        </g>
      {/if}
    {/each}

    {#if points.length > 1}
      <g data-path>
        <polyline
          points={polyline}
          fill="none"
          stroke={CREAM}
          stroke-width="16"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <polyline
          points={polyline}
          fill="none"
          stroke={WALNUT}
          stroke-width="10"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-dasharray="28 24"
        />
        {#each chevrons as c, i (i)}
          <path
            d="M -12 -14 L 16 0 L -12 14 Z"
            fill={WALNUT}
            stroke={CREAM}
            stroke-width="4"
            stroke-linejoin="round"
            transform={`translate(${c.x} ${c.y}) rotate(${c.angle})`}
          />
        {/each}
      </g>
    {/if}
  </g>
{:else}
  <g data-overlay="over" pointer-events="none">
    {#if destination !== null && ghostColor !== null}
      <g data-ghost transform={`translate(${destination[0]} ${destination[1]})`}>
        <ellipse cx="0" cy="-2" rx="70" ry="26" fill="none" stroke={CREAM} stroke-width="8" />
        <ellipse cx="0" cy="-2" rx="70" ry="26" fill="none" stroke={WALNUT} stroke-width="4" />
        <use
          href={`#knight-${ghostColor}`}
          x="-55"
          y="-186"
          width="110"
          height="190"
          opacity="0.55"
        />
        {#if badge !== null}
          <g data-badge transform={`translate(${62} ${-190})`}>
            <circle r={21 * px} fill={WALNUT} stroke={CREAM} stroke-width={2 * px} />
            <text
              text-anchor="middle"
              dominant-baseline="central"
              fill={CREAM}
              font-size={14 * px}
              font-weight="700"
              style="font-family: var(--font-ui)">{badge}</text
            >
          </g>
        {/if}
      </g>
    {/if}

    {#if swap !== null}
      <g data-swap-preview>
        {#each arrows as arrow, i (i)}
          <path
            d={arrow.d}
            fill="none"
            stroke={CREAM}
            stroke-width="16"
            stroke-linecap="round"
          />
          <path
            d={arrow.d}
            fill="none"
            stroke={WALNUT}
            stroke-width="10"
            stroke-linecap="round"
            stroke-dasharray="28 24"
          />
          <path
            d="M -26 -16 L 8 0 L -26 16 Z"
            fill={WALNUT}
            stroke={CREAM}
            stroke-width="4"
            stroke-linejoin="round"
            transform={`translate(${arrow.tip[0]} ${arrow.tip[1]}) rotate(${arrow.angle})`}
          />
        {/each}
        {#each ghosts as ghost (ghost.pawn)}
          <g data-ghost={ghost.pawn} transform={`translate(${ghost.at[0]} ${ghost.at[1]})`}>
            <ellipse cx="0" cy="-2" rx="70" ry="26" fill="none" stroke={CREAM} stroke-width="8" />
            <ellipse cx="0" cy="-2" rx="70" ry="26" fill="none" stroke={WALNUT} stroke-width="4" />
            <use
              href={`#knight-${pawnColor(ghost.pawn)}`}
              x="-55"
              y="-186"
              width="110"
              height="190"
              opacity="0.55"
            />
          </g>
        {/each}
      </g>
    {/if}

    {#each lettered as option (option.pawn)}
      {@const [x, y] = pawnAt(option.pawn)}
      <g data-letter={option.pawn} transform={`translate(${x} ${y - 208})`}>
        <circle r={14 * px} fill={WALNUT} stroke={CREAM} stroke-width={2 * px} />
        <text
          text-anchor="middle"
          dominant-baseline="central"
          fill={CREAM}
          font-size={16 * px}
          font-weight="700"
          style="font-family: var(--font-ui)">{option.letter}</text
        >
      </g>
    {/each}

    {#if preview !== null}
      {#each preview.captured as victim (victim)}
        {@const [x, y] = pawnAt(victim)}
        <g data-capture={victim} transform={`translate(${x} ${y - 196})`}>
          <g class="pop" class:still>
            <circle r={12 * px} fill={BRICK} stroke={CREAM} stroke-width={2 * px} />
            <path
              d={`M ${-5 * px} ${-5 * px} L ${5 * px} ${5 * px} M ${5 * px} ${-5 * px} L ${-5 * px} ${5 * px}`}
              stroke="#FFFFFF"
              stroke-width={2.4 * px}
              stroke-linecap="round"
              fill="none"
            />
          </g>
        </g>
      {/each}
    {/if}
  </g>
{/if}

<style>
  /* Pulse 1 -> 1.08 over 1.2 s; static under reduced motion. */
  .pulse {
    transform-box: fill-box;
    transform-origin: center;
    animation: pulse 1.2s ease-in-out infinite alternate;
  }

  .pop {
    transform-box: fill-box;
    transform-origin: center;
    animation: pop 360ms ease-out;
  }

  .still {
    animation: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse,
    .pop {
      animation: none;
    }
  }

  @keyframes pulse {
    from {
      transform: scale(1);
    }
    to {
      transform: scale(1.08);
    }
  }

  @keyframes pop {
    from {
      transform: scale(0.4);
    }
    60% {
      transform: scale(1.25);
    }
    to {
      transform: scale(1);
    }
  }
</style>
