<script lang="ts">
  import { COLORS, type Color, type Team, teamOf } from "@toc/engine";
  import { PALETTE } from "@toc/board";
  import type { RematchVote } from "@toc/protocol";
  import { onMount } from "svelte";
  import type { GameStats } from "../game/GameController.ts";
  import { game } from "../i18n/fr/game.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import { table as tableCopy } from "../i18n/fr/table.ts";
  import { discLabel, voteLine } from "../net/votes.ts";
  import { settings } from "../settings/store.svelte.ts";
  import Icon from "./Icon.svelte";

  /**
   * The online plank (02-UI-SPEC « End plank (D-08, PLAY-07) », plan 02-09): « Revanche » (a toggle)
   * and « Quitter la table » in place of « Rejouer » and « Changer de couleur », the four vote discs
   * and the vote line. No quick messages here (the game behind is inert, 02-08).
   */
  export type OnlinePlank = {
    /** This device's seat. */
    me: Color;
    /** Each seat's answer from the server (null until its finished table arrives). */
    votes: Record<Color, RematchVote> | null;
    /** Everyone online agreed: the new game has started on the server. */
    starting: boolean;
    /** The discs' names: « Toi » for this device, first names, horse names. */
    names: Record<Color, string>;
    /** The rematch starts: the plank closes (300 ms, 150 ms fade under reduced motion). */
    closing: boolean;
    /** « Revanche »: agree, or withdraw with a second tap. */
    onrematch: (agree: boolean) => void;
    /** « Quitter la table »: leave the table, forget it on this device, go home. */
    onleave: () => void;
  };

  type Props = {
    /** Whether the human's team won. */
    won: boolean;
    /** The team that brought its eight knights home. */
    winner: Team;
    /** The knights home of the human's team (`nous`) and of the other (`eux`), out of 8. */
    score: { nous: number; eux: number };
    /** The display names by colour, the human's own colour shown as « Toi ». */
    names: Record<Color, string>;
    /** The deals played and the knights eaten, read once when the game ends. */
    stats: () => GameStats;
    /** « Rejouer »: a new game with the same colour. */
    onreplay: () => void;
    /** « Changer de couleur »: back to the launch screen. */
    onchange: () => void;
    /** An online table: the rematch vote replaces the two local buttons. */
    online?: OnlinePlank;
  };

  let { won, winner, score, names, stats, onreplay, onchange, online }: Props = $props();

  /** This device agreed (or the rematch is starting). */
  const agreed = $derived(
    online !== undefined && (online.starting || online.votes?.[online.me] === "yes"),
  );
  const line = $derived.by(() => {
    if (online === undefined) return "";
    if (online.starting) return voteLine(null, online.me, online.names);
    if (online.votes === null) return tableCopy.rematch.nobody;
    return voteLine(online.votes, online.me, online.names);
  });
  /** A disc's state; once the rematch starts, the last « no » (the last to agree) became a yes. */
  function voteOf(color: Color): RematchVote {
    const vote = online?.votes?.[color] ?? (online?.starting ? "yes" : "no");
    return online?.starting && vote === "no" ? "yes" : vote;
  }

  function toggle() {
    if (online === undefined || online.starting) return;
    online.onrematch(!agreed);
  }

  const result = $derived(stats());
  // The winning team's two colours, the human's own knight first (« Toi », then the partner).
  const winners = $derived(
    COLORS.filter((color) => teamOf(color) === winner).sort(
      (a, b) => Number(names[b] === game.end.you) - Number(names[a] === game.end.you),
    ),
  );

  let replay = $state<HTMLButtonElement>();
  let change = $state<HTMLButtonElement>();
  let panel = $state<HTMLElement>();

  // Focus lands on « Rejouer » (UI-SPEC), inside the plank.
  onMount(() => replay?.focus());

  // The game screen behind is inert while the plank is up (Game.svelte); anything else that could still
  // take the focus (the toast) gives it back to the plank, as Sheet does.
  function onWindowFocusin(event: FocusEvent) {
    if (panel && event.target instanceof Node && !panel.contains(event.target)) replay?.focus();
  }

  /** Tab stays on the plank: the board behind it is dimmed and not playable. */
  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    (document.activeElement === replay ? change : replay)?.focus();
  }
</script>

<svelte:window onfocusin={onWindowFocusin} />

<!--
  End of game, « La planche de fin de partie » (plan 01-50, Romain's recette 3, test 30: « Le panneau
  de victoire défaite est moche »). Over the dimmed board, a plank in the galet's wood: the oak face
  with a drawn grain (gradients, never a filter), the walnut rim and its fine inner line, the shadow
  drawn as a sharp offset copy (UI-SPEC « ombres sans flou »). One column on a computer, two on a phone
  held sideways (lower than 600 px).
-->
<div
  class="scrim"
  class:still={settings.reduceMotion}
  class:online={online !== undefined}
  class:closing={online?.closing === true}
  data-end-screen
  data-result={won ? "win" : "loss"}
>
  <div
    class="plank"
    role="dialog"
    aria-modal="true"
    aria-labelledby="end-title"
    aria-describedby="end-text"
    tabindex="-1"
    data-end-plank
    style:--ink={PALETTE.ink}
    style:--oak={PALETTE.board}
    style:--rim={PALETTE.rim}
    style:--line={PALETTE.outlineLine}
    style:--track={PALETTE.track}
    style:--cream={PALETTE.cream}
    bind:this={panel}
    {onkeydown}
  >
    <div class="side side-team">
      <div class="head">
        <h2 id="end-title" class="title">{won ? game.end.win : game.end.loss}</h2>
        {#if won}
          <!-- The amber stroke under « Victoire ! », drawn like a brush mark. -->
          <svg class="underline" viewBox="0 0 160 14" aria-hidden="true" focusable="false">
            <path d="M4 9 C 40 3, 92 3, 156 7" />
            <path class="thin" d="M22 12 C 60 8, 104 8, 138 10" />
          </svg>
        {/if}
      </div>
      <p id="end-text" class="sentence">{won ? game.end.winText : game.end.lossText}</p>

      <div class="team" data-end-team={winner}>
        {#if !won}
          <p class="team-caption">{game.end.opponents}</p>
        {/if}
        <div class="knights">
          {#each winners as color (color)}
            <figure
              class="knight"
              data-end-knight={color}
              style:--disc={PALETTE.hex[color]}
              style:--disc-light={PALETTE.light[color]}
            >
              <span class="disc">
                <span class="silhouette" style:--src={`url(./cavaliers/${color}.webp)`} aria-hidden="true"
                ></span>
                <img src={`./cavaliers/${color}.webp`} alt={seats[color].name} width="33" height="57" />
              </span>
              <figcaption>{names[color]}</figcaption>
            </figure>
          {/each}
        </div>
      </div>
    </div>

    <span class="divider" aria-hidden="true"></span>

    <div class="side side-score">
      <div class="score" data-end-score data-score-nous={score.nous} data-score-eux={score.eux}>
        <span class="sr-only">{game.end.score(score.nous, score.eux)}</span>
        <span class="tally" aria-hidden="true">
          <span class="team-score" data-score="nous">
            <span class="number">{score.nous}</span>
            <span class="who">{game.end.us}</span>
          </span>
          <span class="dash">–</span>
          <span class="team-score" data-score="eux">
            <span class="number">{score.eux}</span>
            <span class="who">{game.end.them}</span>
          </span>
        </span>
      </div>

      <p class="stats">
        <span data-stat="deals">{game.end.deals(result.dealsPlayed)}</span>
        <span class="dot" aria-hidden="true">·</span>
        <span data-stat="captures">{game.end.captures(result.captured.nous, result.captured.eux)}</span>
      </p>

      {#if online !== undefined}
        <div class="vote">
          <ul class="discs" role="list" aria-label={tableCopy.rematch.group}>
            {#each COLORS as color (color)}
              {@const vote = voteOf(color)}
              <li class="vote-disc" data-rematch-vote={color} data-vote={vote}>
                <svg class="glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  {#if color === "bleu"}
                    <circle cx="8" cy="8" r="6" />
                  {:else if color === "jaune"}
                    <path d="M8 2 L14.5 13.5 L1.5 13.5 Z" />
                  {:else if color === "rouge"}
                    <rect x="2.5" y="2.5" width="11" height="11" />
                  {:else}
                    <path
                      d="M8 1.5 L9.9 5.8 L14.5 6.2 L11 9.3 L12.1 13.9 L8 11.5 L3.9 13.9 L5 9.3 L1.5 6.2 L6.1 5.8 Z"
                    />
                  {/if}
                </svg>
                <span class="badge" aria-hidden="true">
                  <Icon
                    name={vote === "offline" ? "wifi-off" : vote === "no" ? "hourglass" : "check"}
                    size={10}
                  />
                </span>
                <span class="sr-only">{discLabel(online.names[color], vote)}</span>
              </li>
            {/each}
          </ul>
          <p class="vote-line" aria-live="polite" data-vote-line>{line}</p>
        </div>
        <div class="buttons">
          <button
            type="button"
            class="btn btn-primary"
            aria-pressed={agreed}
            bind:this={replay}
            onclick={toggle}
          >
            {#if agreed}
              <Icon name="check" size={20} />
            {/if}
            {tableCopy.rematch.agree}
          </button>
          <button type="button" class="btn wood" bind:this={change} onclick={online.onleave}>
            {tableCopy.rematch.leave}
          </button>
        </div>
      {:else}
        <div class="buttons">
          <button type="button" class="btn btn-primary" bind:this={replay} onclick={onreplay}>
            {game.end.replay}
          </button>
          <button type="button" class="btn wood" bind:this={change} onclick={onchange}>
            {game.end.changeColour}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: var(--space-sm);
    background: rgb(43 29 18 / 0.7);
    overflow: hidden;
    animation: fade 300ms ease-out both;
  }

  /* The plank: oak face, drawn grain, walnut rim with its fine inner line, sharp offset shadow. */
  .plank {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-md);
    box-sizing: border-box;
    width: min(100%, 520px);
    max-height: calc(100dvh - 16px);
    padding: var(--space-lg) var(--space-xl) 28px;
    border: 6px solid var(--rim);
    border-radius: 28px;
    background-color: var(--oak);
    background-image:
      /* a lighter heart, where the light falls */
      radial-gradient(ellipse 70% 55% at 50% 28%, rgb(251 244 226 / 0.45), transparent 70%),
      /* the grain: broad soft bands, then hairlines at slightly different angles and periods */
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
      ),
      repeating-linear-gradient(
        178.4deg,
        transparent 0 59px,
        rgb(91 58 32 / 0.08) 59px 60px,
        transparent 60px 67px,
        rgb(91 58 32 / 0.05) 67px 68px,
        transparent 68px 109px
      );
    box-shadow:
      inset 0 0 0 4px var(--oak),
      inset 0 0 0 5px var(--line),
      0 6px 0 rgb(42 26 14 / 0.45);
    color: var(--ink);
    text-align: center;
    animation: plank-in 300ms ease-out both;
  }

  .plank p {
    margin: 0;
  }

  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    min-width: 0;
  }

  .divider {
    display: none;
  }

  /* Title: Caveat 700 at 44 px, the plank's one text above Display (UI-SPEC exception, plan 01-50). */
  .head {
    position: relative;
    display: grid;
    justify-items: center;
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 44px;
    font-weight: 700;
    line-height: 1.1;
    color: var(--ink);
  }

  .underline {
    width: 160px;
    height: 14px;
    margin-top: -6px;
    overflow: visible;
  }

  .underline path {
    fill: none;
    stroke: var(--ambre);
    stroke-width: 5;
    stroke-linecap: round;
  }

  .underline path.thin {
    stroke-width: 2.5;
    opacity: 0.8;
  }

  .plank .sentence {
    text-wrap: balance;
    margin-top: calc(-1 * var(--space-sm));
    font-size: var(--body-size);
    line-height: var(--body-line);
  }

  /* The team: the two knights on discs of their galet colours, each named. */
  .team {
    display: grid;
    justify-items: center;
    gap: var(--space-xs);
  }

  .team-caption {
    font-size: var(--label-size);
    line-height: var(--label-line);
    font-weight: 700;
    color: var(--track);
  }

  .knights {
    display: flex;
    justify-content: center;
    gap: var(--space-xl);
  }

  .knight {
    display: grid;
    justify-items: center;
    gap: var(--space-xs);
    margin: 0;
  }

  .disc {
    position: relative;
    display: grid;
    place-items: end center;
    width: 68px;
    height: 68px;
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: radial-gradient(circle at 36% 30%, var(--disc-light) 0 18%, var(--disc) 62%);
    box-shadow:
      inset 0 0 0 3px rgb(251 244 226 / 0.55),
      0 3px 0 rgb(42 26 14 / 0.45);
  }

  /* The knight stands on the disc; its ink silhouette, offset like the plank's shadow, outlines it. */
  .disc img,
  .silhouette {
    position: absolute;
    left: 50%;
    bottom: 4px;
    width: 33px;
    height: 57px;
    margin-left: -16.5px;
  }

  .silhouette {
    transform: translate(2px, 2px);
    background: var(--ink);
    -webkit-mask: var(--src) center / contain no-repeat;
    mask: var(--src) center / contain no-repeat;
  }

  .knight figcaption {
    max-width: 112px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--label-size);
    line-height: var(--label-line);
    font-weight: 700;
  }

  /* The score « nous – eux », Display in Caveat, tabular figures, a carved cartouche. */
  .score {
    display: grid;
    justify-items: center;
  }

  .tally {
    display: inline-flex;
    align-items: flex-start;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-md);
    border: 1px solid var(--line);
    border-radius: 16px;
    background: rgb(251 244 226 / 0.55);
    box-shadow: inset 0 2px 0 rgb(91 58 32 / 0.18);
  }

  .team-score {
    display: grid;
    justify-items: center;
    min-width: 40px;
  }

  .number,
  .dash {
    font-family: var(--font-display);
    font-size: var(--display-size);
    font-weight: 700;
    line-height: var(--display-line);
    font-variant-numeric: tabular-nums;
  }

  .dash {
    color: var(--track);
  }

  .who {
    font-size: var(--label-size);
    line-height: var(--label-line);
    color: var(--track);
  }

  .stats {
    text-wrap: balance;
    font-size: var(--label-size);
    line-height: var(--label-line);
    color: var(--track);
    font-variant-numeric: tabular-nums;
  }

  .dot {
    margin: 0 var(--space-xs);
  }

  .buttons {
    display: flex;
    flex-direction: column;
    align-self: stretch;
    gap: var(--space-sm);
    margin-top: var(--space-xs);
  }

  .buttons .btn {
    min-height: var(--button-height);
    border: 2px solid var(--ink);
    box-shadow: 0 3px 0 rgb(42 26 14 / 0.45);
  }

  .buttons .btn:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 rgb(42 26 14 / 0.45);
  }

  /* « Changer de couleur »: secondary on wood, a walnut outline and ink text. */
  .wood {
    border-color: var(--rim);
    background: transparent;
    color: var(--ink);
  }

  /* The focus ring keeps its walnut gap on the oak (UI-SPEC: 3 px amber, 2 px walnut offset). */
  .buttons .btn:focus-visible {
    outline: 3px solid var(--ambre);
    outline-offset: 2px;
    box-shadow:
      0 0 0 2px var(--noyer),
      0 3px 0 rgb(42 26 14 / 0.45);
  }

  /* Online (plan 02-09): the four vote discs and the line under them, above the buttons. */
  .vote {
    display: grid;
    justify-items: center;
    gap: var(--space-xs);
    align-self: stretch;
  }

  .discs {
    display: flex;
    justify-content: center;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* A 28 px disc: the seat's glyph in its colour on cream, a 1 px ink line, a 14 px state badge. */
  .vote-disc {
    position: relative;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    box-sizing: border-box;
    border: 1px solid var(--ink);
    border-radius: 50%;
    background: var(--cream);
  }

  .vote-disc[data-rematch-vote="bleu"] {
    --seat: var(--seat-bleu);
  }
  .vote-disc[data-rematch-vote="jaune"] {
    --seat: var(--seat-jaune);
  }
  .vote-disc[data-rematch-vote="rouge"] {
    --seat: var(--seat-rouge);
  }
  .vote-disc[data-rematch-vote="vert"] {
    --seat: var(--seat-vert);
  }

  .glyph {
    fill: var(--seat);
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }

  .badge {
    position: absolute;
    right: -4px;
    bottom: -4px;
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    box-sizing: border-box;
    border: 1px solid var(--ink);
    border-radius: 50%;
    background: var(--cream);
    color: var(--ink);
  }

  .vote-disc[data-vote="no"] .badge,
  .vote-disc[data-vote="offline"] .badge {
    color: var(--track);
  }

  .vote-line {
    text-wrap: balance;
    font-size: var(--label-size);
    line-height: var(--label-line);
    color: var(--track);
  }

  .buttons .btn[aria-pressed] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
  }

  /* The rematch starts: the plank goes (300 ms; a 150 ms fade under reduced motion). */
  .scrim.closing,
  .scrim.closing .plank {
    animation: plank-out 300ms ease-in both;
  }

  .scrim.still.closing,
  .scrim.still.closing .plank {
    animation: fade-out 150ms ease-in both;
  }

  /* A phone held sideways: two columns, the title and the team at the left, the rest at the right. */
  @media (max-height: 599px) {
    .plank {
      flex-direction: row;
      align-items: center;
      gap: var(--space-lg);
      width: min(100%, 680px);
      padding: var(--space-md) var(--space-lg);
    }

    .side {
      flex: 1 1 0;
      gap: 12px;
    }

    .divider {
      display: block;
      align-self: stretch;
      width: 1px;
      margin: var(--space-sm) 0;
      background: var(--line);
      opacity: 0.6;
    }

    .buttons .btn {
      padding: 0 var(--space-md);
    }

    .stats span:not(.dot) {
      display: block;
    }

    .stats .dot {
      display: none;
    }
  }

  @media (max-height: 599px) and (max-width: 560px) {
    .plank {
      gap: var(--space-md);
      padding: 12px var(--space-md);
    }

    .knights {
      gap: var(--space-md);
    }

    .buttons .btn {
      padding: 0 var(--space-sm);
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes fade-out {
    to {
      opacity: 0;
    }
  }

  @keyframes plank-out {
    to {
      opacity: 0;
      transform: translateY(12px);
    }
  }

  @keyframes plank-in {
    from {
      opacity: 0;
      transform: translateY(-12px);
    }
  }

  /* Reduced motion: the plank only fades in, over 150 ms. */
  .still,
  .still .plank {
    animation: fade 150ms ease-out both;
  }

  @media (prefers-reduced-motion: reduce) {
    .scrim,
    .plank {
      animation: fade 150ms ease-out both;
    }

    .scrim.closing,
    .scrim.closing .plank {
      animation: fade-out 150ms ease-in both;
    }
  }

  /* Online on a very low screen: the stats line is read, not shown, so the plank never scrolls. */
  @media (max-height: 359px) {
    .online .stats {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
</style>
