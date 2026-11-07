<script lang="ts">
  import { PALETTE } from "@toc/board";
  import { onMount } from "svelte";
  import { cue } from "../audio/engine.ts";
  import { lecons } from "../i18n/fr/lecons.ts";
  import { settings } from "../settings/store.svelte.ts";

  // The lesson plank « Bravo ! » (plan 05-06; 05-UI-SPEC « The lesson plank »): the end plank's oak
  // style, smaller, centred on the board over a 30 % walnut veil on the board only. A dialog named by
  // « Bravo ! » and described by the lesson's recap; the focus lands on the primary and Tab stays
  // inside (the game behind is inert, Game.svelte). It comes with the joyful neigh of the fourth
  // knight home. Under 400 px of board width the two buttons stack, the primary at the bottom.

  type Props = {
    /** The lesson's recap (at most 160 characters). */
    recap: string;
    /** The last lesson: « Revoir les leçons » and « Jouer contre l’ordinateur ». */
    last: boolean;
    /** The board, to stand on and to veil. */
    board: HTMLElement | null;
    /** « Leçon suivante », or « Jouer contre l’ordinateur » after the last lesson. */
    onprimary: () => void;
    /** « Revoir la leçon », or « Revoir les leçons » after the last lesson. */
    onsecondary: () => void;
  };

  let { recap, last, board, onprimary, onsecondary }: Props = $props();

  /** The board's box on the screen, followed while the plank is up. */
  let rect = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  $effect(() => {
    const el = board;
    if (el === null) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      rect = { x: box.left, y: box.top, w: box.width, h: box.height };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  });

  const width = $derived(rect === null ? 400 : Math.max(0, Math.min(400, rect.w - 32)));
  const stacked = $derived(rect !== null && rect.w < 400);
  /** The plank's centre across: the board's centre. */
  const centre = $derived(rect === null ? null : rect.x + rect.w / 2);

  let primary = $state<HTMLButtonElement>();
  let secondary = $state<HTMLButtonElement>();
  let panel = $state<HTMLElement>();

  onMount(() => {
    primary?.focus();
    cue("hennissement-fete");
  });

  // Anything outside that could still take the focus (the toast) gives it back to the plank.
  function onWindowFocusin(event: FocusEvent) {
    if (panel && event.target instanceof Node && !panel.contains(event.target)) primary?.focus();
  }

  /** Tab goes from one button to the other. */
  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    (document.activeElement === primary ? secondary : primary)?.focus();
  }
</script>

<svelte:window onfocusin={onWindowFocusin} />

<div class="layer" class:still={settings.reduceMotion} data-lesson-plank-layer>
  {#if rect !== null}
    <div
      class="veil"
      aria-hidden="true"
      style:left="{rect.x}px"
      style:top="{rect.y}px"
      style:width="{rect.w}px"
      style:height="{rect.h}px"
    ></div>
  {/if}
  <div
    class="plank"
    class:stacked
    role="dialog"
    aria-modal="true"
    aria-labelledby="lesson-plank-title"
    aria-describedby="lesson-plank-recap"
    tabindex="-1"
    data-lesson-plank
    style:width="{width}px"
    style:left={centre === null ? "50%" : `${centre}px`}
    style:--ink={PALETTE.ink}
    style:--oak={PALETTE.board}
    style:--rim={PALETTE.rim}
    style:--line={PALETTE.outlineLine}
    bind:this={panel}
    {onkeydown}
  >
    <h2 id="lesson-plank-title" class="title">{lecons.bravo}</h2>
    <p id="lesson-plank-recap" class="recap">{recap}</p>
    <div class="buttons">
      <button type="button" class="btn wood" bind:this={secondary} onclick={onsecondary}>
        {last ? lecons.plank.lessons : lecons.plank.again}
      </button>
      <button type="button" class="btn btn-primary" bind:this={primary} onclick={onprimary}>
        {last ? lecons.plank.computer : lecons.plank.next}
      </button>
    </div>
  </div>
</div>

<style>
  /* Over the whole screen, so the plank can stand clear of the screen's edges on the smallest phones;
     only the board is veiled. */
  .layer {
    position: fixed;
    inset: 0;
    z-index: 40;
    pointer-events: none;
  }

  .veil {
    position: fixed;
    background: rgb(43 29 18 / 0.3);
    animation: fade 300ms ease-out both;
  }

  /* The end plank's wood (01 addendum): oak face with a drawn grain, 6 px walnut rim and its fine
     inner line, 28 px corners, a sharp 6 px ink shadow; smaller. Centred across on the board, in
     the screen's height. */
  .plank {
    position: fixed;
    top: 50%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    box-sizing: border-box;
    max-height: calc(100dvh - 16px);
    padding: var(--space-md);
    overflow-y: auto;
    border: 6px solid var(--rim);
    border-radius: 28px;
    background-color: var(--oak);
    background-image:
      radial-gradient(ellipse 70% 55% at 50% 28%, rgb(251 244 226 / 0.45), transparent 70%),
      repeating-linear-gradient(
        179deg,
        transparent 0,
        rgb(122 86 52 / 0.07) 18px,
        transparent 36px,
        transparent 83px
      ),
      repeating-linear-gradient(
        180.8deg,
        transparent 0 13px,
        rgb(91 58 32 / 0.07) 13px 14px,
        transparent 14px 31px,
        rgb(91 58 32 / 0.045) 31px 33px,
        transparent 33px 47px
      );
    box-shadow:
      inset 0 0 0 4px var(--oak),
      inset 0 0 0 5px var(--line),
      0 6px 0 rgb(42 26 14 / 0.45);
    color: var(--ink);
    text-align: center;
    pointer-events: auto;
    transform: translate(-50%, -50%);
    animation: plank-in 300ms ease-out both;
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--display-size);
    font-weight: 700;
    line-height: var(--display-line);
  }

  .recap {
    margin: var(--space-sm) 0 0;
    font-size: var(--body-size);
    line-height: var(--body-line);
    text-wrap: balance;
  }

  .buttons {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-md);
  }

  .buttons .btn {
    flex: 1 1 0;
    min-width: 0;
    min-height: var(--button-height);
    padding: 0 var(--space-sm);
    border: 2px solid var(--ink);
    box-shadow: 0 3px 0 rgb(42 26 14 / 0.45);
  }

  /* Under 400 px of board: one above the other, the primary at the bottom. */
  .stacked .buttons {
    flex-direction: column;
  }

  .stacked .buttons .btn {
    flex: none;
  }

  /* « Revoir la leçon »: secondary on wood, a walnut outline and ink text. */
  .wood {
    border-color: var(--rim);
    background: transparent;
    color: var(--ink);
  }

  .buttons .btn:focus-visible {
    outline: 3px solid var(--ambre);
    outline-offset: 2px;
    box-shadow:
      0 0 0 2px var(--noyer),
      0 3px 0 rgb(42 26 14 / 0.45);
  }

  /* 12 px down and a fade in 300 ms; one 150 ms fade under reduced motion. */
  @keyframes plank-in {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% - 12px));
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .still .plank {
    animation: fade 150ms ease-out both;
  }

  .still .veil {
    animation: fade 150ms ease-out both;
  }

  @media (prefers-reduced-motion: reduce) {
    .plank,
    .veil {
      animation: fade 150ms ease-out both;
    }
  }
</style>
