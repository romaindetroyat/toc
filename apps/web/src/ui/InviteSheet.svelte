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
  import type { FriendEntry } from "@toc/protocol";
  import { friends as loadFriends } from "../account/api.ts";
  import { type InviteTab, inviteHere, inviteTabDefault } from "../account/flow.ts";
  import { sessionEnded } from "../account/store.svelte.ts";
  import { amis } from "../i18n/fr/amis.ts";
  import { table as copy } from "../i18n/fr/table.ts";
  import FriendRow from "./FriendRow.svelte";
  import Icon from "./Icon.svelte";
  import QrCode from "./QrCode.svelte";
  import Segmented from "./Segmented.svelte";
  import Sheet from "./Sheet.svelte";
  import { showToast } from "./toast.svelte.ts";

  // « Inviter à la table » (02-UI-SPEC « Invite sheet », D-02): the QR code of the table's link at the
  // left; at the right the text, the read-only link (it selects itself on focus), « Partager le lien »
  // through the device's share sheet when it has one, and « Copier le lien » (the primary when it
  // cannot share). A cancelled share does nothing; a refused copy says so and selects the link.
  // Plan 04-10: the variant « Inviter un proche » of « Mes amis » (04-UI-SPEC « Invite sheet « Inviter
  // un proche » »): an account invitation link, its own title, text with the date, link and QR names
  // and shared text; same geometry. The table's sheet is unchanged.
  // Plan 04-11 (04-UI-SPEC « In the waiting room »): for a signed-in person at the table (`friendsAt`),
  // a Segmented « Mes amis » | « Lien et QR code » at the top of the body, on « Mes amis » when the
  // person has a friend, else on the link (the same rule for the sheet that opens by itself after the
  // creation). « Mes amis » lists the friends in alphabetical order with FriendRow's invite variant;
  // the link tab is the 02 content. Guests (no `friendsAt`) get the 02 sheet exactly.
  type Props = {
    /** The table's link, as anyone opens it (or the invitation link). */
    url: string;
    /** This device's first name (the pseudo for an invitation), for the shared text. */
    name: string;
    onclose: () => void;
    /** « Inviter »: it gets the focus back. */
    opener?: HTMLElement | null;
    /** "proche": an account invitation (« Inviter un proche »); "table" by default. */
    kind?: "table" | "proche";
    /** The invitation's last day (« 25 octobre »), for « Ce lien sert une fois, jusqu’au … ». */
    until?: string;
    /**
     * Plan 04-11: a signed-in person at the table: the table's id and the names at the table (seated
     * or not), for the « Mes amis » tab. Absent for a guest.
     */
    friendsAt?: { table: string; names: readonly (string | null)[] } | null;
  };

  let {
    url,
    name,
    onclose,
    opener = null,
    kind = "table",
    until = "",
    friendsAt = null,
  }: Props = $props();

  // --- Plan 04-11: the « Mes amis » tab ---
  const tabbed = $derived(kind === "table" && friendsAt !== null);
  /** The tab the player chose; until then, the default rule once the friends are known. */
  let chosen = $state<InviteTab | null>(null);
  let list = $state.raw<FriendEntry[] | null>(null);
  let failed = $state(false);
  const tab = $derived<InviteTab>(
    chosen ?? (list === null ? (failed ? "lien" : "amis") : inviteTabDefault(list.length)),
  );

  async function fetchFriends() {
    failed = false;
    const result = await loadFriends();
    if (result.ok) {
      list = result.friends;
      return;
    }
    if (result.reason === "signed-out") sessionEnded();
    failed = true;
  }

  $effect(() => {
    if (tabbed && list === null && !failed) void fetchFriends();
  });

  function retry() {
    void fetchFriends();
  }

  function leave(friend: FriendEntry) {
    list = (list ?? []).filter((each) => each.id !== friend.id);
  }

  const tabOptions = [
    { value: "amis" as const, label: amis.table.friends },
    { value: "lien" as const, label: amis.table.link },
  ];

  const words = $derived(
    kind === "proche"
      ? {
          title: amis.sheet.title,
          text: amis.sheet.text(until),
          linkLabel: amis.sheet.linkLabel,
          qrLabel: amis.sheet.qrLabel,
          shareTitle: amis.sheet.shareTitle,
          shareText: amis.sheet.shareText(name),
        }
      : {
          title: copy.invite.title,
          text: copy.invite.text,
          linkLabel: copy.invite.linkLabel,
          qrLabel: copy.invite.qrLabel,
          shareTitle: copy.invite.shareTitle,
          shareText: copy.invite.shareText(name),
        },
  );

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  let field = $state<HTMLInputElement | null>(null);

  async function share() {
    try {
      await navigator.share({
        title: words.shareTitle,
        text: words.shareText,
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

{#snippet linkContent()}
  <div class="invite" data-invite-sheet data-invite-kind={kind}>
    <QrCode {url} label={words.qrLabel} />
    <div class="side">
      <p class="t-body text">{words.text}</p>
      <input
        class="link"
        type="text"
        readonly
        value={url}
        aria-label={words.linkLabel}
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
{/snippet}

<Sheet title={words.title} {onclose} {opener}>
  {#if tabbed && friendsAt !== null}
    <div class="tabbed">
      <Segmented
        options={tabOptions}
        value={tab}
        label={amis.table.tabs}
        onchange={(value) => (chosen = value)}
      />
      <div data-invite-tab={tab}>
        {#if tab === "lien"}
          {@render linkContent()}
        {:else if list === null && !failed}
          <p class="t-body muted" role="status" data-invite-friends-loading>{amis.table.loading}</p>
        {:else if list === null}
          <div class="state">
            <p class="t-body">{amis.table.error}</p>
            <button type="button" class="btn btn-secondary" onclick={retry}>{amis.table.retry}</button>
          </div>
        {:else if list.length === 0}
          <div class="state" data-invite-friends-empty>
            <p class="t-body">{amis.table.empty}</p>
            <button type="button" class="btn btn-text" onclick={() => (chosen = "lien")}>
              {amis.table.link}
            </button>
          </div>
        {:else}
          <ul class="friends" data-invite-friends>
            {#each list as friend (friend.id)}
              <FriendRow
                {friend}
                variant="invite"
                table={friendsAt.table}
                here={inviteHere(friend.pseudo, friendsAt.names)}
                onleave={leave}
              />
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {:else}
    {@render linkContent()}
  {/if}
</Sheet>

<style>
  /* Plan 04-11: the segmented control, 8, the tab (4 on a phone held sideways, below). */
  .tabbed {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .friends {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
  }

  .state p,
  .muted {
    margin: 0;
  }

  .muted {
    color: var(--creme-attenuee);
  }

  .state .btn-text {
    min-height: var(--touch);
  }

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

    /* The link tab fits the sheet's 199 px body at 844 x 390 (UI-SPEC backstop): the control 44 high
       borders included (40 + 2 x 2), 4, then the 02 column 148: 196. */
    .tabbed {
      gap: var(--space-xs);
    }

    .tabbed :global([role="radio"]) {
      min-height: calc(var(--touch) - 4px);
    }
  }
</style>
