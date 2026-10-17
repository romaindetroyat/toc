// The browser's connection to one table: one reconnecting WebSocket (partysocket) to /ws/table/<id> on
// the page's own origin. On every open it says hello with the protocol version, the device token and
// the first name (the token travels only here, never in a URL, T-02-06). Every frame is parsed with the
// shared protocol; what the screens read (status, you, table, view, seq) is reactive.
//
// maxEnqueuedMessages 0: a frame sent while closed is dropped, never replayed ahead of the next hello
// (02-RESEARCH Pattern 5). A close code from 4000 up (elsewhere, version, gone) ends the connection.

import type { PlayerView } from "@toc/engine";
import {
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
  close(): void;
};

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

  const listeners = new Set<(frame: ServerFrame) => void>();
  /** The events of the latest game start, kept until a remote game takes them. */
  let start: StartBatch | null = null;
  let collecting = false;

  const socket = new ReconnectingWebSocket(tableSocketUrl(id, location), undefined, {
    maxEnqueuedMessages: 0,
    shouldReconnectOnClose: (event) => event.code < 4000,
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

  socket.addEventListener("open", () => {
    status = "open";
    sendRaw({ t: "hello", v: PROTOCOL_VERSION, token: device.token, name: device.name });
  });
  socket.addEventListener("close", (event) => {
    if (event.code >= 4000) {
      closeCode = event.code;
      status = "closed";
    } else if (status !== "closed") {
      status = "connecting";
    }
  });
  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    const frame = parseServerFrame(event.data);
    if (frame === null) return;
    apply(frame);
    for (const listener of [...listeners]) listener(frame);
  });

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
      status = "closed";
      listeners.clear();
      socket.close(1000);
    },
  };
}
