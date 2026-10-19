<script lang="ts">
  import { formatFriendCode } from "@toc/protocol";
  import { friendCode, redeemFriendCode } from "../account/api.ts";
  import { friendCodeInput, friendCodeResult } from "../account/flow.ts";
  import { loadFriendCode, rememberFriendCode } from "../account/invites.ts";
  import { account } from "../account/store.svelte.ts";
  import { amis } from "../i18n/fr/amis.ts";
  import { browserApi } from "../net/api.ts";
  import { pageStorage } from "../net/device.ts";
  import Icon from "./Icon.svelte";
  import Segmented from "./Segmented.svelte";
  import Sheet from "./Sheet.svelte";
  import { showToast } from "./toast.svelte.ts";

  // « Ajouter avec un code » (plan 04-10, ACCT-03; 04-UI-SPEC « Code-ami sheet »): a Segmented
  // « Afficher » (44 high, full width) with « Entrer un code » first, so the field sits at the top of
  // the body, above the on-screen keyboard.
  // - « Entrer un code »: the labelled field adds « TOC- » and the dash as the player types (lower
  //   case, spaces, O for 0, I and L for 1 are read back), « Ajouter » (busy « Ajout… »), and the
  //   result line in a polite region; a friend added closes the sheet with the toast « {Pseudo} est
  //   maintenant dans tes amis. » and the page reads its list again.
  // - « Donner mon code »: the cream panel (Heading 700, letter-spacing 0.06em, tabular), spelled for
  //   screen readers (« T O C, K 7 Q M, 2 X R A »), « Valable 24 heures. … », « Copier le code » and
  //   « Nouveau code » (the old one stops working). The code this device received is shown again while
  //   it is valid (toc.friendcode.v1); otherwise a new one is asked for.
  type Props = {
    onclose: () => void;
    /** « Ajouter avec un code »: it gets the focus back. */
    opener?: HTMLElement | null;
    /** A friend was added: the page reads its list again. */
    onadded: () => void;
    /** A 401: the session ended. */
    onsignedout: () => void;
  };

  let { onclose, opener = null, onadded, onsignedout }: Props = $props();

  const copy = amis.code;
  const storage = pageStorage();

  let tab = $state<"enter" | "give">("enter");

  // --- « Entrer un code » ---

  let typed = $state("");
  let adding = $state(false);
  let error = $state<string | null>(null);

  function oninput(event: Event & { currentTarget: HTMLInputElement }) {
    typed = friendCodeInput(event.currentTarget.value);
    event.currentTarget.value = typed;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (adding) return;
    adding = true;
    error = null;
    const result = await redeemFriendCode(typed);
    adding = false;
    const shown = friendCodeResult(result);
    if (shown.kind === "added") {
      showToast(shown.toast);
      onadded();
      onclose();
    } else if (shown.kind === "signed-out") {
      onclose();
      onsignedout();
    } else {
      error = shown.line;
    }
  }

  // --- « Donner mon code » ---

  let code = $state<string | null>(null);
  let codeStatus = $state<"idle" | "loading" | "ready" | "offline" | "error">("idle");

  const formatted = $derived(code === null ? "" : formatFriendCode(code));
  /** « T O C, K 7 Q M, 2 X R A »: one symbol at a time, the groups apart. */
  const spelled = $derived(
    formatted
      .split("-")
      .map((group) => [...group].join(" "))
      .join(", "),
  );

  async function showCode(fresh: boolean) {
    const id = account.current?.id ?? null;
    if (!fresh && id !== null) {
      const kept = loadFriendCode(storage, id, Date.now());
      if (kept !== null) {
        code = kept.code;
        codeStatus = "ready";
        return;
      }
    }
    if (!browserApi.online()) {
      codeStatus = "offline";
      return;
    }
    codeStatus = "loading";
    const result = await friendCode();
    if (result.ok) {
      code = result.code;
      if (id !== null) {
        rememberFriendCode(
          storage,
          { account: id, code: result.code, expiresAt: result.expiresAt },
          Date.now(),
        );
      }
      codeStatus = "ready";
      return;
    }
    if (result.reason === "signed-out") {
      onclose();
      onsignedout();
      return;
    }
    codeStatus = result.reason === "offline" ? "offline" : "error";
  }

  function choose(next: "enter" | "give") {
    tab = next;
    if (next === "give" && codeStatus !== "ready" && codeStatus !== "loading") {
      void showCode(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(formatted);
      showToast(copy.copied);
    } catch {
      showToast(copy.copyFailed);
    }
  }
</script>

<Sheet title={copy.title} {onclose} {opener}>
  <div class="body" data-friend-code-sheet>
    <Segmented
      label={copy.tabs}
      value={tab}
      options={[
        { value: "enter", label: copy.enter },
        { value: "give", label: copy.give },
      ]}
      onchange={choose}
    />

    {#if tab === "enter"}
      <form class="enter" onsubmit={submit} novalidate>
        <label class="t-label label" for="friend-code-field">{copy.label}</label>
        <div class="row">
          <input
            id="friend-code-field"
            class="tabular"
            type="text"
            value={typed}
            {oninput}
            placeholder={copy.placeholder}
            maxlength="24"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            enterkeyhint="go"
            aria-invalid={error !== null}
            aria-describedby={error !== null ? "friend-code-error" : undefined}
          />
          <button type="submit" class="btn btn-primary submit" aria-busy={adding}>
            {adding ? copy.adding : copy.add}
          </button>
        </div>
        <div aria-live="polite">
          {#if error !== null}
            <p class="t-label error" id="friend-code-error">
              <Icon name="x" size={16} />
              <span data-friend-code-error>{error}</span>
            </p>
          {/if}
        </div>
      </form>
    {:else}
      <div class="give" aria-live="polite">
        {#if codeStatus === "ready" && code !== null}
          <div class="panel" role="group" aria-label={copy.groupLabel(spelled)}>
            <span class="code t-heading tabular" aria-hidden="true" data-friend-code>{formatted}</span>
          </div>
          <p class="t-label muted">{copy.valid}</p>
          <button type="button" class="btn btn-secondary wide" onclick={() => void copyCode()}>
            <Icon name="copy" size={20} />
            {copy.copy}
          </button>
        {:else if codeStatus === "offline"}
          <p class="t-label">{copy.noNetwork}</p>
        {:else if codeStatus === "error"}
          <p class="t-label">{copy.createFailed}</p>
        {:else}
          <p class="t-label muted">{copy.creating}</p>
        {/if}
        <button
          type="button"
          class="btn btn-text renew"
          disabled={codeStatus === "loading"}
          onclick={() => void showCode(true)}
        >
          {copy.renew}
        </button>
      </div>
    {/if}
  </div>
</Sheet>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  p {
    margin: 0;
  }

  .muted {
    color: var(--creme-attenuee);
  }

  .enter {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .label {
    font-weight: 700;
  }

  /* [field, flex][Ajouter], 8 apart. */
  .row {
    display: flex;
    gap: var(--space-sm);
  }

  input {
    box-sizing: border-box;
    flex: 1 1 auto;
    min-width: 0;
    height: var(--button-height);
    padding: 0 12px;
    border: 2px solid var(--creme-attenuee);
    border-radius: var(--radius-button);
    background: var(--creme);
    color: var(--noyer);
    font: inherit;
    font-size: var(--body-size);
    letter-spacing: 0.06em;
  }

  input:focus-visible {
    outline: 3px solid var(--ambre);
    outline-offset: 2px;
  }

  .submit {
    flex: none;
  }

  .submit[aria-busy="true"] {
    cursor: progress;
  }

  .error {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
  }

  .error :global(svg) {
    flex: none;
  }

  .give {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
  }

  /* The cream code panel: walnut Heading 700, spaced and tabular. */
  .panel {
    display: flex;
    justify-content: center;
    padding: var(--space-md);
    border-radius: var(--radius-button);
    background: var(--creme);
    color: var(--noyer);
  }

  .code {
    letter-spacing: 0.06em;
    user-select: all;
  }

  .wide {
    width: 100%;
  }

  .renew {
    align-self: flex-start;
  }
</style>
