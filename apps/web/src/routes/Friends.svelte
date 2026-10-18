<script lang="ts">
  import type { FriendEntry, PendingInvitation } from "@toc/protocol";
  import { onMount, tick } from "svelte";
  import {
    createInvitation,
    disableInvitation,
    friends as fetchFriends,
    pendingInvitations,
    removeFriend,
  } from "../account/api.ts";
  import { dateText, pendingLine } from "../account/flow.ts";
  import { codeFor, forgetInvite, keepPending, rememberInvite } from "../account/invites.ts";
  import { account, requireSignIn } from "../account/store.svelte.ts";
  import { amis } from "../i18n/fr/amis.ts";
  import { compte } from "../i18n/fr/compte.ts";
  import { browserApi } from "../net/api.ts";
  import { pageStorage } from "../net/device.ts";
  import ConfirmDialog from "../ui/ConfirmDialog.svelte";
  import FriendCodeSheet from "../ui/FriendCodeSheet.svelte";
  import FriendRow from "../ui/FriendRow.svelte";
  import Icon from "../ui/Icon.svelte";
  import InviteSheet from "../ui/InviteSheet.svelte";
  import OfflinePage from "../ui/OfflinePage.svelte";
  import Page from "../ui/Page.svelte";
  import { rowFade } from "../ui/stepIn.ts";
  import { showToast } from "../ui/toast.svelte.ts";

  // « Mes amis » at #/amis (plan 04-10, ACCT-03, D-06, D-11; 04-UI-SPEC « Mes amis »), in the « Page »
  // layout of « Mon compte ». Left: « Inviter un proche » (a single-use link, 7 days: the variant of the
  // invite sheet, with its QR code and « Partager le lien » / « Copier le lien »), « Ajouter avec un
  // code » and the note. Right: the friends in French alphabetical order (the list's h2 is read only),
  // each removable both ways after « Retirer {Pseudo} de tes amis ? »; then « Invitations en attente »:
  // the links still pending, shareable again only from the device that made them (toc.invites.v1:
  // the server keeps only their hashes) and disabled after « Désactiver ce lien ? ». An 11th link is
  // refused with its toast. Signed out: the home with the sign-in sheet; offline: the offline page.
  // The update strip sits at the bottom of the right column (after the header in one column).

  const storage = pageStorage();
  const SLOW_MS = 10_000;

  let online = $state(typeof navigator === "undefined" || navigator.onLine !== false);
  let list = $state<FriendEntry[]>([]);
  let listStatus = $state<"loading" | "ready" | "error">("loading");
  let slow = $state(false);
  let pending = $state<PendingInvitation[]>([]);
  let pendingStatus = $state<"loading" | "ready" | "error">("loading");
  let now = $state(Date.now());
  /** Bumped when this device's links change, so the share buttons are read again. */
  let invitesVersion = $state(0);

  let leaving = false;

  function signedOutHere() {
    if (leaving) return;
    leaving = true;
    requireSignIn();
  }

  // The store cleared the account meanwhile (its own GET /api/me met a 401).
  let hadAccount = account.current !== null;
  $effect(() => {
    if (account.current !== null) {
      hadAccount = true;
      return;
    }
    if (hadAccount) signedOutHere();
  });

  const byName = (a: FriendEntry, b: FriendEntry) =>
    a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" });

  /** A refusal that is not the page's own: signed out, offline (the offline page), else false. */
  function lost(reason: string): boolean {
    if (reason === "signed-out") {
      signedOutHere();
      return true;
    }
    if (reason === "offline" && !browserApi.online()) {
      online = false;
      return true;
    }
    return false;
  }

  async function loadFriends(): Promise<void> {
    listStatus = "loading";
    slow = false;
    const timer = setTimeout(() => {
      slow = true;
    }, SLOW_MS);
    const result = await fetchFriends();
    clearTimeout(timer);
    if (result.ok) {
      list = [...result.friends].sort(byName);
      listStatus = "ready";
      return;
    }
    if (!lost(result.reason)) listStatus = "error";
  }

  async function loadPending(): Promise<void> {
    const result = await pendingInvitations();
    if (result.ok) {
      now = Date.now();
      pending = [...result.invitations].sort((a, b) => b.createdAt - a.createdAt);
      // A link the server no longer lists was used or disabled: this device forgets it.
      keepPending(
        storage,
        pending.map((link) => link.id),
        now,
      );
      invitesVersion++;
      pendingStatus = "ready";
      return;
    }
    if (!lost(result.reason)) pendingStatus = "error";
  }

  function load(): void {
    if (!browserApi.online()) {
      online = false;
      return;
    }
    online = true;
    void loadFriends();
    void loadPending();
  }

  onMount(load);

  // --- « Inviter un proche » ---

  let inviteButton = $state<HTMLButtonElement | null>(null);
  let creating = $state(false);
  /** The invite sheet: the link's code and its last day. */
  type SheetData = { code: string; expiresAt: number; opener: HTMLElement | null };
  let sheet = $state<SheetData | null>(null);
  /** What the sheet shows, kept while it slides out after `sheet` went back to null. */
  let sheetShown = $state<SheetData>({ code: "", expiresAt: 0, opener: null });

  function openSheet(data: SheetData) {
    sheetShown = data;
    sheet = data;
  }
  const pseudo = $derived(account.current?.pseudo ?? "");

  async function invite() {
    if (creating) return;
    if (!browserApi.online()) {
      showToast(amis.create.offline);
      return;
    }
    creating = true;
    const result = await createInvitation();
    creating = false;
    if (result.ok) {
      const { id, code, expiresAt } = result.invitation;
      rememberInvite(storage, { id, code, expiresAt }, Date.now());
      invitesVersion++;
      openSheet({ code, expiresAt, opener: inviteButton });
      void loadPending();
      return;
    }
    if (result.reason === "limit") showToast(amis.create.limit);
    else if (result.reason === "offline") showToast(amis.create.offline);
    else if (result.reason === "signed-out") signedOutHere();
    else showToast(amis.create.failed);
  }

  /** « Partager ce lien »: the code this device kept, or null (made on another device). */
  function shareable(id: string): string | null {
    void invitesVersion;
    return codeFor(storage, id, now);
  }

  function shareAgain(link: PendingInvitation, button: HTMLButtonElement) {
    const code = codeFor(storage, link.id, Date.now());
    if (code === null) return;
    openSheet({ code, expiresAt: link.expiresAt, opener: button });
  }

  // --- « Ajouter avec un code » ---

  let codeButton = $state<HTMLButtonElement | null>(null);
  let codeOpen = $state(false);

  // --- Removing a friend, disabling a link: asked first; the focus then goes on ---

  const removeButtons = $state<Record<string, HTMLButtonElement | null>>({});
  const disableButtons = $state<Record<string, HTMLButtonElement | null>>({});
  let removing = $state<FriendEntry | null>(null);
  let disabling = $state<PendingInvitation | null>(null);
  /** The friend the confirmation names, kept while it slides out. */
  let removingShown = $state<FriendEntry>({ id: "", pseudo: "", since: 0 });
  let opener = $state<HTMLElement | null>(null);
  let working = false;

  function askRemove(friend: FriendEntry, button: HTMLButtonElement) {
    opener = button;
    removingShown = friend;
    removing = friend;
  }

  function askDisable(link: PendingInvitation, button: HTMLButtonElement) {
    opener = button;
    disabling = link;
  }

  /**
   * The confirmation stays up while the server answers, then closes with the focus given to the next
   * row's button, or to « Inviter un proche » (the sheet gives the focus to its opener when it goes).
   */
  async function confirmRemove() {
    const friend = removing;
    if (friend === null || working) return;
    working = true;
    const index = list.findIndex((each) => each.id === friend.id);
    const result = await removeFriend(friend.id);
    working = false;
    if (!result.ok && result.reason !== "unknown") {
      removing = null;
      if (!lost(result.reason)) showToast(amis.list.removeFailed);
      return;
    }
    list = list.filter((each) => each.id !== friend.id);
    await tick();
    const next = list[index] ?? null;
    opener = (next === null ? null : removeButtons[next.id]) ?? inviteButton;
    removing = null;
    showToast(amis.list.removed(friend.pseudo));
  }

  async function confirmDisable() {
    const link = disabling;
    if (link === null || working) return;
    working = true;
    const index = pending.findIndex((each) => each.id === link.id);
    const result = await disableInvitation(link.id);
    working = false;
    if (!result.ok && result.reason !== "unknown") {
      disabling = null;
      if (!lost(result.reason)) showToast(amis.pending.disableFailed);
      return;
    }
    forgetInvite(storage, link.id, Date.now());
    invitesVersion++;
    pending = pending.filter((each) => each.id !== link.id);
    await tick();
    const next = pending[index] ?? null;
    opener = (next === null ? null : disableButtons[next.id]) ?? inviteButton;
    disabling = null;
    showToast(amis.pending.disabled);
  }
</script>

{#if !online}
  <OfflinePage onretry={load} />
{:else}
  <Page
    title={amis.page.title}
    homeLabel={amis.page.home}
    attrs={{ "data-friends": "" }}
    leftAttrs={{ "data-friends-actions": "" }}
    rightAttrs={{ "data-friends-right": "" }}
  >
    {#snippet left()}
      <button
        type="button"
        class="btn btn-primary wide"
        aria-busy={creating}
        aria-haspopup="dialog"
        data-friends-invite
        bind:this={inviteButton}
        onclick={() => void invite()}
      >
        <Icon name="link" size={20} />
        {creating ? amis.page.inviting : amis.page.invite}
      </button>
      <button
        type="button"
        class="btn btn-secondary wide add"
        aria-haspopup="dialog"
        data-friends-code
        bind:this={codeButton}
        onclick={() => (codeOpen = true)}
      >
        <Icon name="user-plus" size={20} />
        {amis.page.addWithCode}
      </button>
      <p class="t-label muted note">{amis.page.note}</p>
    {/snippet}

    {#snippet right()}
      <section class="section" aria-labelledby="friends-heading" data-friends-list={listStatus}>
        <h2 id="friends-heading" class="sr-only">{amis.list.heading}</h2>
        {#if listStatus === "loading"}
          <p class="t-label muted">{amis.list.loading}</p>
          {#if slow}<p class="t-label muted">{amis.list.slow}</p>{/if}
        {:else if listStatus === "error"}
          <div class="error-row">
            <p class="t-label">{amis.list.error}</p>
            <button type="button" class="btn btn-text" onclick={() => void loadFriends()}>
              {amis.list.retry}
            </button>
          </div>
        {:else if list.length === 0}
          <div class="empty" data-friends-empty>
            <p class="t-body strong">{amis.list.emptyHeading}</p>
            <p class="t-body muted">{amis.list.emptyBody}</p>
          </div>
        {:else}
          <ul class="rows">
            {#each list as friend (friend.id)}
              <FriendRow {friend} onremove={askRemove} bind:button={removeButtons[friend.id]} />
            {/each}
          </ul>
        {/if}
      </section>

      <section class="section" aria-labelledby="pending-heading" data-pending={pendingStatus}>
        <h2 id="pending-heading" class="t-heading">{amis.pending.heading}</h2>
        {#if pendingStatus === "loading"}
          <p class="t-label muted">{compte.account.loading}</p>
        {:else if pendingStatus === "error"}
          <div class="error-row">
            <p class="t-label">{amis.pending.error}</p>
            <button type="button" class="btn btn-text" onclick={() => void loadPending()}>
              {amis.list.retry}
            </button>
          </div>
        {:else if pending.length === 0}
          <p class="t-label muted">{amis.pending.empty}</p>
        {:else}
          <ul class="rows">
            {#each pending as link (link.id)}
              {@const shown = pendingLine(link, now)}
              <li class="row" data-invite-row={link.id} in:rowFade out:rowFade>
                <span class="sr-only">{shown.title}, {shown.line}</span>
                <span class="icon" aria-hidden="true"><Icon name="link" size={20} /></span>
                <span class="text" aria-hidden="true">
                  <span class="line1">{shown.title}</span>
                  <span class="line2 t-label">{shown.line}</span>
                </span>
                {#if shareable(link.id) !== null}
                  <button
                    type="button"
                    class="btn icon-button"
                    aria-label={amis.pending.share}
                    title={amis.pending.share}
                    aria-haspopup="dialog"
                    data-invite-share-again
                    onclick={(event) => shareAgain(link, event.currentTarget)}
                  >
                    <Icon name="share-2" size={20} />
                  </button>
                {/if}
                <button
                  type="button"
                  class="btn icon-button"
                  aria-label={amis.pending.disable}
                  title={amis.pending.disable}
                  data-invite-disable
                  bind:this={disableButtons[link.id]}
                  onclick={(event) => askDisable(link, event.currentTarget)}
                >
                  <Icon name="x" size={20} />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/snippet}
  </Page>
{/if}

{#if sheet !== null}
  <InviteSheet
    kind="proche"
    url={`${location.origin}/#/invitation/${sheetShown.code}`}
    name={pseudo}
    until={dateText(sheetShown.expiresAt, Date.now())}
    opener={sheetShown.opener}
    onclose={() => (sheet = null)}
  />
{/if}

{#if codeOpen}
  <FriendCodeSheet
    opener={codeButton}
    onclose={() => (codeOpen = false)}
    onadded={() => void loadFriends()}
    onsignedout={signedOutHere}
  />
{/if}

{#if removing !== null}
  <ConfirmDialog
    title={amis.confirm.remove.title(removingShown.pseudo)}
    body={amis.confirm.remove.body(removingShown.pseudo)}
    safeLabel={amis.confirm.remove.safe}
    otherLabel={amis.confirm.remove.other}
    destructive
    {opener}
    onconfirm={() => void confirmRemove()}
    oncancel={() => (removing = null)}
  />
{/if}

{#if disabling !== null}
  <ConfirmDialog
    title={amis.confirm.disable.title}
    body={amis.confirm.disable.body}
    safeLabel={amis.confirm.disable.safe}
    otherLabel={amis.confirm.disable.other}
    destructive
    {opener}
    onconfirm={() => void confirmDisable()}
    oncancel={() => (disabling = null)}
  />
{/if}

<style>
  h2,
  p {
    margin: 0;
  }

  .muted {
    color: var(--creme-attenuee);
  }

  .strong {
    font-weight: 700;
  }

  .wide {
    width: 100%;
  }

  .wide[aria-busy="true"] {
    cursor: progress;
  }

  .add {
    margin-top: var(--space-sm);
  }

  .note {
    margin-top: var(--space-sm);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .error-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* A pending link: 56 high, the link icon 20, 12, two lines, the share and disable buttons (44). */
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    box-sizing: border-box;
    height: 56px;
    padding: 0 0 0 12px;
    border-radius: var(--radius-button);
    background: var(--bois-sombre);
  }

  .icon {
    display: flex;
    flex: none;
    color: var(--creme);
  }

  .text {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
  }

  .line1,
  .line2 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .line1 {
    font-weight: 700;
    line-height: 24px;
  }

  .line2 {
    color: var(--creme-attenuee);
    line-height: 20px;
  }

  .icon-button {
    flex: none;
    width: var(--touch);
    height: var(--touch);
    padding: 0;
  }

  .icon-button:last-child {
    margin-right: 6px;
  }
</style>
