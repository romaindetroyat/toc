<script lang="ts">
  // One computer seat on the launch screen (D-01, D-02): who it is (small seat chip and role word) and
  // its strength, a radio group of the five horse names. Three forms by the row's own width (03-UI-SPEC
  // « Strength row », a container query): inline from 488 (identity block 96 wide, then the picker,
  // 48 high), stacked from 384 (identity line over the picker, 72 high), narrow below (the picker on
  // two rows, 116 high). The form the container query picked is exposed as data-form.
  // The waiting room of an online table (plan 02-05) uses the « seat » role: the identity line is the
  // small chip and the role word « Ordinateur », and the row is marked with its colour. The pause
  // plate's level step (plan 02-06) uses the « handover » role: no identity line, the group named by
  // `label` (« Quelle force pour l’ordinateur ? »), the row marked data-strength-row="handover".
  import { BOT_LEVELS, type BotLevel, parseBotLevel } from "@toc/bots";
  import type { Color } from "@toc/engine";
  import { bots } from "../i18n/fr/bots.ts";
  import { seats } from "../i18n/fr/seats.ts";
  import SeatChip from "./SeatChip.svelte";
  import Segmented from "./Segmented.svelte";

  type Props = {
    color: Color;
    /**
     * partner: the seat in front; left: the next seat clockwise; right: the previous seat; seat: a free
     * seat of the waiting room (role word « Ordinateur »); handover: the pause plate's level step (no
     * identity line).
     */
    role: "partner" | "left" | "right" | "seat" | "handover";
    /** The group's accessible name for the « handover » role. */
    label?: string;
    value: BotLevel;
    onchange: (level: BotLevel) => void;
    disabled?: boolean;
  };

  let { color, role, label, value, onchange, disabled = false }: Props = $props();

  type Form = "inline" | "stacked" | "narrow";
  type LevelKey = `${BotLevel}`;
  const options = BOT_LEVELS.map((level) => ({
    value: String(level) as LevelKey,
    label: bots.levels[level],
    title: bots.optionTitle(level),
  }));

  const roleWord = $derived(
    role === "seat"
      ? bots.role.seat
      : role === "partner"
        ? bots.role.partner
        : bots.role.opponent,
  );
  const group = $derived(
    role === "handover"
      ? (label ?? bots.heading)
      : role === "seat"
      ? bots.groupSeat(seats[color].name)
      : role === "partner"
        ? bots.groupPartner(seats[color].name)
        : bots.groupOpponent(seats[color].name),
  );

  let row = $state<HTMLDivElement>();
  let body = $state<HTMLDivElement>();
  let form = $state<Form>("stacked");

  /** The form the container query chose, read from its --strength-form custom property. */
  function readForm(): Form {
    if (!body) return form;
    const value = getComputedStyle(body).getPropertyValue("--strength-form").trim();
    return value === "inline" || value === "narrow" ? value : "stacked";
  }

  $effect(() => {
    if (!row) return;
    form = readForm();
    const observer = new ResizeObserver(() => {
      form = readForm();
    });
    observer.observe(row);
    return () => observer.disconnect();
  });

  function choose(key: LevelKey) {
    const level = parseBotLevel(Number(key));
    if (level !== null) onchange(level);
  }
</script>

<div
  class="strength-row"
  data-strength-row={role === "seat" ? color : role}
  data-form={form}
  bind:this={row}
>
  <div class="body" bind:this={body}>
    {#if role !== "handover"}
      <p class="identity">
        <SeatChip {color} small />
        <span class="role">{roleWord}</span>
      </p>
    {/if}
    <div class="picker">
      <Segmented
        {options}
        value={String(value) as LevelKey}
        label={group}
        onchange={choose}
        wrap={form === "narrow"}
        {disabled}
      />
    </div>
  </div>
</div>

<style>
  .strength-row {
    container-type: inline-size;
  }

  /* Stacked (384 <= row < 488): the identity line, 4, the picker full width. */
  .body {
    --strength-form: stacked;
    --segmented-pad: var(--space-xs);
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
    font-weight: 400;
    line-height: var(--label-line);
    white-space: nowrap;
  }

  .picker :global(.option) {
    white-space: nowrap;
  }

  /* Inline (row >= 488): a 96-wide identity block (chip over role word), 8, the picker, 48 high. */
  @container (min-width: 488px) {
    .body {
      --strength-form: inline;
      flex-direction: row;
      align-items: center;
      gap: var(--space-sm);
    }

    .identity {
      flex: none;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: var(--space-xs);
      width: 96px;
    }

    .picker {
      flex: 1;
      min-width: 0;
    }
  }

  /* Narrow (row < 384, portrait phones): the picker wraps on two rows (Segmented's wrap mode). */
  @container (max-width: 383.98px) {
    .body {
      --strength-form: narrow;
    }
  }
</style>
