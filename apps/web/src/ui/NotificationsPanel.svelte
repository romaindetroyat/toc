<script lang="ts">
  import { onMount } from "svelte";
  import { pushKey, saveSubscription } from "../account/api.ts";
  import {
    browserPushFacts,
    browserPushManager,
    currentPermission,
    readSwitchedOff,
    requestPermission,
    writeSwitchedOff,
  } from "../account/browserPush.ts";
  import { notificationPlatform, notificationsView } from "../account/flow.ts";
  import { disablePush, enablePush, pushState, refreshKey } from "../account/push.ts";
  import { compte } from "../i18n/fr/compte.ts";
  import Icon from "./Icon.svelte";
  import InstallSheet from "./InstallSheet.svelte";
  import Switch from "./Switch.svelte";
  import { showToast } from "./toast.svelte.ts";

  // « Mon compte › Notifications » (plan 04-10, D-08, APP-03; 04-UI-SPEC « Notifications »,
  // 04-RESEARCH Pitfalls 1 and 2): exactly one of the seven states for this device. The server's key
  // is fetched when the panel mounts, so the tap on « Activer les notifications » calls enablePush at
  // once: the permission is asked inside the tap's handler, before anything is awaited, and nowhere
  // else in the app; the subscription follows and is saved. Then the switch « Sur cet appareil »: off
  // unsubscribes (the server forgets the endpoint), on subscribes again without a new prompt. Blocked
  // shows the platform's own way to allow them; an iPhone in Safari is told to install the app first
  // (« Installer l’application » opens the install sheet). A subscription this device already holds
  // is saved again when the panel opens (the server may have dropped it with an ended session).
  // Each change of state is read out once in a polite live region.
  type Props = {
    /** A 401 on a call: the session ended. */
    onsignedout: () => void;
  };

  let { onsignedout }: Props = $props();

  const copy = compte.notifications;
  const facts = browserPushFacts();
  const platform = notificationPlatform(facts.userAgent, facts.apple);
  const manager = browserPushManager();

  let permission = $state(currentPermission());
  let key = $state<string | null>(null);
  let status = $state<"loading" | "ready" | "error">("loading");
  let subscribed = $state(false);
  let failed = $state(false);
  let switchedOff = $state(readSwitchedOff());
  let busy = $state(false);
  let announce = $state("");
  let installing = $state(false);
  let installButton = $state<HTMLButtonElement | null>(null);

  const current = $derived(
    pushState({
      hasPushApi: facts.hasPushApi,
      apple: facts.apple,
      standalone: facts.standalone,
      iosVersion: facts.iosVersion,
      permission,
      subscribed,
      failed,
      switchedOff,
    }),
  );
  /** The states that need the server's key and this device's subscription first. */
  const needsServer = $derived(
    current === "ask" || current === "failed" || current === "on" || current === "off",
  );
  const shown = $derived(needsServer && status !== "ready" ? status : current);
  const view = $derived(notificationsView(current, platform));

  /** The subscription this device holds, saved again (an upsert of the same row). */
  async function saveAgain(): Promise<void> {
    let subscription: Awaited<ReturnType<typeof manager.getSubscription>> = null;
    try {
      subscription = await manager.getSubscription();
    } catch {
      subscription = null;
    }
    const json = subscription?.toJSON();
    const p256dh = json?.keys?.p256dh;
    const auth = json?.keys?.auth;
    if (subscription === null || typeof p256dh !== "string" || typeof auth !== "string") return;
    const saved = await saveSubscription({
      endpoint: json?.endpoint ?? subscription.endpoint,
      keys: { p256dh, auth },
    });
    if (!saved.ok && saved.reason === "signed-out") onsignedout();
  }

  async function load(): Promise<void> {
    if (!facts.hasPushApi) return;
    status = "loading";
    const answer = await pushKey();
    if (!answer.ok) {
      status = "error";
      return;
    }
    key = answer.key;
    permission = currentPermission();
    if (permission === "granted") {
      const held = await refreshKey({ key: answer.key, manager, permission: currentPermission });
      subscribed = held === "on";
      failed = held === "failed";
      if (held === "on") {
        if (switchedOff) {
          switchedOff = false;
          writeSwitchedOff(false);
        }
        await saveAgain();
      }
    } else {
      subscribed = false;
    }
    status = "ready";
  }

  onMount(() => {
    void load();
  });

  /**
   * « Activer les notifications », and the switch turned on again: enablePush is called right here,
   * inside the tap's handler, with nothing awaited before it (Pitfall 2).
   */
  function enable() {
    if (busy) return;
    busy = true;
    failed = false;
    // Already granted (the switch turned on again): no prompt at all.
    const ask =
      currentPermission() === "granted"
        ? () => Promise.resolve<NotificationPermission>("granted")
        : requestPermission;
    void enablePush({ key, manager, requestPermission: ask }).then((result) => {
      busy = false;
      permission = currentPermission();
      if (result === "on") {
        subscribed = true;
        switchedOff = false;
        writeSwitchedOff(false);
        announce = copy.on;
        showToast(copy.done);
      } else if (result === "failed") {
        failed = true;
        announce = copy.failed;
      } else if (result === "blocked") {
        announce = copy.blocked;
      }
    });
  }

  function toggle(next: boolean) {
    if (busy) return;
    if (next) {
      enable();
      return;
    }
    busy = true;
    void disablePush({ manager }).then(() => {
      busy = false;
      subscribed = false;
      switchedOff = true;
      writeSwitchedOff(true);
      announce = copy.off;
    });
  }
</script>

<div class="panel" data-notifications={shown}>
  <p class="t-label muted">{copy.intro}</p>
  {#if shown === "loading"}
    <p class="t-label muted">{compte.account.loading}</p>
  {:else if shown === "error"}
    <div class="error-row">
      <p class="t-label">{compte.account.sectionError}</p>
      <button type="button" class="btn btn-text" onclick={() => void load()}>
        {compte.account.retry}
      </button>
    </div>
  {:else}
    {#if view.line !== null}
      <p class="t-body line" class:blocked={view.blocked}>
        {#if view.blocked}<Icon name="bell-off" size={20} />{/if}
        <span>{view.line}</span>
      </p>
    {/if}
    {#if view.help !== null}
      <p class="t-label muted">{view.help}</p>
    {/if}
    {#if view.action !== null}
      {#if view.action.kind === "enable"}
        <button
          type="button"
          class="btn btn-primary action"
          aria-busy={busy}
          data-notifications-enable
          onclick={enable}
        >
          <Icon name="bell" size={20} />
          {busy && view.action.busy !== null ? view.action.busy : view.action.label}
        </button>
      {:else}
        <button
          type="button"
          class="btn btn-secondary action"
          aria-haspopup="dialog"
          bind:this={installButton}
          onclick={() => (installing = true)}
        >
          {view.action.label}
        </button>
      {/if}
    {/if}
    {#if view.error !== null}
      <p class="t-label failed">
        <Icon name="x" size={16} />
        {view.error}
      </p>
    {/if}
    {#if view.toggle !== null}
      <Switch
        label={view.toggle.label}
        checked={view.toggle.checked}
        helper={view.toggle.helper}
        onchange={toggle}
      />
    {/if}
  {/if}
  <p class="sr-only" aria-live="polite">{announce}</p>
</div>

{#if installing}
  <InstallSheet onclose={() => (installing = false)} opener={installButton} />
{/if}

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  p {
    margin: 0;
  }

  .muted {
    color: var(--creme-attenuee);
  }

  .line.blocked {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  .line :global(svg) {
    flex: none;
    margin-top: 2px;
  }

  .action {
    width: 100%;
  }

  .action[aria-busy="true"] {
    cursor: progress;
  }

  .failed {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .failed :global(svg) {
    flex: none;
  }

  .error-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
  }
</style>
