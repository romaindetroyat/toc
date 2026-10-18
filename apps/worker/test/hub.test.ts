// PlayerHub, the Durable Object of each account (plan 04-03; 04-RESEARCH Patterns 3 and 6), in workerd
// with real SQLite. Two counters, both on the caller's clock (`now`), so the tests move time without
// waiting and nothing arms an alarm:
//   checkBackupCode   the backup-code attempts of the recovery: 5 wrong codes in a row lock the
//                     account 15 minutes, then each wrong code after a lock locks it twice as long
//                     (30, 60… capped at 24 hours); a right code resets everything; while locked even
//                     the right code is refused
//   allow             sliding-window rate limits per kind (friend codes, table invites: later plans)
// Only MACs reach the hub, and it keeps neither of them: its SQLite holds counters and times.

import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  BACKUP_FAILURES,
  BACKUP_LOCK_MAX_MS,
  BACKUP_LOCK_MS,
  type PlayerHub,
} from "../src/PlayerHub.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const T0 = 1_800_000_000_000;

const EXPECTED = "expected-mac-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const WRONG = "a-wrong-mac-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

let next = 0;
/** A fresh hub for each test (one per account name). */
const hub = () => env.PLAYER_HUB.getByName(`hub-test-${++next}-${crypto.randomUUID()}`);

type Hub = ReturnType<typeof hub>;

/** `count` wrong codes at `now`, each answered `wrong` or `locked`. */
async function wrong(stub: Hub, count: number, now: number) {
  const answers = [];
  for (let i = 0; i < count; i++) {
    answers.push(await stub.checkBackupCode({ expected: EXPECTED, given: WRONG, now }));
  }
  return answers;
}

describe("PlayerHub.checkBackupCode", () => {
  it("exports the lockout numbers of 04-RESEARCH Pattern 3", () => {
    expect(BACKUP_FAILURES).toBe(5);
    expect(BACKUP_LOCK_MS).toBe(15 * MINUTE);
    expect(BACKUP_LOCK_MAX_MS).toBe(24 * HOUR);
  });

  it("the right code: ok; a wrong one: wrong", async () => {
    const stub = hub();
    expect(await stub.checkBackupCode({ expected: EXPECTED, given: EXPECTED, now: T0 })).toEqual({
      ok: true,
    });
    expect(await stub.checkBackupCode({ expected: EXPECTED, given: WRONG, now: T0 })).toEqual({
      ok: false,
      reason: "wrong",
    });
    // Different lengths are different codes, not an error.
    expect(await stub.checkBackupCode({ expected: EXPECTED, given: "short", now: T0 })).toEqual({
      ok: false,
      reason: "wrong",
    });
  });

  it("the fifth wrong code in a row locks for 15 minutes, even against the right code", async () => {
    const stub = hub();
    const four = await wrong(stub, 4, T0);
    expect(four).toEqual(Array(4).fill({ ok: false, reason: "wrong" }));
    expect(await stub.checkBackupCode({ expected: EXPECTED, given: WRONG, now: T0 + 1 })).toEqual({
      ok: false,
      reason: "locked",
      until: T0 + 1 + 15 * MINUTE,
    });
    // Locked: the right code is refused too, and the lock does not move.
    expect(
      await stub.checkBackupCode({ expected: EXPECTED, given: EXPECTED, now: T0 + 14 * MINUTE }),
    ).toEqual({ ok: false, reason: "locked", until: T0 + 1 + 15 * MINUTE });
    expect(
      await stub.checkBackupCode({ expected: EXPECTED, given: WRONG, now: T0 + 14 * MINUTE }),
    ).toEqual({ ok: false, reason: "locked", until: T0 + 1 + 15 * MINUTE });
  });

  it("a success before the fifth resets the count", async () => {
    const stub = hub();
    await wrong(stub, 4, T0);
    expect(await stub.checkBackupCode({ expected: EXPECTED, given: EXPECTED, now: T0 })).toEqual({
      ok: true,
    });
    expect(await wrong(stub, 4, T0)).toEqual(Array(4).fill({ ok: false, reason: "wrong" }));
    expect((await wrong(stub, 1, T0))[0]).toMatchObject({ ok: false, reason: "locked" });
  });

  it("after a lock, each wrong code locks twice as long: 30, 60… minutes, capped at 24 hours", async () => {
    const stub = hub();
    await wrong(stub, 5, T0);
    let at = T0 + 15 * MINUTE;
    const durations: number[] = [];
    for (let i = 0; i < 9; i++) {
      const answer = await stub.checkBackupCode({ expected: EXPECTED, given: WRONG, now: at });
      if (answer.ok || answer.reason !== "locked") throw new Error(`not locked: ${answer}`);
      durations.push(answer.until - at);
      at = answer.until;
    }
    expect(durations.map((ms) => ms / MINUTE)).toEqual([
      30, 60, 120, 240, 480, 960, 1440, 1440, 1440,
    ]);
  });

  it("the lock ends on time: the right code then opens and resets the ladder", async () => {
    const stub = hub();
    await wrong(stub, 5, T0);
    await wrong(stub, 1, T0 + 15 * MINUTE); // 30 minutes now
    const open = T0 + 45 * MINUTE;
    expect(
      await stub.checkBackupCode({ expected: EXPECTED, given: EXPECTED, now: open - 1 }),
    ).toMatchObject({ ok: false, reason: "locked" });
    expect(await stub.checkBackupCode({ expected: EXPECTED, given: EXPECTED, now: open })).toEqual({
      ok: true,
    });
    // Back to the first step: four wrong codes are only wrong, the fifth locks 15 minutes.
    expect(await wrong(stub, 4, open)).toEqual(Array(4).fill({ ok: false, reason: "wrong" }));
    expect((await wrong(stub, 1, open))[0]).toEqual({
      ok: false,
      reason: "locked",
      until: open + 15 * MINUTE,
    });
  });

  it("keeps no MAC in its SQLite, only counters and times", async () => {
    const stub = hub();
    await wrong(stub, 3, T0);
    await stub.checkBackupCode({ expected: EXPECTED, given: EXPECTED, now: T0 });
    await stub.allow({ kind: "friend-code", max: 2, windowMs: HOUR, now: T0 });
    const dump = await runInDurableObject(stub, (_hub: PlayerHub, state) => {
      const sql = state.storage.sql;
      const tables = sql
        .exec(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\'",
        )
        .toArray()
        .map((row) => String(row.name));
      return tables.map((name) => ({ name, rows: sql.exec(`SELECT * FROM ${name}`).toArray() }));
    });
    const text = JSON.stringify(dump);
    expect(text).not.toContain(EXPECTED);
    expect(text).not.toContain(WRONG);
    expect(dump.map((table) => table.name).sort()).toEqual(["attempts", "limits"]);
  });

  it("uses the real clock when no time is given", async () => {
    const stub = hub();
    await wrong(stub, 4, Date.now());
    const before = Date.now();
    const answer = await stub.checkBackupCode({ expected: EXPECTED, given: WRONG });
    expect(answer).toMatchObject({ ok: false, reason: "locked" });
    if (answer.ok || answer.reason !== "locked") return;
    expect(answer.until).toBeGreaterThanOrEqual(before + 15 * MINUTE);
    expect(answer.until).toBeLessThanOrEqual(Date.now() + 15 * MINUTE);
  });
});

describe("PlayerHub.allow", () => {
  it("the first max calls in the window pass, then none until the oldest leaves it", async () => {
    const stub = hub();
    const limit = { kind: "friend-code", max: 3, windowMs: 10 * MINUTE };
    expect(await stub.allow({ ...limit, now: T0 })).toBe(true);
    expect(await stub.allow({ ...limit, now: T0 + MINUTE })).toBe(true);
    expect(await stub.allow({ ...limit, now: T0 + 2 * MINUTE })).toBe(true);
    expect(await stub.allow({ ...limit, now: T0 + 3 * MINUTE })).toBe(false);
    // A refused call is not counted: it does not push the window on.
    expect(await stub.allow({ ...limit, now: T0 + 10 * MINUTE - 1 })).toBe(false);
    expect(await stub.allow({ ...limit, now: T0 + 10 * MINUTE })).toBe(true);
    expect(await stub.allow({ ...limit, now: T0 + 10 * MINUTE })).toBe(false);
    expect(await stub.allow({ ...limit, now: T0 + 11 * MINUTE })).toBe(true);
  });

  it("kinds are independent", async () => {
    const stub = hub();
    expect(await stub.allow({ kind: "a", max: 1, windowMs: HOUR, now: T0 })).toBe(true);
    expect(await stub.allow({ kind: "a", max: 1, windowMs: HOUR, now: T0 })).toBe(false);
    expect(await stub.allow({ kind: "b", max: 1, windowMs: HOUR, now: T0 })).toBe(true);
    expect(await stub.allow({ kind: "b", max: 1, windowMs: HOUR, now: T0 })).toBe(false);
  });

  it("prunes the entries that left the window", async () => {
    const stub = hub();
    for (let i = 0; i < 5; i++) {
      await stub.allow({ kind: "invite", max: 10, windowMs: MINUTE, now: T0 + i });
    }
    await stub.allow({ kind: "invite", max: 10, windowMs: MINUTE, now: T0 + 2 * MINUTE });
    const left = await runInDurableObject(stub, (_hub: PlayerHub, state) =>
      state.storage.sql.exec("SELECT COUNT(*) AS n FROM limits").one(),
    );
    expect(Number(left.n)).toBe(1);
  });

  it("uses the real clock when no time is given", async () => {
    const stub = hub();
    expect(await stub.allow({ kind: "x", max: 1, windowMs: HOUR })).toBe(true);
    expect(await stub.allow({ kind: "x", max: 1, windowMs: HOUR })).toBe(false);
  });

  it("release gives back one call counted at that time, of that kind only (plan 04-05)", async () => {
    const stub = hub();
    const limit = { kind: "code-fail", max: 2, windowMs: HOUR };
    expect(await stub.allow({ ...limit, now: T0 })).toBe(true);
    expect(await stub.allow({ ...limit, now: T0 + 1 })).toBe(true);
    expect(await stub.allow({ ...limit, now: T0 + 2 })).toBe(false);
    await stub.release({ kind: "code-fail", at: T0 + 1 });
    // Another kind or a time never counted gives nothing back.
    await stub.release({ kind: "other", at: T0 });
    await stub.release({ kind: "code-fail", at: T0 + 5 });
    expect(await stub.allow({ ...limit, now: T0 + 3 })).toBe(true);
    expect(await stub.allow({ ...limit, now: T0 + 4 })).toBe(false);
  });
});

describe("PlayerHub per account", () => {
  it("one object per name: two accounts never share their counters", async () => {
    const ana = env.PLAYER_HUB.getByName(`ana-${crypto.randomUUID()}`);
    const ben = env.PLAYER_HUB.getByName(`ben-${crypto.randomUUID()}`);
    await wrong(ana, 5, T0);
    expect((await wrong(ana, 1, T0))[0]).toMatchObject({ reason: "locked" });
    expect(await ben.checkBackupCode({ expected: EXPECTED, given: EXPECTED, now: T0 })).toEqual({
      ok: true,
    });
  });

  it("arms no alarm", async () => {
    const stub = hub();
    await wrong(stub, 5, T0);
    const alarm = await runInDurableObject(stub, (_hub: PlayerHub, state) =>
      state.storage.getAlarm(),
    );
    expect(alarm).toBeNull();
  });
});
