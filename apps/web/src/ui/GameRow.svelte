<script lang="ts">
  import { teamOf, type Team } from "@toc/engine";
  import type { HistoryGame } from "@toc/protocol";
  import { resultats } from "../i18n/fr/resultats.ts";
  import Icon from "./Icon.svelte";

  // One game of « Mes résultats » (plan 05-01; 05-UI-SPEC Panel 1 « Historique »): a row of 64, the
  // kind's icon (users online, bot solo), line 1 « Victoire · 8 – 5 » (knights home, own team first),
  // line 2 the partner and the opponents, at the right the end date and time.
  type Props = { game: HistoryGame };

  let { game }: Props = $props();

  const mine = $derived(teamOf(game.mine));
  const home = (team: Team) =>
    game.seats.filter((seat) => teamOf(seat.colour) === team).reduce((n, s) => n + s.home, 0);
  const other = $derived<Team>(mine === "bleu-rouge" ? "jaune-vert" : "bleu-rouge");
  const line1 = $derived(
    resultats.row.line1(
      game.winner === mine ? resultats.row.win : resultats.row.loss,
      home(mine),
      home(other),
    ),
  );
  const line2 = $derived(
    game.seats
      .filter((seat) => seat.colour !== game.mine)
      .map((seat) => seat.name)
      .join(", "),
  );
  const day = $derived(
    new Intl.DateTimeFormat("fr", { day: "numeric", month: "short" }).format(game.endedAt),
  );
</script>

<button type="button" class="row" data-game-row={game.id}>
  <span class="icon"><Icon name={game.kind === "solo" ? "bot" : "users"} size={20} /></span>
  <span class="lines">
    <span class="first" data-row-line="1">{line1}</span>
    <span class="second" data-row-line="2">{line2}</span>
  </span>
  <span class="when">{day}</span>
</button>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    box-sizing: border-box;
    width: 100%;
    height: 64px;
    padding: var(--space-sm) 12px;
    border: 0;
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .icon {
    flex: none;
    display: flex;
  }

  .lines {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .first,
  .second {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .first {
    font-size: var(--body-size);
    font-weight: 700;
    line-height: 24px;
    font-variant-numeric: tabular-nums;
  }

  .second,
  .when {
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: 20px;
  }

  .when {
    flex: none;
    text-align: right;
  }
</style>
