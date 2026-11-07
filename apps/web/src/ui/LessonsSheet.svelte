<script lang="ts">
  import { onDestroy } from "svelte";
  import { readProgress } from "../game/lessonProgress.ts";
  import { LESSONS } from "../game/lessons.ts";
  import { lecons } from "../i18n/fr/lecons.ts";
  import { pageStorage } from "../net/device.ts";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";

  // « Les leçons », opened from the lesson pill (plan 05-06; 05-UI-SPEC « The lesson screen »): the
  // eight lessons with their done marks (toc.tutorial.v1), each a link that starts it, then
  // « Recommencer cette leçon » and « Fermer ». The rows are those of the page « Apprendre à jouer »
  // (05-UI-SPEC): a 40 px oak disc with the number (a check once done), the title, « Environ 1
  // minute » or « Faite ».

  type Props = {
    /** The lesson on screen. */
    current: number;
    /** The pill: it gets the focus back on close. */
    opener: HTMLElement | null;
    /** « Recommencer cette leçon »: the position and the first line again. */
    onrestart: () => void;
    /** A row: that lesson (the screen closes the sheet first, then opens it). */
    onpick: (n: number) => void;
    onclose: () => void;
    /** Once the sheet has gone (after its slide-out). */
    ongone?: () => void;
  };

  let { current, opener, onrestart, onpick, onclose, ongone }: Props = $props();

  onDestroy(() => ongone?.());

  /** Read once when the sheet opens: a lesson finished meanwhile is already in the storage. */
  const done = readProgress(pageStorage()).done;

  /**
   * A row: the lesson on screen restarts; another one opens once the sheet has slid away, so the new
   * lesson never starts under the old screen's sheet. The link stays a link (its address is the
   * lesson's).
   */
  function pick(event: MouseEvent, n: number) {
    event.preventDefault();
    if (n === current) onrestart();
    else onpick(n);
  }
</script>

<Sheet title={lecons.sheet.title} closeLabel={lecons.sheet.close} {opener} {onclose}>
  <div class="content" data-lessons-sheet>
    <ol class="rows">
      {#each LESSONS as lesson (lesson.n)}
        {@const finished = done.includes(lesson.n)}
        <li>
          <a
            class="row"
            href={`#/apprendre/${lesson.n}`}
            data-lesson={lesson.n}
            data-done={finished}
            aria-current={lesson.n === current ? "page" : undefined}
            aria-label={lecons.sheet.row(lesson.n, lesson.title, finished)}
            onclick={(event) => pick(event, lesson.n)}
          >
            <span class="disc tabular" aria-hidden="true">
              {#if finished}
                <Icon name="check" size={20} />
              {:else}
                {lesson.n}
              {/if}
            </span>
            <span class="lines" aria-hidden="true">
              <span class="title">{lesson.title}</span>
              <span class="sub">{finished ? lecons.sheet.done : lecons.sheet.about}</span>
            </span>
          </a>
        </li>
      {/each}
    </ol>
    <button type="button" class="btn btn-text restart" data-lesson-restart onclick={onrestart}>
      {lecons.sheet.restart}
    </button>
  </div>
</Sheet>

<style>
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

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

  /* The lesson on screen: a cream outline (never amber). */
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

  .restart {
    align-self: flex-start;
    min-height: var(--touch);
  }
</style>
