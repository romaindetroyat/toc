<script lang="ts">
  import type { FriendEntry } from "@toc/protocol";
  import { friendSentence, friendSince, initial } from "../account/flow.ts";
  import { amis } from "../i18n/fr/amis.ts";
  import Icon from "./Icon.svelte";
  import { rowFade } from "./stepIn.ts";

  // A friend's row (plan 04-10; 04-UI-SPEC « Mes amis »), the page variant: 56 high, bois sombre,
  // radius 12, padding 0 12: the initial disc (40, oak, the walnut Heading initial, hidden from
  // screen readers), 12, the pseudo (Body 700, ellipsis, its full text as the title) over « Dans tes
  // amis depuis {mois année} » (Label muted), and the remove x (44) « Retirer {Pseudo} de tes amis ».
  // The row reads as one sentence. It fades in and out in 150 ms (instant under reduced motion).
  // Plan 04-11 adds the invite variant (the waiting room's « Mes amis »).
  type Props = {
    friend: FriendEntry;
    /** The x: the page asks « Retirer {Pseudo} de tes amis ? ». */
    onremove: (friend: FriendEntry, button: HTMLButtonElement) => void;
    /** The x, for the page's focus after a removal. */
    button?: HTMLButtonElement | null;
  };

  let { friend, onremove, button = $bindable() }: Props = $props();

  const removeName = $derived(amis.list.remove(friend.pseudo));
</script>

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
    onclick={(event) => onremove(friend, event.currentTarget)}
  >
    <Icon name="x" size={20} />
  </button>
</li>

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

  .remove {
    flex: none;
    width: var(--touch);
    height: var(--touch);
    margin-right: 6px;
    padding: 0;
  }
</style>
