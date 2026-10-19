<script lang="ts">
  import type { PasskeyInfo } from "@toc/protocol";
  import { tick } from "svelte";
  import { addPasskey, removePasskey } from "../account/api.ts";
  import { passkeyLine } from "../account/flow.ts";
  import { compte } from "../i18n/fr/compte.ts";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import Icon from "./Icon.svelte";
  import { rowFade } from "./stepIn.ts";
  import { showToast } from "./toast.svelte.ts";

  // « Mon compte › Clés d’accès » (plan 04-10, SC1; 04-UI-SPEC « Clés d’accès »): one row per passkey
  // (56 high, bois sombre, radius 12): the key icon, its name (« iPhone », « Mac »… from the device;
  // no renaming), « cet appareil » for this session's key, line 2 « Ajoutée le {date} · utilisée … »
  // (« · synchronisée » for a synced key), and the remove x (44) « Retirer la clé {nom} ». Each row
  // reads as one sentence. The last key cannot be removed: its button is disabled and the note says
  // why (the server refuses it too). Removing asks « Retirer la clé ? » (destructive); the row fades
  // out in 150 ms (instant under reduced motion) and the focus goes to the next row's remove button,
  // or to « Ajouter une clé d’accès ». Adding opens the system dialog; this device already holding a
  // key of the account, or a cancelled dialog, each has its toast.
  type Props = {
    passkeys: readonly PasskeyInfo[];
    now: number;
    /** A key was added or removed: the account is read again. */
    onchanged: () => Promise<void>;
    /** A 401 on a call: the session ended. */
    onsignedout: () => void;
  };

  let { passkeys, now, onchanged, onsignedout }: Props = $props();

  const copy = compte.keys;

  /** Removed here, hidden at once while the account is read again. */
  let removed = $state<ReadonlySet<string>>(new Set());
  const visible = $derived(passkeys.filter((key) => !removed.has(key.id)));
  const last = $derived(visible.length <= 1);

  let confirming = $state<PasskeyInfo | null>(null);
  /** The key the confirmation names, kept while it slides out. */
  let confirmingName = $state("");
  let opener = $state<HTMLButtonElement | null>(null);
  let adding = $state(false);
  let addButton = $state<HTMLButtonElement | null>(null);
  const removeButtons = $state<Record<string, HTMLButtonElement | null>>({});

  function ask(key: PasskeyInfo, button: HTMLButtonElement) {
    opener = button;
    confirmingName = key.label;
    confirming = key;
  }

  let removing = $state(false);

  /**
   * « Retirer la clé »: the confirmation stays up while the server answers, then closes with the
   * focus given to the next row's remove button, or to « Ajouter une clé d’accès » (the sheet gives
   * the focus to its opener when it goes).
   */
  async function remove() {
    const key = confirming;
    if (key === null || removing) return;
    removing = true;
    const index = visible.findIndex((each) => each.id === key.id);
    const result = await removePasskey(key.id);
    removing = false;
    if (!result.ok && result.reason !== "unknown") {
      confirming = null;
      if (result.reason === "signed-out") onsignedout();
      else if (result.reason === "offline") showToast(copy.offline);
      else showToast(copy.removeFailed);
      return;
    }
    removed = new Set([...removed, key.id]);
    await tick();
    const next = visible[index] ?? null;
    const button = next === null || last ? null : (removeButtons[next.id] ?? null);
    opener = button ?? addButton;
    confirming = null;
    await onchanged();
  }

  async function add() {
    if (adding) return;
    adding = true;
    const result = await addPasskey();
    adding = false;
    if (result.ok) {
      showToast(copy.addDone);
      await onchanged();
      return;
    }
    switch (result.reason) {
      case "already-here":
        showToast(copy.alreadyHere);
        return;
      case "cancelled":
        showToast(copy.addCancelled);
        return;
      case "signed-out":
        onsignedout();
        return;
      case "offline":
        showToast(copy.offline);
        return;
      case "unsupported":
        showToast(compte.signIn.lines.unsupported);
        return;
      case "wrong-address":
        showToast(compte.signIn.lines.wrongAddress);
        return;
      default:
        showToast(copy.addFailed);
    }
  }
</script>

<ul class="rows">
  {#each visible as key (key.id)}
    {@const shown = passkeyLine(key, now)}
    <li class="row" data-passkey-row data-current={key.current ? "true" : undefined} out:rowFade>
      <span class="sr-only">{shown.sentence}</span>
      <span class="icon" aria-hidden="true"><Icon name="key-round" size={20} /></span>
      <span class="text" aria-hidden="true">
        <span class="line1">
          <span class="name">{shown.name}</span>
          {#if shown.current}<span class="tag t-label">{copy.thisDevice}</span>{/if}
        </span>
        <span class="line2 t-label" title={shown.line}>{shown.line}</span>
      </span>
      <button
        type="button"
        class="btn remove"
        aria-label={copy.remove(shown.name)}
        title={copy.remove(shown.name)}
        disabled={last}
        bind:this={removeButtons[key.id]}
        onclick={(event) => ask(key, event.currentTarget)}
      >
        <Icon name="x" size={20} />
      </button>
    </li>
  {/each}
</ul>
{#if last}
  <p class="t-label note" data-passkey-last>{copy.last}</p>
{/if}
<button
  type="button"
  class="btn btn-secondary add"
  aria-busy={adding}
  data-passkey-add
  bind:this={addButton}
  onclick={() => void add()}
>
  <Icon name="key-round" size={20} />
  {adding ? copy.adding : copy.add}
</button>

{#if confirming !== null}
  <ConfirmDialog
    title={copy.confirm.title}
    body={copy.confirm.body(confirmingName)}
    safeLabel={copy.confirm.safe}
    otherLabel={copy.confirm.other}
    destructive
    {opener}
    onconfirm={() => void remove()}
    oncancel={() => (confirming = null)}
  />
{/if}

<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

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

  .line1 {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    min-width: 0;
  }

  .name {
    overflow: hidden;
    font-weight: 700;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag,
  .line2,
  .note {
    color: var(--creme-attenuee);
  }

  .tag {
    flex: none;
  }

  .line2 {
    overflow: hidden;
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove {
    flex: none;
    width: var(--touch);
    height: var(--touch);
    margin-right: 6px;
    padding: 0;
  }

  .note {
    margin: var(--space-sm) 0 0;
  }

  .add {
    width: 100%;
    margin-top: var(--space-sm);
  }

  .add[aria-busy="true"] {
    cursor: progress;
  }
</style>
