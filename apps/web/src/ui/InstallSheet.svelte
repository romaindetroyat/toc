<script lang="ts">
  import { account } from "../account/store.svelte.ts";
  import { appli } from "../i18n/fr/appli.ts";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";

  // « Installer TOC » (04-UI-SPEC « Install sheet », plan 04-08): Safari's steps on iPhone and iPad. An
  // ordered list: a 28 px cream disc with the number (Label 700 walnut), 8, the text (Body) with the
  // 20 px glyph inline where the button looks so (aria-hidden: the words say it). Step 4 only when
  // signed in: the installed app does not share Safari's session (04-RESEARCH Pitfall 4).
  type Props = { onclose: () => void; opener?: HTMLElement | null };

  let { onclose, opener = null }: Props = $props();
</script>

<Sheet title={appli.sheet.title} {onclose} {opener} closeLabel={appli.sheet.close}>
  <div class="install" data-install-sheet>
    <p class="intro">{appli.sheet.intro}</p>
    <ol class="steps">
      <li>
        <span class="disc" aria-hidden="true">1</span>
        <span class="text">
          {appli.sheet.share.before}
          <span class="glyph"><Icon name="share" size={20} /></span>{appli.sheet.share.after}
        </span>
      </li>
      <li>
        <span class="disc" aria-hidden="true">2</span>
        <span class="text">
          {appli.sheet.addToHome.before}
          <span class="glyph"><Icon name="square-plus" size={20} /></span>{appli.sheet.addToHome.after}
        </span>
      </li>
      <li>
        <span class="disc" aria-hidden="true">3</span>
        <span class="text">{appli.sheet.add}</span>
      </li>
      {#if account.current !== null}
        <li data-install-step="compte">
          <span class="disc" aria-hidden="true">4</span>
          <span class="text">{appli.sheet.signIn}</span>
        </li>
      {/if}
    </ol>
  </div>
</Sheet>

<style>
  .install {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .intro {
    margin: 0;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps li {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  /* The number in a 28 px cream disc, Label 700 walnut, level with the first line of the text. */
  .disc {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--creme);
    color: var(--noyer);
    font-size: var(--label-size);
    font-weight: 700;
    line-height: 1;
  }

  .text {
    min-width: 0;
    font-size: var(--body-size);
    line-height: var(--body-line);
  }

  .glyph {
    display: inline-flex;
    vertical-align: -4px;
  }
</style>
