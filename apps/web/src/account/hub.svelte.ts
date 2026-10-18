// The app's own connection to its PlayerHub (plan 04-06, D-07, D-08; 04-RESEARCH Pattern 6): while a
// player is signed in, one reconnecting WebSocket (partysocket) to /ws/me on the page's own origin,
// on every screen. The session cookie names the account; nothing else travels (T-04-49).
//   on open           hi { v: HUB_VERSION }, then vis { visible } with the page's visibility
//   visibilitychange  vis { visible } again: the hub, not the page, decides who is present (a hidden
//                     tab, a locked phone, a closed app are away and get a push instead, 04-07)
//   heartbeat         "ping" every PING_MS only while visible (the runtime answers "pong" without
//                     waking the hub); no pong within PONG_MS → a new socket
//   frames            parsed with parseHubServerFrame; a notice goes through the card's rules
//                     (noticeRule.ts): only the latest is kept, held during a game or a sign-up
//   close 4002        another hub version: no reconnect (the update flow of 04-08 reloads the app)
// It follows the account store: signed in → connected, signed out → closed and the notice dropped.
// maxEnqueuedMessages 0: a frame sent while closed is dropped, the next open says hi again.
// Started once from App.svelte (plan 04-11), which also tells it where the player is (setPlace).

import {
  CLOSE_VERSION,
  HUB_VERSION,
  type HubClientFrame,
  type NoticeFrame,
  parseHubServerFrame,
} from "@toc/protocol";
import ReconnectingWebSocket from "partysocket/ws";
import { tableSummary } from "../net/api.ts";
import { PING_MS, PONG_MS } from "../net/connection.svelte.ts";
import { type NoticePlace, type NoticeSlot, placeChanged, receive, settle } from "./noticeRule.ts";
import { account } from "./store.svelte.ts";

export type HubStatus = "off" | "connecting" | "open" | "closed";

export type HubConnection = {
  /** The card to show now: the latest notice when it may show, else null (held or none). */
  readonly notice: NoticeFrame | null;
  readonly status: HubStatus;
  /** The close code that ended the connection for good (4002), else null. */
  readonly closeCode: number | null;
  /** Where the player is: a held card may come back (after GET /api/tables/:id), a shown one waits. */
  setPlace(place: NoticePlace): void;
  /** « Plus tard », « Rejoindre », Échap: the card goes. */
  dismiss(): void;
  /** Stops following the account and closes the socket. */
  close(): void;
};

/** ws:// or wss:// on the page's own host. */
export function hubSocketUrl(page: { protocol: string; host: string }): string {
  return `${page.protocol === "https:" ? "wss:" : "ws:"}//${page.host}/ws/me`;
}

const visibleNow = () => typeof document === "undefined" || document.visibilityState === "visible";

/** The status of a table for the card's rules: its summary's, "gone" (404) or "unknown". */
async function statusOf(table: string): Promise<Parameters<typeof settle>[2]> {
  const found = await tableSummary(table);
  return typeof found === "string" ? found : found.status;
}

export function connectHub(): HubConnection {
  let status = $state<HubStatus>("off");
  let closeCode = $state<number | null>(null);
  let slot = $state.raw<NoticeSlot>(null);
  let place: NoticePlace = {
    route: typeof location === "undefined" ? "" : (location.hash.split("?")[0] ?? ""),
  };

  let socket: ReconnectingWebSocket | null = null;
  /** The account the socket is for (its cookie); null when signed out. */
  let accountId: string | null = null;
  /** A final close (4002) or close(): nothing reconnects any more. */
  let ended = false;

  let pinger: ReturnType<typeof setInterval> | undefined;
  let pongTimer: ReturnType<typeof setTimeout> | undefined;

  function stopHeartbeat(): void {
    if (pinger !== undefined) clearInterval(pinger);
    if (pongTimer !== undefined) clearTimeout(pongTimer);
    pinger = undefined;
    pongTimer = undefined;
  }

  function ping(): void {
    const current = socket;
    if (current === null || current.readyState !== current.OPEN) return;
    current.send("ping");
    if (pongTimer !== undefined) return;
    pongTimer = setTimeout(() => {
      pongTimer = undefined;
      if (!ended && socket === current) current.reconnect();
    }, PONG_MS);
  }

  /** The heartbeat runs only while the page is visible (a hidden page is away anyway). */
  function startHeartbeat(): void {
    stopHeartbeat();
    if (visibleNow()) pinger = setInterval(ping, PING_MS);
  }

  function send(frame: HubClientFrame): void {
    if (socket !== null && socket.readyState === socket.OPEN) socket.send(JSON.stringify(frame));
  }

  /** Only the latest notice: shown, or held where it may not show. */
  function onNotice(notice: NoticeFrame): void {
    slot = receive(slot, notice, place);
  }

  /** A held notice may come back: the table's status decides. */
  function check(notice: NoticeFrame | null): void {
    if (notice === null) return;
    void statusOf(notice.table).then((tableStatus) => {
      slot = settle(slot, notice, tableStatus, place);
    });
  }

  function open(id: string): void {
    shut();
    accountId = id;
    ended = false;
    closeCode = null;
    status = "connecting";
    const current = new ReconnectingWebSocket(hubSocketUrl(location), undefined, {
      maxEnqueuedMessages: 0,
      shouldReconnectOnClose: (event) => event.code !== CLOSE_VERSION,
    });
    socket = current;
    current.addEventListener("open", () => {
      if (socket !== current) return;
      status = "open";
      send({ t: "hi", v: HUB_VERSION });
      send({ t: "vis", visible: visibleNow() });
      startHeartbeat();
    });
    current.addEventListener("close", (event) => {
      if (socket !== current) return;
      stopHeartbeat();
      if (event.code === CLOSE_VERSION) {
        ended = true;
        closeCode = event.code;
        status = "closed";
      } else if (status !== "closed") {
        status = "connecting";
      }
    });
    current.addEventListener("message", (event) => {
      if (socket !== current || typeof event.data !== "string") return;
      if (event.data === "pong") {
        if (pongTimer !== undefined) clearTimeout(pongTimer);
        pongTimer = undefined;
        return;
      }
      const frame = parseHubServerFrame(event.data);
      if (frame !== null && frame.t === "notice") onNotice(frame);
    });
  }

  /** The socket goes (sign-out, another account, close()). */
  function shut(): void {
    stopHeartbeat();
    if (socket !== null) {
      const old = socket;
      socket = null;
      old.close(1000);
    }
    accountId = null;
    status = "off";
  }

  // --- The page's life ---
  function onVisibility(): void {
    if (socket === null || ended) return;
    const visible = visibleNow();
    if (socket.readyState === socket.OPEN) {
      send({ t: "vis", visible });
      if (visible) {
        startHeartbeat();
        // A socket the phone froze may look open: a ping finds out at once.
        ping();
      } else {
        stopHeartbeat();
      }
    } else if (visible && socket.readyState !== socket.CONNECTING) {
      socket.reconnect();
    }
  }
  function onPageHide(): void {
    if (socket === null || ended) return;
    stopHeartbeat();
    // A close by us is not reconnected by partysocket: the page's return reconnects it.
    socket.close(1000, "pagehide");
    status = "connecting";
  }
  function onBack(): void {
    if (socket === null || ended || !visibleNow()) return;
    if (socket.readyState !== socket.OPEN && socket.readyState !== socket.CONNECTING) {
      socket.reconnect();
    } else if (socket.readyState === socket.OPEN) {
      ping();
    }
  }
  const browser = typeof window !== "undefined" && typeof document !== "undefined";
  if (browser) {
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onBack);
    window.addEventListener("online", onBack);
    document.addEventListener("visibilitychange", onVisibility);
  }

  // --- Follows the account: signed in → connected, signed out → closed ---
  const stopFollowing = $effect.root(() => {
    $effect(() => {
      const id = account.current?.id ?? null;
      if (id === accountId) return;
      if (id === null) {
        shut();
        slot = null;
      } else {
        open(id);
      }
    });
  });

  return {
    get notice() {
      return slot !== null && !slot.held ? slot.notice : null;
    },
    get status() {
      return status;
    },
    get closeCode() {
      return closeCode;
    },
    setPlace(next) {
      place = next;
      const changed = placeChanged(slot, place);
      slot = changed.slot;
      check(changed.check);
    },
    dismiss() {
      slot = null;
    },
    close() {
      stopFollowing();
      ended = true;
      shut();
      status = "closed";
      slot = null;
      if (browser) {
        window.removeEventListener("pagehide", onPageHide);
        window.removeEventListener("pageshow", onBack);
        window.removeEventListener("online", onBack);
        document.removeEventListener("visibilitychange", onVisibility);
      }
    },
  };
}
