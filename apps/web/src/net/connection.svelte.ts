// The browser's connection to one table: one reconnecting WebSocket (partysocket) to /ws/table/<id> on
// the page's own origin. On every open it says hello with the protocol version, the device token and
// the first name (the token travels only here, never in a URL, T-02-06). Every frame is parsed with the
// shared protocol; what the screens read (status, you, table, view, seq) is reactive.
//
// maxEnqueuedMessages 0: a frame sent while closed is dropped, never replayed ahead of the next hello
// (02-RESEARCH Pattern 5). A close code from 4001 up (elsewhere, version, gone) ends the connection;
// 4000 (the server swept the socket as silent) is reconnected like a network drop.
//
// Presence (plan 02-06, 02-RESEARCH Pattern 7, Pitfall 5): while open the client sends "ping" every
// PING_MS (the Durable Object's auto-response answers "pong" without waking it); no pong within
// PONG_MS → reconnect. The page's pagehide closes the socket with 1000, so the others see the pause at
// once; pageshow, visibilitychange to visible and online reconnect when the socket is not open. Each
// table frame carries the server's clock: `serverOffset` (server − device) is measured on it, for the
// pause's countdown.

import type { PlayerView } from "@toc/engine";
import {
  CLOSE_SILENT,
  type ClientFrame,
  type EventsFrame,
  PROTOCOL_VERSION,
  parseServerFrame,
  type ServerFrame,
  type TablePublic,
  type You,
} from "@toc/protocol";
import ReconnectingWebSocket from "partysocket/ws";
import type { Device } from "./device.ts";
import type { RemoteConnection, StartBatch } from "./remoteGame.ts";

export type ConnectionStatus = "connecting" | "open" | "closed";

export type TableConnection = RemoteConnection & {
  readonly status: ConnectionStatus;
  /** The close code that ended the connection (4001, 4002, 4004), else null. */
  readonly closeCode: number | null;
  /** The server's clock minus the device's, in ms, measured on the latest table frame. */
  readonly serverOffset: number;
  close(): void;
};

/** How often the client pings while open (A3: 20 s; the server sweeps after 75 s of silence). */
export const PING_MS = 20_000;
/** A ping with no pong within this delay: the socket is dead, reconnect. */
export const PONG_MS = 5_000;

/** Whether a close code ends the connection for good (4001 elsewhere, 4002 version, 4004 gone). */
export function finalClose(code: number): boolean {
  return code >= 4000 && code !== CLOSE_SILENT;
}

/** ws:// or wss:// on the page's own host. */
export function tableSocketUrl(id: string, page: { protocol: string; host: string }): string {
  return `${page.protocol === "https:" ? "wss:" : "ws:"}//${page.host}/ws/table/${encodeURIComponent(id)}`;
}

export function connectTable(id: string, device: Device & { name: string }): TableConnection {
  let status = $state<ConnectionStatus>("connecting");
  let closeCode = $state<number | null>(null);
  let you = $state.raw<You | null>(null);
  let table = $state.raw<TablePublic | null>(null);
  let view = $state.raw<PlayerView | null>(null);
  let seq = $state(0);
  let serverOffset = $state(0);

  const listeners = new Set<(frame: ServerFrame) => void>();
  /** The events of the latest game start, kept until a remote game takes them. */
  let start: StartBatch | null = null;
  let collecting = false;

  const socket = new ReconnectingWebSocket(tableSocketUrl(id, location), undefined, {
    maxEnqueuedMessages: 0,
    shouldReconnectOnClose: (event) => !finalClose(event.code),
  });

  function sendRaw(frame: ClientFrame): void {
    socket.send(JSON.stringify(frame));
  }

  function keep(frame: EventsFrame): void {
    if (!collecting) return;
    if (start === null) start = { first: frame, later: [] };
    else start.later.push(frame);
  }

  function apply(frame: ServerFrame): void {
    if (frame.t === "welcome" || frame.t === "table") serverOffset = frame.table.now - Date.now();
    switch (frame.t) {
      case "welcome":
        you = frame.you;
        table = frame.table;
        view = frame.view;
        seq = frame.seq;
        // A snapshot replaces everything: a game screen built now starts from its view.
        collecting = false;
        start = null;
        return;
      case "table":
        if (table?.status === "lobby" && frame.table.status === "playing") {
          collecting = true;
          start = null;
        }
        table = frame.table;
        return;
      case "events":
        seq = frame.seq;
        view = frame.view;
        keep(frame);
        return;
      case "error":
        return;
    }
  }

  // --- Heartbeat: the only timers of the connection (no pong in time → reconnect) ---
  let pinger: ReturnType<typeof setInterval> | undefined;
  let pongTimer: ReturnType<typeof setTimeout> | undefined;

  function stopHeartbeat(): void {
    if (pinger !== undefined) clearInterval(pinger);
    if (pongTimer !== undefined) clearTimeout(pongTimer);
    pinger = undefined;
    pongTimer = undefined;
  }

  function ping(): void {
    if (socket.readyState !== socket.OPEN) return;
    socket.send("ping");
    if (pongTimer !== undefined) return;
    pongTimer = setTimeout(() => {
      pongTimer = undefined;
      if (!ended) socket.reconnect();
    }, PONG_MS);
  }

  /** Set by close() and by a final close code: nothing reconnects any more. */
  let ended = false;

  socket.addEventListener("open", () => {
    status = "open";
    sendRaw({ t: "hello", v: PROTOCOL_VERSION, token: device.token, name: device.name });
    stopHeartbeat();
    pinger = setInterval(ping, PING_MS);
  });
  socket.addEventListener("close", (event) => {
    stopHeartbeat();
    if (finalClose(event.code)) {
      closeCode = event.code;
      ended = true;
      status = "closed";
    } else if (status !== "closed") {
      status = "connecting";
    }
  });
  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    if (event.data === "pong") {
      if (pongTimer !== undefined) clearTimeout(pongTimer);
      pongTimer = undefined;
      return;
    }
    const frame = parseServerFrame(event.data);
    if (frame === null) return;
    apply(frame);
    for (const listener of [...listeners]) listener(frame);
  });

  // --- The page's life: leave at once on pagehide, come back when the page is back ---
  function onPageHide(): void {
    if (ended) return;
    stopHeartbeat();
    // A close by us is not reconnected by partysocket: the page's return reconnects it.
    socket.close(1000, "pagehide");
    status = "connecting";
  }
  function onBack(): void {
    if (ended || document.visibilityState === "hidden") return;
    if (socket.readyState !== socket.OPEN && socket.readyState !== socket.CONNECTING) {
      socket.reconnect();
    } else if (socket.readyState === socket.OPEN) {
      // A socket the phone froze may look open: a ping finds out at once.
      ping();
    }
  }
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onBack);
  window.addEventListener("online", onBack);
  document.addEventListener("visibilitychange", onBack);

  function removePageListeners(): void {
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onBack);
    window.removeEventListener("online", onBack);
    document.removeEventListener("visibilitychange", onBack);
  }

  return {
    get status() {
      return status;
    },
    get closeCode() {
      return closeCode;
    },
    get you() {
      return you;
    },
    get table() {
      return table;
    },
    get view() {
      return view;
    },
    get seq() {
      return seq;
    },
    get serverOffset() {
      return serverOffset;
    },
    send(frame) {
      if (status !== "open") return false;
      sendRaw(frame);
      return true;
    },
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    takeStart() {
      const taken = start;
      start = null;
      collecting = false;
      return taken;
    },
    close() {
      ended = true;
      status = "closed";
      listeners.clear();
      stopHeartbeat();
      removePageListeners();
      socket.close(1000);
    },
  };
}
