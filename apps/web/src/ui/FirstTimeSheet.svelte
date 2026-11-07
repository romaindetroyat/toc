<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { lecons } from "../i18n/fr/lecons.ts";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";

  // « Première fois ? » (plan 05-08, D-08; 05-UI-SPEC « First-launch sheet »): the normal sheet over the
  // home of a brand-new device, once (the home asks lessonProgress.firstTimeDue, which writes the key).
  // The primary « Apprendre en 10 minutes » takes the focus and leads to lesson 1; the sheet's own
  // close is « Plus tard », and Échap does the same. The lesson opens once the sheet has slid away, so
  // it never starts under the sheet (the LessonsSheet pattern of plan 05-06).
  type Props = {
    onclose: () => void;
  };

  let { onclose }: Props = $props();

  let primary = $state<HTMLAnchorElement | null>(null);
  let learn = false;

  onMount(() => {
    void tick().then(() => primary?.focus({ preventScroll: true }));
  });

  onDestroy(() => {
    if (learn) location.hash = "#/apprendre/1";
  });

  function start(event: MouseEvent) {
    event.preventDefault();
    learn = true;
    onclose();
  }
</script>

<Sheet title={lecons.firstTime.title} closeLabel={lecons.firstTime.later} {onclose}>
  <div class="content" data-first-time-sheet>
    <p class="t-body">{lecons.firstTime.text}</p>
    <a class="btn btn-primary wide" href="#/apprendre/1" bind:this={primary} onclick={start}>
      <Icon name="graduation-cap" size={20} />
      {lecons.firstTime.start}
    </a>
    <p class="t-label muted">{lecons.firstTime.note}</p>
  </div>
</Sheet>

<style>
  .content {
    display: flex;
    flex-direction: column;
  }

  p {
    margin: 0;
  }

  .wide {
    width: 100%;
    box-sizing: border-box;
    margin: var(--space-md) 0 var(--space-sm);
  }

  .muted {
    color: var(--creme-attenuee);
  }
</style>
