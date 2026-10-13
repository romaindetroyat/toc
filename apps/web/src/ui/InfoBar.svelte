<script lang="ts">
  import { type Color, PARTNER, type RenderState } from "@toc/engine";
  import { game } from "../i18n/fr/game.ts";
  import { reglages } from "../i18n/fr/reglages.ts";
  import Icon from "./Icon.svelte";
  import SeatChip from "./SeatChip.svelte";
  import SettingsSheet from "./SettingsSheet.svelte";

  type Props = {
    render: RenderState;
    human: Color;
    /** « toi » for the human, a horse name for each bot. */
    names: Record<Color, string>;
    /** Called once the player has confirmed « Abandonner la partie » (offered by « Réglages »). */
    onabandon?: (to?: string) => void;
  };

  let { render, human, names, onabandon }: Props = $props();

  let settingsOpen = $state(false);
  let gear = $state<HTMLButtonElement | null>(null);

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
</script>

<!-- Info bar (UI-SPEC, D-07): 56 px, three zones. The bot's name is never truncated; below 360 px the
     words « Tour de » are hidden visually and stay in the text for screen readers. -->
<header class="bar" data-info-bar>
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

  <div class="gear" data-settings-slot>
    <button
      type="button"
      class="gear-button"
      aria-label={reglages.openLabel}
      aria-haspopup="dialog"
      bind:this={gear}
      onclick={() => (settingsOpen = true)}
    >
      <Icon name="settings" />
    </button>
  </div>
</header>

{#if settingsOpen}
  <SettingsSheet onclose={() => (settingsOpen = false)} opener={gear} {onabandon} />
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

  .gear-button {
    display: flex;
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
