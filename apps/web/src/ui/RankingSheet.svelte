<script lang="ts">
  import { resultats } from "../i18n/fr/resultats.ts";
  import Sheet from "./Sheet.svelte";

  // « Le classement » (plan 05-09, D-13; 05-UI-SPEC Panel 3), opened by « Comment ça marche ? »: the
  // normal sheet with the three paragraphs of the method and « Fermer »; the focus goes back to the
  // button on close.
  type Props = { opener: HTMLElement | null; onclose: () => void };

  let { opener, onclose }: Props = $props();

  const copy = resultats.ranking.sheet;
</script>

<Sheet title={copy.title} closeLabel={copy.close} {opener} {onclose}>
  <div class="text" data-ranking-sheet>
    {#each copy.paragraphs as paragraph (paragraph)}
      <p class="t-body">{paragraph}</p>
    {/each}
  </div>
</Sheet>

<style>
  .text {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  p {
    margin: 0;
  }
</style>
