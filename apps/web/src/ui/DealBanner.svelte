<script lang="ts">
  import type { Color, RenderState } from "@toc/engine";
  import { fade, scale } from "svelte/transition";
  import { game } from "../i18n/fr/game.ts";
  import { settings } from "../settings/store.svelte.ts";

  type Props = {
    render: RenderState;
    /** « toi » for the human, a horse name for each bot. */
    names: Record<Color, string>;
  };

  let { render, names }: Props = $props();

  /** How long the plate stays over the board. */
  const SHOWN_MS = 1200;
  /** Cards per player at each of the three deals of a shuffle (RULES: 5, 4, 4). */
  const CARDS = [5, 4, 4] as const;

  let lines = $state<string[] | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last: string | null = null;

  // A deal starts when the exchange opens: the pair (deal index, dealer) tells one deal from the next.
  const key = $derived(render.phase === "exchange" ? `${render.dealIndex}|${render.dealer}` : null);

  $effect(() => {
    const current = key;
    if (current === last) return;
    last = current;
    if (current === null) return;
    const deal = game.banner.deal(render.dealIndex + 1, CARDS[render.dealIndex]);
    // The first deal of a shuffle also tells that the cards were shuffled and who deals.
    lines =
      render.dealIndex === 0 ? [game.banner.reshuffle(names[render.dealer]), deal] : [deal];
    clearTimeout(timer);
    timer = setTimeout(() => {
      lines = null;
    }, SHOWN_MS);
  });

  $effect(() => () => clearTimeout(timer));

  // Reduced motion: a fade only. Otherwise the plate also grows a little as it appears.
  const intro = (node: Element) =>
    settings.reduceMotion ? fade(node, { duration: 150 }) : scale(node, { start: 0.9, duration: 200 });
  const outro = (node: Element) => fade(node, { duration: settings.reduceMotion ? 150 : 200 });
</script>

<!-- Deal banner (UI-SPEC): a walnut plate at 70 % centred on the board for 1.2 s. It never takes a tap. -->
<div class="wrap" aria-live="polite">
  {#if lines !== null}
    <div class="plate" data-deal-banner in:intro out:outro>
      {#each lines as line, i (i)}
        <p class:display={i === 0} class:sub={i > 0}>{line}</p>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* The square of the board, below the 4 % band kept free above it. */
  .wrap {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(var(--board-size, 0px) * 0.04);
    height: var(--board-size, 0px);
    display: grid;
    place-items: center;
    pointer-events: none;
  }

  .plate {
    max-width: 86%;
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-sheet);
    background: rgb(43 29 18 / 0.7);
    color: var(--creme);
    text-align: center;
  }

  .plate p {
    margin: 0;
  }

  .display {
    font-family: var(--font-display);
    font-size: var(--display-size);
    font-weight: 700;
    line-height: var(--display-line);
  }

  .sub {
    font-size: var(--label-size);
    line-height: var(--label-line);
  }
</style>
