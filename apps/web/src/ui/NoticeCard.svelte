<script lang="ts">
  import type { NoticeFrame } from "@toc/protocol";
  import { cardAction, cardText } from "../account/flow.ts";
  import type { HubConnection } from "../account/hub.svelte.ts";
  import { amis } from "../i18n/fr/amis.ts";
  import Icon from "./Icon.svelte";
  import { cardIn, cardOut } from "./stepIn.ts";

  // The in-app card (plan 04-11, D-07, D-08; 04-UI-SPEC « In-app card »): a friend's invitation or a
  // table that waits for this player, from the app's PlayerHub (hub.svelte.ts), whose rules
  // (noticeRule.ts) hold it during a game, at a table that plays, on the backup-code screen and in
  // sign-up or recovery, and keep only the latest. Top centre, 8 px under the safe area, at most
  // 440 wide; one row from 600 px wide (icon, text, « Plus tard », the primary) when the buttons leave
  // the text 160 px, else (and under 600 px) the text over the two buttons. Not modal: the focus stays
  // where it is, the card comes first in the Tab order (App mounts it before the routes), Échap while
  // the focus is in it is « Plus tard ». Its text is read once by a polite live region. The primary opens #/table/<id> (a table id only, T-04-71); from a
  // waiting room that leaves it as closing the page would (no confirmation, UI-SPEC « à confirmer » 11).
  type Props = { hub: HubConnection };

  let { hub }: Props = $props();

  const notice = $derived(hub.notice);

  /** The live region's text: set once per new card, so each is announced once. */
  let announced = $state("");
  let lastAnnounced: NoticeFrame | null = null;
  $effect(() => {
    const now = notice;
    if (now === null || now === lastAnnounced) return;
    lastAnnounced = now;
    announced = cardText(now);
  });

  function later() {
    hub.dismiss();
  }

  function go(card: NoticeFrame) {
    const { href } = cardAction(card);
    hub.dismiss();
    if (href !== null) location.hash = href;
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    later();
  }
</script>

<div class="sr-only" aria-live="polite" data-notice-card-live>{announced}</div>

{#if notice !== null}
  {#key notice}
    {@const text = cardText(notice)}
    {@const action = cardAction(notice)}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="card"
      role="region"
      aria-label={text}
      data-notice-card={notice.kind}
      {onkeydown}
      in:cardIn
      out:cardOut
    >
      <p class="text t-body">
        <Icon name={notice.kind === "invite" ? "users" : "hourglass"} size={20} />
        <span>{text}</span>
      </p>
      <div class="buttons">
        <button type="button" class="btn btn-text later" onclick={later}>{amis.card.later}</button>
        <button type="button" class="btn btn-primary" onclick={() => go(notice)}>
          {action.label}
        </button>
      </div>
    </div>
  {/key}
{/if}

<style>
  /* Bois sombre, radius 16, padding 16, the plate's sharp shadow, a 2 px border of muted cream. */
  .card {
    position: fixed;
    top: calc(var(--space-sm) + env(safe-area-inset-top, 0px));
    right: 0;
    left: 0;
    z-index: 55;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    width: min(440px, calc(100% - 2 * var(--space-md)));
    margin-inline: auto;
    padding: var(--space-md);
    border: 2px solid color-mix(in srgb, var(--creme-attenuee) 40%, transparent);
    border-radius: var(--radius-sheet);
    background: var(--bois-sombre);
    color: var(--creme);
    box-shadow: 0 4px 0 rgb(20 12 6 / 45%);
  }

  .text {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    margin: 0;
    min-width: 0;
  }

  .text :global(svg) {
    flex: none;
    margin-top: 2px;
  }

  .text span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .buttons {
    display: flex;
    flex: none;
    justify-content: flex-end;
    gap: var(--space-sm);
  }

  .later {
    min-height: var(--touch);
  }

  /* One row from 600 px wide: icon, text (two lines), « Plus tard », the primary. The text keeps at
     least 160 px: when the buttons do not fit beside it (« Revenir à la table » is 182 px), they go
     under it, right-aligned, so the text never wraps into a narrow column. */
  @media (min-width: 600px) {
    .card {
      flex-flow: row wrap;
      align-items: center;
    }

    .text {
      flex: 1 1 160px;
      align-items: center;
    }

    .buttons {
      margin-left: auto;
    }

    .text :global(svg) {
      margin-top: 0;
    }
  }
</style>
