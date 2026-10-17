<script lang="ts">
  import { type Color, firstPlayer, PARTNER, type RenderState } from "@toc/engine";
  import type { TablePublic } from "@toc/protocol";
  import { game } from "../i18n/fr/game.ts";
  import { table as tableCopy } from "../i18n/fr/table.ts";
  import { settings } from "../settings/store.svelte.ts";
  import InfoBar from "./InfoBar.svelte";
  import SeatChip from "./SeatChip.svelte";
  import SettingsButton from "./SettingsButton.svelte";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";
  import TablePlayers from "./TablePlayers.svelte";

  type Props = {
    render: RenderState;
    human: Color;
    /** « toi » for the human, a horse name for each bot. */
    names: Record<Color, string>;
    /**
     * « row »: a 56 px bar, the form the game keeps behind « Tourne ton téléphone » (never shown).
     * « column »: the info zone at the left of the computer's bottom bar (lines, pills and gear
     * stacked, on the bar's own band). « pill »: the compact mode's info pill (plan 01-47), 52 x 44
     * at the top of the left strip: the turn dot and the glyph of the seat whose turn it is, and
     * under them the score « n–m »; a tap opens the sheet « Infos de la partie » with this bar in its
     * column form. The gear is not in the pill: it stands at the top of the right strip.
     */
    form?: "row" | "column" | "pill";
    /** Whether the bar holds the gear (« Réglages »); the sheet's copy of the bar does not. */
    gear?: boolean;
    /** Called once the player has confirmed « Abandonner la partie » (offered by « Réglages »). */
    onabandon?: (to?: string) => void;
    /** An online game (plan 02-07): the confirmed « Quitter la table » of « Réglages ». */
    onleave?: () => void;
    /** An online game, the chef de table: the confirmed « Arrêter la partie ». */
    onstop?: () => void;
    /** The computer player thinking about its move (session.thinking), if any. */
    thinking?: Color | null;
    /**
     * An online table (plan 02-06): « À la table », the players list, as a section of the pill's
     * sheet (phone) or behind a 44 px button on a fourth row of the column form (computer).
     */
    players?: { table: TablePublic; me: Color };
  };

  let {
    render,
    human,
    names,
    form = "row",
    gear = true,
    onabandon,
    onleave,
    onstop,
    thinking = null,
    players,
  }: Props = $props();

  let infoOpen = $state(false);
  let playersOpen = $state(false);
  let playersButton = $state<HTMLButtonElement | null>(null);
  let pill = $state<HTMLButtonElement | null>(null);

  const partner = $derived(PARTNER[human]);
  const playing = $derived(render.phase === "play");
  const ownTurn = $derived(playing && render.turn === human);
  const turnName = $derived(names[render.turn]);
  /** Who plays first in this deal (G9: the seat after the dealer; Romain, 2026-10-17, plan 03-11). */
  const starter = $derived(firstPlayer(render.dealer));
  /**
   * The thinking sign (D-12, 03-UI-SPEC « Thinking sign », 03-09): the turn row's glyph breathes in a
   * ring of its seat colour while the computer player whose turn it shows is thinking. Never on the
   * human.
   */
  const breathing = $derived(
    playing && thinking !== null && thinking !== human && thinking === render.turn,
  );

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
    class:still={settings.reduceMotion}
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
        <!-- The glyph chip breathes in its ring (the dot stays still, so the swell fits the pill). -->
        <span
          class="pill-glyph"
          class:respire={breathing}
          data-thinking={breathing ? render.turn : undefined}
          style:--respire-seat={breathing ? `var(--seat-${render.turn}-clair)` : undefined}
        >
          <SeatChip color={render.turn} showName={false} small />
        </span>
      {/if}
      {#if breathing}
        <span class="respire-mark">…</span>
      {/if}
    </span>
    <span class="pill-score" aria-hidden="true" data-score>{game.info.score(us, them)}</span>
  </button>

  {#if infoOpen}
    <Sheet title={game.info.sheetTitle} onclose={() => (infoOpen = false)} opener={pill}>
      <div class="sheet-info" data-info-sheet>
        <InfoBar {render} {human} {names} {thinking} form="column" gear={false} />
      </div>
      {#if players !== undefined}
        <section class="players-section" aria-labelledby="players-heading" data-players-section>
          <h3 id="players-heading" class="players-heading">{tableCopy.game.players.title}</h3>
          <TablePlayers table={players.table} me={players.me} />
        </section>
      {/if}
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
    class:still={settings.reduceMotion}
    data-info-bar
    data-form={form}
  >
    <div class="left">
      <p class="turn" data-turn={playing ? render.turn : ""}>
        {#if playing}
          <span class="dot" class:own={ownTurn} aria-hidden="true"></span>
          <span
            class="glyph"
            class:respire={breathing}
            data-thinking={breathing ? render.turn : undefined}
            style:--respire-seat={breathing ? `var(--seat-${render.turn}-clair)` : undefined}
          >
            <SeatChip color={render.turn} showName={false} small />
          </span>
          {#if ownTurn}
            <span class="name">{game.info.ownTurn}</span>
          {:else}
            <!-- Prefix and name in one box: the row's gap never splits « Tour d’Ana ». -->
            <span class="who"
              ><span class="prefix" class:respire-texte={breathing}
                >{game.info.turnPrefix(turnName)}</span
              ><span class="name other" class:respire-texte={breathing} title={turnName}
                >{turnName}</span
              ></span
            >
            {#if breathing}
              <span class="respire-mark" aria-hidden="true">…</span>
            {/if}
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
      {#if form === "column"}
        <!-- Who plays first in this deal: the bottom bar and the sheet « Infos de la partie » (plan 03-11). -->
        <p class="deal" data-starter={starter}>{game.info.starter(names[starter])}</p>
      {/if}
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
        <SettingsButton
          {onabandon}
          online={onleave !== undefined}
          inGame={onleave !== undefined}
          {onleave}
          {onstop}
        />
      </div>
    {/if}

    {#if form === "column" && gear && players !== undefined}
      <!-- The computer's fourth row (plan 02-06): « À la table »; plan 02-08 adds « Messages ». -->
      <div class="table-row" data-table-row-buttons>
        <button
          type="button"
          class="round"
          aria-label={tableCopy.game.players.title}
          title={tableCopy.game.players.title}
          aria-haspopup="dialog"
          data-players-button
          bind:this={playersButton}
          onclick={() => (playersOpen = true)}
        >
          <Icon name="users" size={24} />
        </button>
      </div>
    {/if}
  </header>

  {#if playersOpen && players !== undefined}
    <Sheet
      title={tableCopy.game.players.title}
      onclose={() => (playersOpen = false)}
      opener={playersButton}
    >
      <TablePlayers table={players.table} me={players.me} />
    </Sheet>
  {/if}
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

  /* Another player's name: a first name online may be 20 letters, « (ordinateur) » may follow (plan
     02-06): cut with « … » at 128 px, the full name in its title and in the text read aloud
     (02-UI-SPEC « Long names »). Horse names fit whole. */
  .name.other {
    max-width: 128px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .prefix {
    flex: none;
    white-space: pre;
  }

  .who {
    display: flex;
    min-width: 0;
  }

  /* The turn's glyph chip, in its own box so that it can breathe (scale about its centre). */
  .glyph {
    flex: none;
    display: inline-flex;
    /* Room for the thinking ring (4 px out, swelling with the breath) clear of the dot and the text. */
    margin: 0 6px;
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

  /* The pill's glyph chip in its own box, its ring 2 px out (the pill is only 44 px high). */
  .pill-glyph {
    flex: none;
    display: inline-flex;
    --respire-inset: 2px;
  }

  .pill-turn .dot {
    width: 8px;
    height: 8px;
  }

  /* The static « … » after the glyph chip: 8 + 3 + 16 + 3 + 10 = 40 px of the pill's 48. */
  .pill-turn .respire-mark {
    line-height: 16px;
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

  .players-section {
    margin-top: var(--space-md);
  }

  .players-heading {
    margin: 0 0 var(--space-xs);
    font-size: var(--heading-size);
    font-weight: 700;
    line-height: var(--heading-line);
  }

  /* The fourth row of the column form: 44 px buttons, left-aligned, 4 px under the pills. */
  .table-row {
    flex: 1 1 100%;
    display: flex;
    gap: var(--space-xs);
  }

  .round {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
    border: 0;
    border-radius: var(--radius-button);
    background: transparent;
    color: var(--creme);
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
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
