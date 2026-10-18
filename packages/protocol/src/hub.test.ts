import { describe, expect, it } from "vitest";
import {
  HUB_VERSION,
  MAX_HUB_FRAME_CHARS,
  NOTICE_FROM_MAX,
  parseHubClientFrame,
  parseHubServerFrame,
} from "./hub.ts";

// The frames of the app's own socket to its PlayerHub (/ws/me, plan 04-06; 04-RESEARCH Pattern 6):
// the client says hi with HUB_VERSION, then vis on every visibility change; the server sends notice.
// No account id, no friend list, no presence of anyone else ever crosses this socket (T-04-51).

const TABLE = "abcdefghijklmnopqrstuv";

describe("hub client frames", () => {
  it("HUB_VERSION is 1, a frame is at most 256 characters", () => {
    expect(HUB_VERSION).toBe(1);
    expect(MAX_HUB_FRAME_CHARS).toBe(256);
  });

  it("accepts hi { v } and vis { visible }", () => {
    expect(parseHubClientFrame(JSON.stringify({ t: "hi", v: 1 }))).toEqual({ t: "hi", v: 1 });
    expect(parseHubClientFrame(JSON.stringify({ t: "hi", v: 7 }))).toEqual({ t: "hi", v: 7 });
    expect(parseHubClientFrame(JSON.stringify({ t: "vis", visible: true }))).toEqual({
      t: "vis",
      visible: true,
    });
    expect(parseHubClientFrame(JSON.stringify({ t: "vis", visible: false }))).toEqual({
      t: "vis",
      visible: false,
    });
  });

  it("refuses any other shape, an extra key, a non-string and a text over 256 characters", () => {
    const refused: unknown[] = [
      JSON.stringify({ t: "hi" }),
      JSON.stringify({ t: "hi", v: "1" }),
      JSON.stringify({ t: "hi", v: 1.5 }),
      JSON.stringify({ t: "hi", v: 1, account: "x" }),
      JSON.stringify({ t: "vis" }),
      JSON.stringify({ t: "vis", visible: "yes" }),
      JSON.stringify({ t: "vis", visible: true, seenAt: 1 }),
      JSON.stringify({ t: "notice", kind: "invite", table: TABLE, from: "Ana", at: 1 }),
      JSON.stringify({ t: "hello", v: 5 }),
      "ping",
      "{",
      "",
      "null",
      "[]",
      42,
      null,
      undefined,
      { t: "hi", v: 1 },
    ];
    for (const raw of refused) expect(parseHubClientFrame(raw), String(raw)).toBeNull();
    const padded = `{"t":"vis","visible":true}${" ".repeat(MAX_HUB_FRAME_CHARS)}`;
    expect(padded.length).toBeGreaterThan(MAX_HUB_FRAME_CHARS);
    expect(parseHubClientFrame(padded)).toBeNull();
    const fits = `{"t":"vis","visible":true}`.padEnd(MAX_HUB_FRAME_CHARS, " ");
    expect(parseHubClientFrame(fits)).toEqual({ t: "vis", visible: true });
  });
});

describe("hub server frames", () => {
  const invite = { t: "notice", kind: "invite", table: TABLE, from: "Romain", at: 1_800_000_000 };

  it("accepts an invite and a turn notice, own and resumed optional", () => {
    expect(parseHubServerFrame(JSON.stringify(invite))).toEqual(invite);
    const turn = { ...invite, kind: "turn", own: true, resumed: true };
    expect(parseHubServerFrame(JSON.stringify(turn))).toEqual(turn);
    const other = { ...invite, kind: "turn", own: false };
    expect(parseHubServerFrame(JSON.stringify(other))).toEqual(other);
  });

  it("from: 1 to 20 code points (accents and other planes counted as one)", () => {
    const twenty = "É".repeat(NOTICE_FROM_MAX);
    expect(parseHubServerFrame(JSON.stringify({ ...invite, from: twenty }))?.from).toBe(twenty);
    const emoji = "🐴".repeat(NOTICE_FROM_MAX);
    expect(parseHubServerFrame(JSON.stringify({ ...invite, from: emoji }))?.from).toBe(emoji);
    expect(parseHubServerFrame(JSON.stringify({ ...invite, from: `${twenty}x` }))).toBeNull();
    expect(parseHubServerFrame(JSON.stringify({ ...invite, from: "" }))).toBeNull();
  });

  it("refuses another kind, a malformed table id, a missing time and other frames", () => {
    const refused: unknown[] = [
      JSON.stringify({ ...invite, kind: "chat" }),
      JSON.stringify({ ...invite, table: "../etc/passwd" }),
      JSON.stringify({ ...invite, table: `${TABLE}x` }),
      JSON.stringify({ ...invite, at: undefined }),
      JSON.stringify({ ...invite, at: -1 }),
      JSON.stringify({ ...invite, own: "yes" }),
      JSON.stringify({ t: "welcome" }),
      "pong",
      "{",
      null,
      invite,
    ];
    for (const raw of refused) expect(parseHubServerFrame(raw), String(raw)).toBeNull();
  });
});
