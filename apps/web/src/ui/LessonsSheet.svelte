<script lang="ts">
  import { onDestroy } from "svelte";
  import { readProgress } from "../game/lessonProgress.ts";
  import { LESSONS } from "../game/lessons.ts";
  import { lecons } from "../i18n/fr/lecons.ts";
  import { pageStorage } from "../net/device.ts";
  import LessonRow from "./LessonRow.svelte";
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
          <LessonRow
            n={lesson.n}
            title={lesson.title}
            done={finished}
            current={lesson.n === current}
            onclick={(event) => pick(event, lesson.n)}
          />
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

  .restart {
    align-self: flex-start;
    min-height: var(--touch);
  }
</style>
