<script module lang="ts">
  // The invite sheet opens by itself once, for the creator, right after the table is created (D-02):
  // the home marks the new table's id for this tab, and the waiting room takes the mark.
  const MARK = "toc.invite.v1";

  function session(): Storage | null {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  /** The home has just created table `id` in this tab. */
  export function markNewTable(id: string): void {
    try {
      session()?.setItem(MARK, id);
    } catch {
      // Storage refused (private mode, quota): the sheet simply does not open by itself.
    }
  }

  /** True once if table `id` was just created in this tab; the mark is gone afterwards. */
  export function takeNewTable(id: string): boolean {
    try {
      const store = session();
      if (store?.getItem(MARK) !== id) return false;
      store.removeItem(MARK);
      return true;
    } catch {
      return false;
    }
  }
</script>

<script lang="ts">
  import { table as copy } from "../i18n/fr/table.ts";
  import Icon from "./Icon.svelte";
  import QrCode from "./QrCode.svelte";
  import Sheet from "./Sheet.svelte";
  import { showToast } from "./toast.svelte.ts";

  // « Inviter à la table » (02-UI-SPEC « Invite sheet », D-02): the QR code of the table's link at the
  // left; at the right the text, the read-only link (it selects itself on focus), « Partager le lien »
  // through the device's share sheet when it has one, and « Copier le lien » (the primary when it
  // cannot share). A cancelled share does nothing; a refused copy says so and selects the link.
  type Props = {
    /** The table's link, as anyone opens it. */
    url: string;
    /** This device's first name, for the shared text. */
    name: string;
    onclose: () => void;
    /** « Inviter »: it gets the focus back. */
    opener?: HTMLElement | null;
  };

  let { url, name, onclose, opener = null }: Props = $props();

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  let field = $state<HTMLInputElement | null>(null);

  async function share() {
    try {
      await navigator.share({
        title: copy.invite.shareTitle,
        text: copy.invite.shareText(name),
        url,
      });
    } catch {
      // Cancelled (AbortError) or refused: nothing to say, the link is still on screen.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      showToast(copy.invite.copied);
    } catch {
      showToast(copy.invite.copyFailed);
      field?.focus();
      field?.select();
    }
  }
</script>

<Sheet title={copy.invite.title} {onclose} {opener}>
  <div class="invite" data-invite-sheet>
    <QrCode {url} />
    <div class="side">
      <p class="t-body text">{copy.invite.text}</p>
      <input
        class="link"
        type="text"
        readonly
        value={url}
        aria-label={copy.invite.linkLabel}
        bind:this={field}
        onfocus={(event) => event.currentTarget.select()}
        data-invite-link
      />
      {#if canShare}
        <button type="button" class="btn btn-primary" data-invite-share onclick={share}>
          <Icon name="share-2" size={20} />
          {copy.invite.share}
        </button>
      {/if}
      <button
        type="button"
        class="btn"
        class:btn-primary={!canShare}
        class:btn-secondary={canShare}
        data-invite-copy
        onclick={copyLink}
      >
        <Icon name="copy" size={20} />
        {copy.invite.copy}
      </button>
    </div>
  </div>
</Sheet>

<style>
  /* Two columns in the sheet's 432 px: the 164 px QR box, 16, the 252 px column. */
  .invite {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .side {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space-sm);
    min-width: 0;
  }

  .text {
    margin: 0;
  }

  .link {
    box-sizing: border-box;
    width: 100%;
    height: 44px;
    padding: 0 var(--space-sm);
    border: 0;
    border-radius: var(--radius-card);
    background: var(--creme);
    color: var(--noyer);
    font: inherit;
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .side .btn {
    width: 100%;
    padding-inline: var(--space-sm);
  }

  /* A phone held sideways (the sheet is at most 90 % of 320 to 420 px): the sheet's title already says
     what to do, so the text line is only read out, and the link and both buttons come 4 apart, in sight
     without scrolling the sheet (the QR code's caption may need a short scroll). */
  @media (max-height: 420px) {
    .text {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .side {
      gap: var(--space-xs);
    }
  }
</style>
