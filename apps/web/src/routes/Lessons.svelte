<script lang="ts">
  import { nextLesson, readProgress } from "../game/lessonProgress.ts";
  import { LESSONS } from "../game/lessons.ts";
  import { lecons } from "../i18n/fr/lecons.ts";
  import { pageStorage } from "../net/device.ts";
  import Icon from "../ui/Icon.svelte";
  import LessonRow from "../ui/LessonRow.svelte";
  import Page from "../ui/Page.svelte";
  import RulesSheet from "../ui/RulesSheet.svelte";

  // « Apprendre à jouer » at #/apprendre (plan 05-08, D-07, D-08; 05-UI-SPEC « « Apprendre à jouer »
  // #/apprendre »), the « Page » layout of « Mon compte »: not behind « Tourne ton téléphone ».
  // - Left: the text, the primary by progress (« Commencer », « Continuer : leçon {n} », or « Jouer
  //   contre l’ordinateur » once all are done, then « Revoir depuis le début »), the note and « Règles
  //   du jeu » (the rules sheet over the page, on « Le but »).
  // - Right: the eight lessons, each a link to #/apprendre/<n>, « Environ 1 minute » or « Faite ».
  // The progress is toc.tutorial.v1, read untrusted (an unreadable value is empty progress).

  const done = readProgress(pageStorage()).done;
  const next = nextLesson(done);

  const primary =
    next === null
      ? { href: "#/ordinateur", label: lecons.page.computer }
      : {
          href: `#/apprendre/${next}`,
          label: done.length === 0 ? lecons.page.start : lecons.page.next(next),
        };

  let rulesOpen = $state(false);
  let rulesButton = $state<HTMLButtonElement | null>(null);
</script>

<Page
  title={lecons.page.title}
  homeLabel={lecons.page.home}
  attrs={{ "data-lessons-page": "" }}
  leftAttrs={{ "data-lessons-left": "" }}
  rightAttrs={{ "data-lessons-right": "" }}
>
  {#snippet left()}
    <p class="t-body text">{lecons.page.text}</p>
    <a class="btn btn-primary wide" href={primary.href} data-lessons-primary>
      <Icon name="play" size={20} />
      {primary.label}
    </a>
    {#if next === null}
      <a class="btn btn-secondary wide again" href="#/apprendre/1" data-lessons-again>
        {lecons.page.again}
      </a>
    {/if}
    <p class="t-label muted note">{lecons.page.note}</p>
    <button
      type="button"
      class="btn btn-text rules"
      aria-haspopup="dialog"
      bind:this={rulesButton}
      onclick={() => (rulesOpen = true)}
    >
      {lecons.page.rules}
    </button>
  {/snippet}

  {#snippet right()}
    <ol class="rows" aria-label={lecons.page.list}>
      {#each LESSONS as lesson (lesson.n)}
        <li>
          <LessonRow n={lesson.n} title={lesson.title} done={done.includes(lesson.n)} />
        </li>
      {/each}
    </ol>
  {/snippet}
</Page>

{#if rulesOpen}
  <RulesSheet tab="but" onclose={() => (rulesOpen = false)} opener={rulesButton} />
{/if}

<style>
  p {
    margin: 0;
  }

  .muted {
    color: var(--creme-attenuee);
  }

  .text {
    margin-bottom: var(--space-md);
  }

  .wide {
    width: 100%;
    box-sizing: border-box;
  }

  .again {
    margin-top: var(--space-sm);
  }

  .note {
    margin-top: var(--space-md);
  }

  .rules {
    align-self: flex-start;
    min-height: var(--touch);
    margin-left: calc(-1 * var(--space-sm));
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
