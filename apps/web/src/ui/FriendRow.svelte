<script module lang="ts">
  import type { InviteAnswer } from "../account/flow.ts";

  /**
   * Plan 04-11: each friend's last answer per table, for the page's life, so « Invitation envoyée »
   * stays its 10 minutes when the sheet closes and opens again.
   */
  const answers = new Map<string, { answer: InviteAnswer; sentAt: number | null }>();
</script>

<script lang="ts">
  import type { FriendEntry } from "@toc/protocol";
  import { inviteFriend } from "../account/api.ts";
  import {
    friendSentence,
    friendSince,
    INVITE_SENT_MS,
    initial,
    inviteRowState,
  } from "../account/flow.ts";
  import { amis } from "../i18n/fr/amis.ts";
  import Icon from "./Icon.svelte";
  import { rowFade } from "./stepIn.ts";
  import { showToast } from "./toast.svelte.ts";

  // A friend's row (plan 04-10; 04-UI-SPEC « Mes amis »), the page variant: 56 high, bois sombre,
  // radius 12, padding 0 12: the initial disc (40, oak, the walnut Heading initial, hidden from
  // screen readers), 12, the pseudo (Body 700, ellipsis, its full text as the title) over « Dans tes
  // amis depuis {mois année} » (Label muted), and the remove x (44) « Retirer {Pseudo} de tes amis ».
  // The row reads as one sentence. It fades in and out in 150 ms (instant under reduced motion).
  // Plan 04-11, the invite variant (the waiting room's « Mes amis », 04-UI-SPEC « In the waiting
  // room »): the disc, the pseudo, and at the right the secondary « Inviter » (44 high, min width 96)
  // → POST /api/tables/:id/invite (inviteFriend) → « Envoi… » (aria-busy) → check 16 + « Invitation
  // envoyée » (Label 700, not a control) for 10 minutes, then « Inviter » again. A friend already at
  // the table reads « Déjà à la table » as line 2, with no button. A refusal says so in a toast; a
  // friend who is no longer one leaves the list (onleave).
  type Props = {
    friend: FriendEntry;
    /** "page" (« Mes amis », the remove x) by default; "invite" (« Inviter à la table »). */
    variant?: "page" | "invite";
    /** The x: the page asks « Retirer {Pseudo} de tes amis ? ». */
    onremove?: (friend: FriendEntry, button: HTMLButtonElement) => void;
    /** The x, for the page's focus after a removal. */
    button?: HTMLButtonElement | null;
    /** Invite variant: the table's id. */
    table?: string;
    /** Invite variant: the friend's pseudo is among the table's names. */
    here?: boolean;
    /** Invite variant: the server says this is no longer a friend; the row goes. */
    onleave?: (friend: FriendEntry) => void;
  };

  let {
    friend,
    variant = "page",
    onremove,
    button = $bindable(),
    table = "",
    here = false,
    onleave,
  }: Props = $props();

  const removeName = $derived(amis.list.remove(friend.pseudo));

  // --- The invite variant ---
  const key = $derived(`${table}:${friend.id}`);
  const remembered = () => answers.get(key) ?? { answer: null, sentAt: null };
  let known = $state<{ answer: InviteAnswer; sentAt: number | null }>(remembered());
  let now = $state(Date.now());
  const view = $derived(inviteRowState(known.answer, known.sentAt, now, friend.pseudo));
  /** What the row shows: « Déjà à la table » as soon as the friend's name is at the table. */
  const rowState = $derived(here ? "here" : view.state);

  // « Invitation envoyée » turns back into « Inviter » once its 10 minutes are over.
  $effect(() => {
    if (view.state !== "sent" || known.sentAt === null) return;
    const left = known.sentAt + INVITE_SENT_MS - Date.now();
    const expiry = setTimeout(() => (now = Date.now()), Math.max(0, left) + 50);
    return () => clearTimeout(expiry);
  });

  async function invite() {
    if (known.answer === "sending") return;
    const id = key;
    known = { answer: "sending", sentAt: null };
    const answer = await inviteFriend(table, friend.id);
    const at = Date.now();
    const shown = inviteRowState(answer, at, at, friend.pseudo);
    known = shown.toast === undefined ? { answer, sentAt: at } : { answer: null, sentAt: null };
    now = at;
    answers.set(id, known);
    if (shown.toast !== undefined) showToast(shown.toast);
    if (shown.leave === true) onleave?.(friend);
  }
</script>

{#if variant === "invite"}
  <li
    class="row invite"
    data-friend-row={friend.pseudo}
    data-friend-invite={rowState}
    in:rowFade
    out:rowFade
  >
    <span class="disc t-heading" aria-hidden="true">{initial(friend.pseudo)}</span>
    <span class="text">
      <span class="pseudo" title={friend.pseudo}>{friend.pseudo}</span>
      {#if rowState === "here"}
        <span class="since t-label">{amis.table.here}</span>
      {/if}
    </span>
    {#if rowState === "sent"}
      <span class="sent t-label" data-invite-sent>
        <Icon name="check" size={16} />
        {amis.table.sent}
      </span>
    {:else if rowState !== "here"}
      <button
        type="button"
        class="btn btn-secondary send"
        aria-label={amis.table.inviteName(friend.pseudo)}
        aria-busy={rowState === "sending" ? true : undefined}
        onclick={() => void invite()}
      >
        {rowState === "sending" ? amis.table.sending : amis.table.invite}
      </button>
    {/if}
  </li>
{:else}
  <li class="row" data-friend-row={friend.pseudo} in:rowFade out:rowFade>
    <span class="sr-only">{friendSentence(friend.pseudo, friend.since)}</span>
    <span class="disc t-heading" aria-hidden="true">{initial(friend.pseudo)}</span>
    <span class="text" aria-hidden="true">
      <span class="pseudo" title={friend.pseudo}>{friend.pseudo}</span>
      <span class="since t-label">{friendSince(friend.since)}</span>
    </span>
    <button
      type="button"
      class="btn remove"
      aria-label={removeName}
      title={removeName}
      bind:this={button}
      onclick={(event) => onremove?.(friend, event.currentTarget)}
    >
      <Icon name="x" size={20} />
    </button>
  </li>
{/if}

<style>
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

  .disc {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--chene);
    color: var(--noyer);
  }

  .text {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
  }

  .pseudo,
  .since {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pseudo {
    font-weight: 700;
    line-height: 24px;
  }

  .since {
    color: var(--creme-attenuee);
    line-height: 20px;
  }

  /* The invite variant: « Inviter » 44 high, at least 96 wide, so « Envoi… » does not move it. */
  .invite {
    padding-right: 6px;
  }

  .send {
    flex: none;
    min-width: 96px;
    min-height: var(--touch);
    height: var(--touch);
    padding-inline: var(--space-md);
  }

  .send[aria-busy="true"] {
    cursor: progress;
  }

  .sent {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--space-xs);
    margin-right: 6px;
    color: var(--creme);
    font-weight: 700;
  }

  .remove {
    flex: none;
    width: var(--touch);
    height: var(--touch);
    margin-right: 6px;
    padding: 0;
  }
</style>
