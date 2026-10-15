<script lang="ts">
  import { ICONS, type IconName } from "./icons.ts";

  type Props = {
    name: IconName;
    /** Size in px (the grid is 24). */
    size?: number;
    /** Accessible name; without it the icon is decorative and hidden from screen readers. */
    label?: string;
  };

  let { name, size = 24, label }: Props = $props();
</script>

<!-- Lucide icon drawn from data (icons.ts): 24 x 24 grid, 2 px stroke, round caps and joins. -->
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
  focusable="false"
>
  {#each ICONS[name] as node, i (i)}
    <svelte:element this={node.tag} {...node.attrs} />
  {/each}
</svg>
