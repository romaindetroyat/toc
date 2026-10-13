<script lang="ts">
  import { type Color, PARTNER, type PawnId, type PlayerView, pawnColor, type Reason } from "@toc/engine";
  import { fade } from "svelte/transition";
  import type { BotPlay } from "../game/session.svelte.ts";
  import type { TurnUiState } from "../game/turnUi.ts";
  import { cardName } from "../i18n/fr/cards.ts";
  import { botLine, game } from "../i18n/fr/game.ts";
  import { settings, updateSettings } from "../settings/store.svelte.ts";
  import Icon from "./Icon.svelte";

  type Props = {
    ui: TurnUiState;
    view: PlayerView;
    human: Color;
    names: Record<Color, string>;
    /** The reason a tapped card cannot be played, or « illegal ». */
    hint: Reason | "illegal" | null;
    /** A tap on the board missed every lit knight. */
    missed: boolean;
    thinking: Color | null;
    lastPlay: BotPlay | null;
    onconfirm: () => void;
    oncancel: () => void;
    onchangeCard: () => void;
    ongive: () => void;
    onpose: () => void;
  };

  let {
    ui,
    view,
    human,
    names,
    hint,
    missed,
    thinking,
    lastPlay,
    onconfirm,
    oncancel,
    onchangeCard,
    ongive,
    onpose,
  }: Props = $props();

  const partner = $derived(PARTNER[human]);

  /** The sentence(s) of the zone: a list of lines, the first one is the prompt. */
  const lines = $derived.by((): string[] => {
    if (hint === "illegal") return [game.illegal];
    if (hint !== null) return [game.reasons[hint]];
    switch (ui.kind) {
      case "waiting": {
        if (view.phase === "won") return [];
        if (thinking !== null) return [game.bot.thinking(names[thinking])];
        if (lastPlay !== null) {
          const line = botLine(names[lastPlay.seat], lastPlay.events);
          return line === "" ? [] : [line];
        }
        return [];
      }
      case "idle":
        return [game.turn.ownTurn];
      case "finishedPrompt":
        return [game.finished(names[partner]), game.turn.ownTurn];
      case "cardSelected": {
        if (missed) return [game.turn.chooseLit];
        return [ui.candidates.length === 1 ? game.turn.singleHorse : game.turn.chooseHorse];
      }
      case "preview": {
        const out = [describe(ui)];
        if (ui.captured.length > 0) out.push(captureLine(ui));
        if (ui.partnerCapture) out.push(game.preview.partnerCapture);
        return out;
      }
      case "exchange":
        return [game.exchange.choose(names[partner])];
      case "exchangeWaiting":
        return [game.exchange.waiting(ui.pending.map((color) => names[color]))];
      case "deadHand":
        return [game.dead.message, game.dead.body];
      case "posed":
        return [game.dead.after];
      case "empty":
        return [game.empty.heading, game.empty.body];
    }
  });

  function describe(state: Extract<TurnUiState, { kind: "preview" }>): string {
    const d = state.description;
    if (d.verb === "exit") return game.preview.exit;
    const main = d.verb === "back" ? game.preview.back : game.preview.advance(cardName(state.card), d.steps);
    return d.entersHome ? `${main} ${game.preview.home}` : main;
  }

  function captureLine(state: Extract<TurnUiState, { kind: "preview" }>): string {
    const victims = state.captured;
    if (victims.length > 1) return game.preview.captureMany(victims.length);
    return game.preview.captureOne(pawnColor(victims[0] as PawnId));
  }

  // One key per displayed state, so the zone cross-fades (150 ms, none under reduced motion).
  const key = $derived(`${ui.kind}|${hint ?? ""}|${missed}|${thinking ?? ""}|${lines.join("/")}`);
  const fadeMs = $derived(settings.reduceMotion ? 0 : 150);
  const showFast = $derived(ui.kind === "waiting" && view.phase !== "won");
</script>

<!-- Action zone (UI-SPEC): one state at a time, an aria-live region, prompt lines never truncated. -->
<section class="zone" aria-live="polite" data-action-zone data-state={ui.kind}>
  {#key key}
    <div class="content" in:fade={{ duration: fadeMs }}>
      <div class="text">
        {#each lines as line, i (i)}
          <p class:prompt={i === 0}>{line}</p>
        {/each}
      </div>

      {#if ui.kind === "cardSelected"}
        <div class="buttons">
          <button type="button" class="btn btn-secondary" onclick={onchangeCard}>
            {game.buttons.changeCard}
          </button>
        </div>
      {:else if ui.kind === "preview"}
        <div class="buttons">
          <button type="button" class="btn btn-secondary" onclick={oncancel}>
            {game.buttons.cancel}
          </button>
          <button type="button" class="btn btn-primary play" onclick={onconfirm}>
            {ui.partnerCapture ? game.buttons.playAnyway : game.buttons.play}
          </button>
        </div>
      {:else if ui.kind === "exchange"}
        <div class="buttons">
          <button
            type="button"
            class="btn btn-primary play"
            disabled={ui.selected === undefined}
            onclick={ongive}
          >
            {game.exchange.pass}
          </button>
        </div>
      {:else if ui.kind === "deadHand"}
        <div class="buttons">
          <button type="button" class="btn btn-primary play" onclick={onpose}>
            {game.dead.pose}
          </button>
        </div>
      {/if}
    </div>
  {/key}

  {#if showFast}
    <button
      type="button"
      class="fast"
      aria-pressed={settings.fast}
      aria-label={game.fast}
      onclick={() => updateSettings({ fast: !settings.fast })}
    >
      <Icon name="fast-forward" />
      <span class="fast-label">{game.fast}</span>
    </button>
  {/if}
</section>

<style>
  .zone {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    min-height: 72px;
    max-height: 160px;
    padding: var(--space-sm) var(--space-md);
    overflow: visible;
  }

  /* The prompt and its buttons share a row when they fit (72 px), and stack when they do not. */
  .content {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .text {
    flex: 1 1 140px;
    min-width: 0;
  }

  .text p {
    margin: 0;
    color: var(--creme);
    font-size: var(--body-size);
    line-height: var(--body-line);
    /* Up to three lines, never cut: the zone grows instead. */
    overflow-wrap: anywhere;
  }

  .text p:not(.prompt) {
    color: var(--creme-attenuee);
  }

  .buttons {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-left: auto;
    gap: var(--space-sm);
  }

  .play {
    min-width: 120px;
  }

  /* « Avance rapide »: a 44 x 44 toggle, with its label from 600 px up. */
  .fast {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    min-width: var(--touch);
    min-height: var(--touch);
    padding: 0 var(--space-sm);
    border: 2px solid var(--creme);
    border-radius: var(--radius-button);
    background: transparent;
    color: var(--creme);
    font-size: var(--label-size);
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .fast[aria-pressed="true"] {
    background: var(--creme);
    color: var(--noyer);
  }

  .fast-label {
    display: none;
  }

  @media (min-width: 600px) {
    .fast {
      min-width: 120px;
    }

    .fast-label {
      display: inline;
    }
  }
</style>
