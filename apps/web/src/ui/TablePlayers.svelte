<script lang="ts">
  import { COLORS, type Color, PARTNER } from "@toc/engine";
  import type { TablePublic } from "@toc/protocol";
  import { bots } from "../i18n/fr/bots.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import { table as copy } from "../i18n/fr/table.ts";
  import Icon from "./Icon.svelte";
  import type { IconName } from "./icons.ts";
  import SeatChip from "./SeatChip.svelte";

  // « À la table » (plan 02-06, 02-UI-SPEC « Players list »): the four seats in COLORS order, 48 high
  // each: the small seat chip, the name (cut at 160 px, whole in the row's sentence), the tags (toi,
  // partenaire, adversaire, the crown and « chef de table »), and the state line with its icon (none
  // online, wifi-off offline, bot while the computer plays for the person). Read as one sentence per
  // row. The same list in the phone's « Infos de la partie » and the computer's « À la table » sheet.

  type Props = { table: TablePublic; me: Color };

  let { table, me }: Props = $props();

  const players = copy.game.players;

  const rows = $derived(
    COLORS.map((color) => {
      const seat = table.seats[color];
      const level = bots.levels[seat.level];
      const name = seat.name ?? seats[color].name;
      const tags: string[] = [
        color === me ? players.you : color === PARTNER[me] ? players.partner : players.opponent,
      ];
      const host = table.host === color;
      if (host) tags.push(players.host);
      let status: string;
      let icon: IconName | null = null;
      let state: "online" | "offline" | "handed-over" | "computer";
      if (seat.kind !== "human") {
        status = players.computer(level);
        state = "computer";
      } else if (seat.handedOver !== null) {
        status = players.handedOver(bots.levels[seat.handedOver]);
        icon = "bot";
        state = "handed-over";
      } else if (seat.online) {
        status = players.online;
        state = "online";
      } else {
        status = players.offline;
        icon = "wifi-off";
        state = "offline";
      }
      return {
        color,
        name,
        tags,
        host,
        status,
        icon,
        state,
        sentence: players.row(seats[color].name, name, tags, status),
      };
    }),
  );
</script>

<ul class="players" data-players>
  {#each rows as row (row.color)}
    <li class="row" data-player={row.color} data-player-state={row.state}>
      <span class="sr-only">{row.sentence}</span>
      <span class="visual" aria-hidden="true">
        <SeatChip color={row.color} showName={false} label={false} small />
        <span class="text">
          <span class="first">
            <span class="name" title={row.name}>{row.name}</span>
            {#each row.tags as tag (tag)}
              <span class="tag">
                {#if tag === players.host}
                  <Icon name="crown" size={14} />
                {/if}
                {tag}
              </span>
            {/each}
          </span>
          <span class="status">
            {#if row.icon !== null}
              <Icon name={row.icon} size={14} />
            {/if}
            {row.status}
          </span>
        </span>
      </span>
    </li>
  {/each}
</ul>

<style>
  .players {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    min-height: 48px;
  }

  .visual {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .first {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0 var(--space-sm);
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .name {
    max-width: 160px;
    overflow: hidden;
    color: var(--creme);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag,
  .status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    font-weight: 400;
    line-height: var(--label-line);
  }

  .tag :global(svg),
  .status :global(svg) {
    flex: none;
  }
</style>
