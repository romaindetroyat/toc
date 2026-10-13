<script lang="ts">
  import { MOTION } from "@toc/board";

  // The burst of the fourth knight home (D-14): eight small stars and circles, crème and amber, that
  // fly out of the knight and fade away. Only transform and opacity are animated, by the Web
  // Animations API, so no filter is repainted per frame. The burst is hidden before it starts and
  // again once it is over; `onDone` is called when the last particle has finished.
  type Props = {
    /** Where the burst comes from, in board units (the knight's feet). */
    x: number;
    y: number;
    /** Time before the burst starts, ms. */
    delayMs?: number;
    /** Length of the burst, ms. */
    durationMs?: number;
    onDone?: () => void;
  };

  let { x, y, delayMs = 0, durationMs = MOTION.partyBurst, onDone }: Props = $props();

  const CREAM = "#FFF8E1";
  const AMBER = "#FFB02E";
  const COUNT = MOTION.partyParticles;
  /** How far the particles fly, in board units, and how high above the feet the burst starts. */
  const REACH = 230;
  const CHEST = -100;

  const particles = Array.from({ length: COUNT }, (_, i) => {
    const angle = (i / COUNT) * Math.PI * 2 + 0.3;
    return {
      dx: Math.cos(angle) * REACH * (i % 2 === 0 ? 1 : 0.7),
      dy: Math.sin(angle) * REACH * (i % 2 === 0 ? 1 : 0.7),
      star: i % 2 === 0,
      color: i % 3 === 0 ? CREAM : AMBER,
    };
  });

  let group = $state<SVGGElement>();

  $effect(() => {
    const root = group;
    if (!root) return;
    const nodes = [...root.querySelectorAll<SVGGElement>("[data-particle]")];
    const animations = nodes.map((node, i) => {
      const { dx, dy } = particles[i] as (typeof particles)[number];
      return node.animate(
        [
          { transform: "translate(0px, 0px) scale(0.2)", opacity: 0 },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(1)`, opacity: 1, offset: 0.25 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0 },
        ],
        { duration: durationMs, delay: delayMs, easing: "ease-out", fill: "both" },
      );
    });
    let cancelled = false;
    Promise.all(animations.map((a) => a.finished)).then(
      () => {
        if (!cancelled) onDone?.();
      },
      () => {},
    );
    return () => {
      cancelled = true;
      for (const animation of animations) animation.cancel();
    };
  });
</script>

<g bind:this={group} data-particles transform={`translate(${x} ${y + CHEST})`} pointer-events="none">
  {#each particles as particle, i (i)}
    <g data-particle>
      {#if particle.star}
        <path
          d="M0 -38 L11 -11 L38 -8 L16 11 L24 38 L0 22 L-24 38 L-16 11 L-38 -8 L-11 -11 Z"
          fill={particle.color}
          stroke="#2B1D12"
          stroke-width="5"
          stroke-linejoin="round"
          transform="scale(1.3)"
        />
      {:else}
        <circle r="28" fill={particle.color} stroke="#2B1D12" stroke-width="6" />
      {/if}
    </g>
  {/each}
</g>
