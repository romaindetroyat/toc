<script lang="ts">
  import { MOTION, REDUCED, scaleFor } from "@toc/board";
  import { type Color, firstPlayer, type RenderState } from "@toc/engine";
  import { fade, scale } from "svelte/transition";
  import { game } from "../i18n/fr/game.ts";
  import { settings } from "../settings/store.svelte.ts";

  type Props = {
    render: RenderState;
    /** « toi » for the human, a horse name for each bot. */
    names: Record<Color, string>;
    /** The player's seat: « Tu commences. » when the player plays first. */
    human: Color;
  };

  let { render, names, human }: Props = $props();

  // The plate stays 1.2 s over the board, 0.4 times that in fast mode; it fades in and out in 150 ms
  // when motion is reduced (UI-SPEC « Deal banner »).
  const pace = $derived(settings.reduceMotion ? "reduced" : settings.fast ? "fast" : "normal");
  const shownMs = $derived(MOTION.banner * scaleFor(pace));
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
    // Every deal ends with who plays first (Romain, 2026-10-17, plan 03-11: the seat after the dealer).
    const starter = firstPlayer(render.dealer);
    const starts = game.banner.starts(names[starter], starter === human);
    // The first deal of a shuffle also tells that the cards were shuffled and who deals.
    lines =
      render.dealIndex === 0
        ? [game.banner.reshuffle(names[render.dealer]), deal, starts]
        : [deal, starts];
    clearTimeout(timer);
    timer = setTimeout(() => {
      lines = null;
    }, shownMs);
  });

  $effect(() => () => clearTimeout(timer));

  // Reduced motion: a fade only. Otherwise the plate also grows a little as it appears.
  const intro = (node: Element) =>
    pace === "reduced"
      ? fade(node, { duration: REDUCED.cards })
      : scale(node, { start: 0.9, duration: 200 * scaleFor(pace) });
  const outro = (node: Element) =>
    fade(node, { duration: pace === "reduced" ? REDUCED.cards : 200 * scaleFor(pace) });
</script>

<!-- Deal banner (UI-SPEC): a walnut plate at 70 % centred on the board for 1.2 s. It never takes a tap. -->
<div class="wrap" aria-live="polite">
  {#if lines !== null}
    <div class="plate" data-deal-banner in:intro out:outro>
      {#each lines as line, i (i)}
        <p
          class:display={i === 0}
          class:sub={i > 0}
          data-banner-starts={i === lines.length - 1 ? "" : undefined}
        >{line}</p>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* The board (--board-size wide, --board-ratio times as tall: 0.5 on the landscape galet, the
     game's only board), below the head room kept free above it: the plate is centred on the board,
     over the felt. */
  .wrap {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(var(--board-size, 0px) * var(--head-room, 0.0217));
    height: calc(var(--board-size, 0px) * var(--board-ratio, 0.5));
    display: grid;
    place-items: center;
    pointer-events: none;
    container-type: size;
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

  /* A small board (a phone held sideways): a compact plate that stays inside it. */
  @container (max-width: 240px) {
    .plate {
      max-width: 96%;
      padding: var(--space-xs) var(--space-sm);
    }

    .display {
      font-size: var(--body-size);
      line-height: var(--body-line);
    }
  }
</style>
