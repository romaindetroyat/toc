<script lang="ts">
  // One computer seat on the launch screen (D-01, D-02): who it is (small seat chip and role word) and
  // its strength, a radio group of the five horse names. The stacked form; plan 03-03 adds the inline
  // and narrow forms and the option title.
  import { BOT_LEVELS, type BotLevel, parseBotLevel } from "@toc/bots";
  import type { Color } from "@toc/engine";
  import { bots } from "../i18n/fr/bots.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import SeatChip from "./SeatChip.svelte";
  import Segmented from "./Segmented.svelte";

  type Props = {
    color: Color;
    /** partner: the seat in front; left: the next seat clockwise; right: the previous seat. */
    role: "partner" | "left" | "right";
    value: BotLevel;
    onchange: (level: BotLevel) => void;
  };

  let { color, role, value, onchange }: Props = $props();

  type LevelKey = `${BotLevel}`;
  const options = BOT_LEVELS.map((level) => ({
    value: String(level) as LevelKey,
    label: bots.levels[level],
  }));

  const roleWord = $derived(role === "partner" ? bots.role.partner : bots.role.opponent);
  const group = $derived(
    role === "partner"
      ? bots.groupPartner(seats[color].name)
      : bots.groupOpponent(seats[color].name),
  );

  function choose(key: LevelKey) {
    const level = parseBotLevel(Number(key));
    if (level !== null) onchange(level);
  }
</script>

<div class="strength-row" data-strength-row={role}>
  <p class="identity">
    <SeatChip {color} small />
    <span class="role">{roleWord}</span>
  </p>
  <Segmented {options} value={String(value) as LevelKey} label={group} onchange={choose} />
</div>

<style>
  .strength-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin: 0;
    min-height: 20px;
  }

  .role {
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: var(--label-line);
  }
</style>
