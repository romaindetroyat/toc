<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import logo from "../assets/logo/logo-128.webp";
  import { settings } from "../settings/store.svelte.ts";

  // The guide's band (plan 05-06; 05-UI-SPEC « The guide band », D-09): above the board in a lesson,
  // in the place of the compact prompt row (phone) or over the board (computer), as wide as the board.
  // At its left the TOC logo in a cream disc, then the bubble with the step's line, using « tu ». The
  // band is the lesson's live region: it is always mounted and only its text changes, so each new line
  // is read once. A button or card name quoted in the line (« Jouer ») is set in bold; the line is
  // plain text, never markup.

  type Props = {
    /** The line the guide says now. */
    line: string;
  };

  let { line }: Props = $props();

  /** The line in parts: the quoted names (« … ») in bold. */
  const parts = $derived(
    line
      .split(/(«[^»]*»)/)
      .filter((part) => part !== "")
      .map((text) => ({ text, bold: text.startsWith("«") })),
  );

  const reduced = $derived(
    settings.reduceMotion ||
      (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true),
  );
</script>

<div class="band" class:still={settings.reduceMotion} data-guide-band aria-live="polite">
  <span class="avatar" aria-hidden="true">
    <img src={logo} alt="" width="32" height="32" draggable="false" />
  </span>
  <div class="bubble">
    {#key line}
      <p
        class="text"
        data-guide-line
        in:fly={reduced ? { y: 0, duration: 150 } : { y: 4, duration: 150 }}
        out:fade={{ duration: 0 }}
      >
        {#each parts as part, i (i)}{#if part.bold}<b>{part.text}</b>{:else}{part.text}{/if}{/each}
      </p>
    {/key}
  </div>
</div>

<style>
  /* 56 px from 640 px wide (two lines of Body), 80 under (three lines): --band of the game screen. */
  .band {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    box-sizing: border-box;
    width: 100%;
    height: var(--band, 56px);
    min-width: 0;
    overflow: hidden;
  }

  /* A 40 px cream disc with a 2 px walnut line; the logo at 32 px inside. */
  .avatar {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    box-sizing: border-box;
    border: 2px solid var(--noyer);
    border-radius: 50%;
    background: var(--creme);
  }

  .avatar img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: contain;
  }

  /* The bubble: cream, walnut text, a 2 px border, a sharp ink shadow, an 8 px tail toward the
     avatar. Two lines of Body fit the 56 px band with 2 px of padding and the border (three in 80). */
  .bubble {
    position: relative;
    flex: 0 1 auto;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    min-width: 0;
    max-width: min(720px, 100% - 48px);
    max-height: 100%;
    padding: 2px 12px;
    border: 2px solid var(--brun-aide-memoire);
    border-radius: 12px;
    background: var(--creme);
    box-shadow: 2px 2px 0 rgb(42 26 14 / 0.45);
    color: var(--noyer);
  }

  /* The tail: a cream triangle with the bubble's border on its two outer sides. */
  .bubble::before,
  .bubble::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 0;
    height: 0;
    border-style: solid;
    transform: translateY(-50%);
  }

  .bubble::before {
    left: -9px;
    border-width: 7px 8px 7px 0;
    border-color: transparent var(--brun-aide-memoire) transparent transparent;
  }

  .bubble::after {
    left: -6px;
    border-width: 5px 6px 5px 0;
    border-color: transparent var(--creme) transparent transparent;
  }

  .text {
    margin: 0;
    font-size: var(--body-size);
    font-weight: 400;
    line-height: 24px;
    overflow-wrap: anywhere;
  }

  .text b {
    font-weight: 700;
  }
</style>
