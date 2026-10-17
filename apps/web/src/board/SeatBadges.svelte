<script lang="ts">
  import { riderBox, SCENE } from "@toc/board";
  import { COLORS } from "@toc/engine";
  import type { TablePublic } from "@toc/protocol";
  import Icon from "../ui/Icon.svelte";

  // The rider badges of an online table (plan 02-06, 02-UI-SPEC « Connection state on the board »): a
  // 24 px disc (bois sombre, 2 px cream border, 14 px cream icon) centred on the ink rider of each
  // person's seat whose person is offline (wifi-off) or that the computer plays for (bot). None for a
  // person online nor for a computer seat. Placed by percentages of the scene like the thinking glow,
  // in the board's HTML layer over the glow and under the knights; never a target, hidden from screen
  // readers (« À la table » and the pause plate say it in words). A state, not an event: no motion.

  type Props = { k: number; table: TablePublic };

  let { k, table }: Props = $props();

  const pct = (value: number, of: number) => `${(value / of) * 100}%`;

  const badges = $derived(
    COLORS.flatMap((color) => {
      const seat = table.seats[color];
      if (seat.kind !== "human") return [];
      const kind: "bot" | "wifi-off" | null =
        seat.handedOver !== null ? "bot" : seat.online ? null : "wifi-off";
      if (kind === null) return [];
      const box = riderBox(color, k);
      return [
        {
          color,
          kind,
          left: pct(box.x + box.w / 2, SCENE.width),
          top: pct(box.y + box.h / 2, SCENE.height),
        },
      ];
    }),
  );
</script>

{#each badges as badge (badge.color)}
  <div
    class="seat-badge"
    data-seat-badge={badge.color}
    data-kind={badge.kind}
    aria-hidden="true"
    style:left={badge.left}
    style:top={badge.top}
  >
    <Icon name={badge.kind} size={14} />
  </div>
{/each}

<style>
  .seat-badge {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 24px;
    height: 24px;
    border: 2px solid var(--creme);
    border-radius: 50%;
    background: var(--bois-sombre);
    color: var(--creme);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
</style>
