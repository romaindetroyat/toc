<script lang="ts">
  import { type Color, PARTNER, type RenderState } from "@toc/engine";
  import { game } from "../i18n/fr/game.ts";
  import InfoBar from "./InfoBar.svelte";
  import SeatChip from "./SeatChip.svelte";
  import SettingsButton from "./SettingsButton.svelte";
  import Sheet from "./Sheet.svelte";

  type Props = {
    render: RenderState;
    human: Color;
    /** « toi » for the human, a horse name for each bot. */
    names: Record<Color, string>;
    /**
     * « row »: the 56 px bar of the screens taller than wide and of the side panel. « column »: the
     * info zone at the left of the computer's bottom bar (lines, pills and gear stacked, on the
     * bar's own band). « side »: the 96 px column at the left of the board on the compact bar of a
     * phone held sideways (plan 01-37): the gear on top, then the turn and dealer lines, wrapping,
     * then the two team pills stacked. « pill »: the compact mode's info pill (plan 01-47), 52 x 44
     * at the top of the left strip: the turn dot and the glyph of the seat whose turn it is, and
     * under them the score « n–m »; a tap opens the sheet « Infos de la partie » with this bar in its
     * column form. The gear is not in the pill: it stands at the top of the right strip.
     */
    form?: "row" | "column" | "side" | "pill";
    /** Whether the bar holds the gear (« Réglages »); the sheet's copy of the bar does not. */
    gear?: boolean;
    /** Called once the player has confirmed « Abandonner la partie » (offered by « Réglages »). */
    onabandon?: (to?: string) => void;
  };

  let { render, human, names, form = "row", gear = true, onabandon }: Props = $props();

  let infoOpen = $state(false);
  let pill = $state<HTMLButtonElement | null>(null);

  const partner = $derived(PARTNER[human]);
  const playing = $derived(render.phase === "play");
  const ownTurn = $derived(playing && render.turn === human);
  const turnName = $derived(names[render.turn]);

  // Knights home per team, ours first (UI-SPEC: « Nous {n}/8 » and « Eux {n}/8 »).
  const us = $derived(render.homeCounts[human] + render.homeCounts[partner]);
  const them = $derived(
    render.homeCounts.bleu +
      render.homeCounts.jaune +
      render.homeCounts.rouge +
      render.homeCounts.vert -
      us,
  );

  /** The turn line as row 1 says it, for the pill's accessible name. */
  const turnLine = $derived(
    playing
      ? ownTurn
        ? game.info.ownTurn
        : game.info.botTurn(turnName)
      : render.phase === "exchange"
        ? game.info.exchanging
        : game.info.over,
  );
</script>

{#if form === "pill"}
  <!-- The compact mode's info pill (plan 01-47): whose turn it is and the score; the rest in a sheet. -->
  <button
    type="button"
    class="info-pill"
    data-info-bar
    data-form="pill"
    data-turn={playing ? render.turn : ""}
    aria-label={game.info.pillAria(turnLine, us, them)}
    aria-haspopup="dialog"
    bind:this={pill}
    onclick={() => (infoOpen = true)}
  >
    <span class="pill-turn" aria-hidden="true">
      <span class="dot" class:own={ownTurn}></span>
      {#if playing}
        <SeatChip color={render.turn} showName={false} small />
      {/if}
    </span>
    <span class="pill-score" aria-hidden="true" data-score>{game.info.score(us, them)}</span>
  </button>

  {#if infoOpen}
    <Sheet title={game.info.sheetTitle} onclose={() => (infoOpen = false)} opener={pill}>
      <div class="sheet-info" data-info-sheet>
        <InfoBar {render} {human} {names} form="column" gear={false} />
      </div>
    </Sheet>
  {/if}
{:else}
  <!-- Info bar (UI-SPEC, D-07): 56 px, three zones. The bot's name is never truncated; below 360 px the
       words « Tour de » are hidden visually and stay in the text for screen readers. In column form (the
       computer's bottom bar) the same three zones stack: the turn and dealer lines, then the two team
       pills side by side with the gear. -->
  <header
    class="bar"
    class:column={form === "column"}
    class:side={form === "side"}
    data-info-bar
    data-form={form}
  >
    <div class="left">
      <p class="turn" data-turn={playing ? render.turn : ""}>
        {#if playing}
          <span class="dot" class:own={ownTurn} aria-hidden="true"></span>
          <SeatChip color={render.turn} showName={false} small />
          {#if ownTurn}
            <span class="name">{game.info.ownTurn}</span>
          {:else}
            <span class="prefix">{game.info.turnPrefix(turnName)}</span><span class="name">{turnName}</span>
          {/if}
        {:else}
          <span class="name">
            {render.phase === "exchange" ? game.info.exchanging : game.info.over}
          </span>
        {/if}
      </p>
      <p class="deal" data-deal>
        {game.info.dealer(names[render.dealer])} · {game.info.deal(render.dealIndex + 1)}
      </p>
    </div>

    <div class="teams">
      <span class="pill own" aria-label={game.info.teamAria(us)} data-team-us>
        {game.info.teamUs(us)}
      </span>
      <span class="pill" aria-label={game.info.teamAriaThem(them)} data-team-them>
        {game.info.teamThem(them)}
      </span>
    </div>

    {#if gear}
      <div class="gear" data-settings-slot>
        <SettingsButton {onabandon} />
      </div>
    {/if}
  </header>
{/if}

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    height: 56px;
    padding: 0 var(--space-md);
    background: var(--bois-sombre);
    color: var(--creme);
  }

  .left {
    flex: 1 1 0;
    min-width: 0;
  }

  /* Column form: no height or background of its own, it stands on the bottom bar's band. The lines
     on top, then the pills side by side and the gear at the end of their row. */
  .bar.column {
    flex-wrap: wrap;
    align-content: center;
    gap: var(--space-xs) var(--space-sm);
    height: auto;
    padding: 0;
    background: transparent;
  }

  .column .left {
    flex: 1 1 100%;
  }

  .column .turn {
    flex-wrap: wrap;
    white-space: normal;
  }

  .column .teams {
    flex: 1 1 auto;
    flex-direction: row;
    gap: var(--space-xs);
    width: auto;
  }

  .column .pill {
    flex: 1 1 0;
    padding: 0 var(--space-sm);
  }

  /* Side form (the compact bar): a column of 96 px beside the board, on the page's own background.
     A grid places the zones without moving them in the DOM: the gear (44 x 44) on top, the turn and
     dealer lines under it (they wrap, the bot's name is never cut), then the pills stacked. As below
     360 px, « Tour de » is hidden visually and stays for screen readers, so that everything fits the
     200 px a 320 px high screen leaves beside the board. */
  .bar.side {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "gear"
      "left"
      "teams";
    align-content: center;
    gap: var(--space-xs);
    height: auto;
    padding: 0 0 0 6px;
    background: transparent;
  }

  .side .left {
    grid-area: left;
  }

  .side .left p {
    line-height: 1.25;
  }

  .side .turn {
    flex-wrap: wrap;
    white-space: normal;
  }

  .side .name {
    flex: 0 1 auto;
    min-width: 0;
  }

  .side .prefix {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .side .deal {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .side .teams {
    grid-area: teams;
    width: auto;
    gap: var(--space-xs);
  }

  .side .gear {
    grid-area: gear;
  }

  .left p {
    margin: 0;
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .turn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-weight: 700;
    white-space: nowrap;
  }

  /* The name is never cut: the row may overflow its zone before the name shrinks. */
  .name {
    flex: none;
  }

  .prefix {
    flex: none;
  }

  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border: 2px solid var(--creme-attenuee);
    border-radius: 50%;
  }

  .dot.own {
    border-color: var(--ambre);
    background: var(--ambre);
  }

  .deal {
    overflow: hidden;
    color: var(--creme-attenuee);
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .teams {
    flex: none;
    display: flex;
    flex-direction: column;
    width: 112px;
  }

  .pill {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    border: 2px solid transparent;
    border-radius: 999px;
    font-size: var(--label-size);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  /* Our team: a cream outline plus the word « Nous », so colour is not the only cue. */
  .pill.own {
    border-color: var(--creme);
  }

  .gear {
    flex: none;
    width: var(--touch);
    height: var(--touch);
  }

  /* The compact mode's pill: 52 x 44, the turn on top, the score « n–m » under it. */
  .info-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 52px;
    min-width: 0;
    height: var(--touch);
    padding: 0;
    border: 2px solid var(--creme-attenuee);
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
    font-family: var(--font-ui);
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .pill-turn {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 16px;
  }

  .pill-turn :global(.chip.small) {
    height: 16px;
    padding: 0 2px;
  }

  .pill-turn :global(.chip.small svg) {
    width: 12px;
    height: 12px;
  }

  .pill-turn .dot {
    width: 8px;
    height: 8px;
  }

  .pill-score {
    font-size: var(--label-size);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 16px;
  }

  .sheet-info {
    padding: var(--space-xs) 0;
  }

  /* Compact rule: « Tour de » is hidden visually and the middle zone narrows to 96. */
  @media (max-width: 359.98px) {
    .prefix {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .teams {
      width: 96px;
    }
  }
</style>
