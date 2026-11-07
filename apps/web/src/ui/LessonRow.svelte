<script lang="ts">
  import { lecons } from "../i18n/fr/lecons.ts";
  import Icon from "./Icon.svelte";

  // A lesson's row (05-UI-SPEC « « Apprendre à jouer » #/apprendre »), shared by the page #/apprendre
  // (plan 05-08) and the sheet « Les leçons » (plan 05-06): a 56 px link on bois sombre, a 40 px oak
  // disc with the number (a check once done), 12, the title (Body 700) over « Environ 1 minute » or
  // « Faite » (Label muted). Named « Leçon 3, Manger, faite ».
  type Props = {
    n: number;
    title: string;
    done: boolean;
    /** The lesson on screen (the sheet): a cream outline, never amber. */
    current?: boolean;
    onclick?: (event: MouseEvent) => void;
  };

  let { n, title, done, current = false, onclick }: Props = $props();
</script>

<a
  class="row"
  href={`#/apprendre/${n}`}
  data-lesson={n}
  data-done={done}
  aria-current={current ? "page" : undefined}
  aria-label={lecons.sheet.row(n, title, done)}
  {onclick}
>
  <span class="disc tabular" aria-hidden="true">
    {#if done}
      <Icon name="check" size={20} />
    {:else}
      {n}
    {/if}
  </span>
  <span class="lines" aria-hidden="true">
    <span class="title">{title}</span>
    <span class="sub">{done ? lecons.sheet.done : lecons.sheet.about}</span>
  </span>
</a>

<style>
  /* A 56 px row on bois sombre: the disc, 12, the title (Body 700) over its line 2 (Label muted). */
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    box-sizing: border-box;
    min-height: 56px;
    padding: 0 12px;
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
    color: var(--creme);
    text-decoration: none;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .row[aria-current="page"] {
    box-shadow: inset 0 0 0 2px var(--creme);
  }

  .disc {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--chene);
    color: var(--noyer);
    font-size: var(--heading-size);
    font-weight: 700;
    line-height: 1;
  }

  .lines {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .title {
    font-size: var(--body-size);
    font-weight: 700;
    line-height: var(--body-line);
  }

  .sub {
    color: var(--creme-attenuee);
    font-size: var(--label-size);
    line-height: var(--label-line);
  }
</style>
