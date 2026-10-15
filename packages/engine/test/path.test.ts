// The single movement path: walk(), isProtected(), blocksPath() (RULE-08, RULE-12, RULE-13, RULE-15).
// Cell arithmetic: cell = (EXIT[color] + progress) mod 72, EXIT bleu 0, jaune 18, rouge 36, vert 54.

import { describe, expect, it } from "vitest";
import {
  blocksPath,
  DEFAULT_RULES,
  isProtected,
  type PawnId,
  type Place,
  walk,
} from "../src/index.ts";
import { board } from "./helpers.ts";

const alone = (id: PawnId) => ({ capturePassed: false, ownIds: [id] as PawnId[] });
const bleuAll: PawnId[] = ["bleu0", "bleu1", "bleu2", "bleu3"];
const ring = (cell: number): Place => ({ z: "ring", cell });
const home = (slot: 0 | 1 | 2 | 3): Place => ({ z: "home", color: "bleu", slot });

describe("home entry (D-01, D-02, D-03)", () => {
  it("exact count to an empty slot enters the home: cells 67 to 70 then slots 0 and 1", () => {
    const b = board({ bleu0: { p: 66 } });
    const r = walk(b, "bleu0", 6, 1, alone("bleu0"));
    expect(r).toEqual({
      ok: true,
      path: [ring(67), ring(68), ring(69), ring(70), home(0), home(1)],
      end: { zone: "home", slot: 1 },
      captures: [],
    });
  });

  it("enters slot 0, 2 and 3 for counts 1, 3 and 4 past the entry square", () => {
    const b = board({ bleu0: { p: 66 } });
    for (const [steps, slot] of [
      [5, 0],
      [7, 2],
      [8, 3],
    ] as const) {
      const r = walk(b, "bleu0", steps, 1, alone("bleu0"));
      expect(r.ok && r.end).toEqual({ zone: "home", slot });
    }
  });

  it("a count that overshoots the home does not enter: the pawn goes round again (D-01)", () => {
    const b = board({ bleu0: { p: 66 } });
    const r = walk(b, "bleu0", 9, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: 75 });
  });

  it("stopping exactly on the entry square is not entering", () => {
    const b = board({ bleu0: { p: 66 } });
    const r = walk(b, "bleu0", 4, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: 70 });
  });

  it("from the entry square the next count enters the home", () => {
    const b = board({ bleu0: { p: 70 } });
    const r = walk(b, "bleu0", 2, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "home", slot: 1 });
  });

  it("an occupied target slot sends the pawn round again", () => {
    const b = board({ bleu0: { p: 66 }, bleu1: { h: 1 } });
    const r = walk(b, "bleu0", 6, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: 72 });
  });

  it("a home pawn in the way is jumped: 8 steps from 66 over slot 0 land in slot 3 (G17)", () => {
    const b = board({ bleu0: { p: 66 }, bleu1: { h: 0 } });
    expect(walk(b, "bleu0", 8, 1, alone("bleu0"))).toEqual({
      ok: true,
      path: [ring(67), ring(68), ring(69), ring(70), home(0), home(1), home(2), home(3)],
      end: { zone: "home", slot: 3 },
      captures: [],
    });
    expect(walk(b, "bleu0", 6, 1, alone("bleu0"))).toMatchObject({
      ok: true,
      end: { zone: "home", slot: 1 },
    });
  });

  it("jumping three home pawns to the last empty slot (G17)", () => {
    const b = board({ bleu0: { p: 69 }, bleu1: { h: 0 }, bleu2: { h: 1 }, bleu3: { h: 2 } });
    const r = walk(b, "bleu0", 5, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "home", slot: 3 });
  });

  it("jumping does not open an occupied target: the pawn goes round again (G17, D-01)", () => {
    const b = board({ bleu0: { p: 66 }, bleu1: { h: 0 }, bleu2: { h: 2 } });
    const r = walk(b, "bleu0", 7, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: 73 });
  });

  it("HOME_JUMP_ALLOWED false, G2 continue: a home pawn in the way sends the pawn round again", () => {
    const b = board({ bleu0: { p: 66 }, bleu1: { h: 0 } }, { HOME_JUMP_ALLOWED: false });
    const r = walk(b, "bleu0", 6, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: 72 });
  });

  it("HOME_JUMP_ALLOWED false, G2 illegal: a home pawn in the way forbids the move", () => {
    const b = board(
      { bleu0: { p: 66 }, bleu1: { h: 0 } },
      { HOME_JUMP_ALLOWED: false, HOME_JUMP_BLOCKED: "illegal" },
    );
    expect(walk(b, "bleu0", 6, 1, alone("bleu0"))).toEqual({ ok: false, reason: "home-blocked" });
  });

  it("HOME_JUMP_BLOCKED illegal is not read while HOME_JUMP_ALLOWED: the pawn jumps (G17)", () => {
    const b = board({ bleu0: { p: 66 }, bleu1: { h: 0 } }, { HOME_JUMP_BLOCKED: "illegal" });
    const r = walk(b, "bleu0", 6, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "home", slot: 1 });
  });

  it("after one extra lap the pawn enters at the next passage (progress 140 + 4)", () => {
    const b = board({ bleu0: { p: 140 } });
    const r = walk(b, "bleu0", 4, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "home", slot: 1 });
  });

  it("a pawn at progress -2 enters at the exact count (G14)", () => {
    const b = board({ bleu0: { p: -2 } });
    const r = walk(b, "bleu0", 3, 1, alone("bleu0"));
    expect(r).toEqual({
      ok: true,
      path: [home(0), home(1), home(2)],
      end: { zone: "home", slot: 2 },
      captures: [],
    });
  });

  it("a pawn of another colour enters its own home by its own entry square", () => {
    const b = board({ jaune0: { p: 68 } });
    const r = walk(b, "jaune0", 5, 1, alone("jaune0"));
    expect(r.ok && r.end).toEqual({ zone: "home", slot: 2 });
    expect(r.ok && r.path[r.path.length - 1]).toEqual({ z: "home", color: "jaune", slot: 2 });
  });
});

describe("entry after backing with the 4 (G14)", () => {
  it("2 steps from -4 stop on the carré 16: standing on it is not entering", () => {
    const b = board({ bleu0: { p: -4 } });
    const r = walk(b, "bleu0", 2, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: -2 });
  });

  it("3 steps from -4 cross the carré 16 and enter home slot 0", () => {
    const b = board({ bleu0: { p: -4 } });
    const r = walk(b, "bleu0", 3, 1, alone("bleu0"));
    expect(r).toEqual({
      ok: true,
      path: [ring(69), ring(70), home(0)],
      end: { zone: "home", slot: 0 },
      captures: [],
    });
  });

  it("4, 5 and 6 steps from -4 enter home slots 1, 2 and 3", () => {
    const b = board({ bleu0: { p: -4 } });
    for (const [steps, slot] of [
      [4, 1],
      [5, 2],
      [6, 3],
    ] as const) {
      const r = walk(b, "bleu0", steps, 1, alone("bleu0"));
      expect(r.ok && r.end).toEqual({ zone: "home", slot });
    }
  });

  it("a count that overshoots the home goes on round the ring (7 and 10 steps)", () => {
    const b = board({ bleu0: { p: -4 } });
    expect(walk(b, "bleu0", 7, 1, alone("bleu0"))).toMatchObject({
      ok: true,
      end: { zone: "ring", progress: 3 },
    });
    expect(walk(b, "bleu0", 10, 1, alone("bleu0"))).toMatchObject({
      ok: true,
      end: { zone: "ring", progress: 6 },
    });
  });

  it("a home pawn in the way is jumped: 5 steps from -4 land in slot 2 (G14, G17)", () => {
    const b = board({ bleu0: { p: -4 }, bleu1: { h: 0 } });
    expect(walk(b, "bleu0", 5, 1, alone("bleu0"))).toEqual({
      ok: true,
      path: [ring(69), ring(70), home(0), home(1), home(2)],
      end: { zone: "home", slot: 2 },
      captures: [],
    });
  });

  it("HOME_JUMP_ALLOWED false: G2 continue goes on round the ring, illegal forbids the move", () => {
    const cont = board({ bleu0: { p: -4 }, bleu1: { h: 0 } }, { HOME_JUMP_ALLOWED: false });
    const r = walk(cont, "bleu0", 5, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: 1 });
    const ill = board(
      { bleu0: { p: -4 }, bleu1: { h: 0 } },
      { HOME_JUMP_ALLOWED: false, HOME_JUMP_BLOCKED: "illegal" },
    );
    expect(walk(ill, "bleu0", 5, 1, alone("bleu0"))).toEqual({ ok: false, reason: "home-blocked" });
  });

  it("the 4 never enters, even with home pawns to jump (D-04, G17)", () => {
    const b = board({ bleu0: { p: 2 }, bleu1: { h: 0 } });
    const r = walk(b, "bleu0", 4, -1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: -2 });
  });

  it("the 4 from -4 still goes backward, to -8: the 4 never enters the home", () => {
    const b = board({ bleu0: { p: -4 } });
    const r = walk(b, "bleu0", 4, -1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: -8 });
  });

  it("backing 4 from progress 2 stops on the carré 16 and never enters", () => {
    const b = board({ bleu0: { p: 2 } });
    const r = walk(b, "bleu0", 4, -1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: -2 });
  });

  it("with ENTRY_WITHOUT_FULL_LAP false, -2 playing 3 stays on the ring (rule of 2026-10-13)", () => {
    const b = board({ bleu0: { p: -2 } }, { ENTRY_WITHOUT_FULL_LAP: false });
    const r = walk(b, "bleu0", 3, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: 1 });
  });
});

describe("moving inside the home (D-03)", () => {
  it("advances by the exact count over empty slots", () => {
    const b = board({ bleu0: { h: 0 } });
    const r = walk(b, "bleu0", 2, 1, alone("bleu0"));
    expect(r).toEqual({
      ok: true,
      path: [home(1), home(2)],
      end: { zone: "home", slot: 2 },
      captures: [],
    });
  });

  it("jumps a pawn already home, at the exact count onto an empty slot (G17)", () => {
    const b = board({ bleu0: { h: 0 }, bleu1: { h: 1 } });
    expect(walk(b, "bleu0", 2, 1, alone("bleu0"))).toEqual({
      ok: true,
      path: [home(1), home(2)],
      end: { zone: "home", slot: 2 },
      captures: [],
    });
  });

  it("jumps two pawns already home to the last slot (G17)", () => {
    const b = board({ bleu0: { h: 0 }, bleu1: { h: 1 }, bleu2: { h: 2 } });
    const r = walk(b, "bleu0", 3, 1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "home", slot: 3 });
  });

  it("HOME_JUMP_ALLOWED false: illegal when it would jump a pawn already home (D-03)", () => {
    const b = board({ bleu0: { h: 0 }, bleu1: { h: 1 } }, { HOME_JUMP_ALLOWED: false });
    expect(walk(b, "bleu0", 2, 1, alone("bleu0"))).toEqual({ ok: false, reason: "home-blocked" });
  });

  it("is illegal when it would land on a pawn already home", () => {
    const b = board({ bleu0: { h: 0 }, bleu1: { h: 2 } });
    expect(walk(b, "bleu0", 2, 1, alone("bleu0"))).toEqual({ ok: false, reason: "home-blocked" });
  });

  it("is illegal past the last slot", () => {
    const b = board({ bleu0: { h: 2 } });
    expect(walk(b, "bleu0", 2, 1, alone("bleu0"))).toEqual({ ok: false, reason: "home-overflow" });
  });

  it("never moves backward out of the home", () => {
    const b = board({ bleu0: { h: 2 } });
    expect(walk(b, "bleu0", 4, -1, alone("bleu0")).ok).toBe(false);
  });
});

describe("the backward 4 (RULE-08, D-04)", () => {
  it("from the exit gives progress -4 and stands on the cell before the exit", () => {
    const b = board({ bleu0: { p: 0 } });
    const r = walk(b, "bleu0", 4, -1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: -4 });
    expect(r.ok && r.path[3]).toEqual(ring(68));
  });

  it("never ends in the home, even right after the entry square", () => {
    const b = board({ bleu0: { p: 73 } });
    const r = walk(b, "bleu0", 4, -1, alone("bleu0"));
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: 69 });
  });

  it("a pawn in the stable cannot move backward", () => {
    const b = board({});
    expect(walk(b, "bleu0", 4, -1, alone("bleu0")).ok).toBe(false);
  });

  it("going backward onto an adversary captures it", () => {
    const b = board({ bleu0: { p: 10 }, rouge0: { p: 42 } });
    const r = walk(b, "bleu0", 4, -1, { capturePassed: false, ownIds: bleuAll });
    expect(r.ok && r.captures).toEqual([{ victim: "rouge0", atStep: 3 }]);
  });

  it("cannot pass a protected pawn going backward", () => {
    const b = board({ bleu0: { p: 38 }, rouge0: { p: 0 } });
    expect(walk(b, "bleu0", 4, -1, { capturePassed: false, ownIds: bleuAll })).toEqual({
      ok: false,
      reason: "blocked-protected",
    });
  });
});

describe("landing, captures and passing (RULE-12, G11)", () => {
  it("landing on one's own pawn is illegal", () => {
    const b = board({ bleu0: { p: 5 }, bleu1: { p: 8 } });
    expect(walk(b, "bleu0", 3, 1, { capturePassed: false, ownIds: bleuAll })).toEqual({
      ok: false,
      reason: "own-pawn",
    });
  });

  it("landing on any other pawn captures it, with the cell index in the path", () => {
    const b = board({ bleu0: { p: 5 }, jaune0: { p: 62 } });
    const r = walk(b, "bleu0", 3, 1, { capturePassed: false, ownIds: bleuAll });
    expect(r.ok && r.captures).toEqual([{ victim: "jaune0", atStep: 2 }]);
    expect(r.ok && r.end).toEqual({ zone: "ring", progress: 8 });
  });

  it("ordinary cards pass over pawns without capturing them", () => {
    const b = board({ bleu0: { p: 5 }, rouge0: { p: 44 }, bleu1: { p: 7 } });
    const r = walk(b, "bleu0", 6, 1, { capturePassed: false, ownIds: bleuAll });
    expect(r.ok && r.captures).toEqual([]);
  });

  it("with capturePassed, every opponent pawn on a crossed cell is captured at its step; the partner's pawn is passed (G15)", () => {
    const pawns = {
      bleu0: { p: 5 },
      bleu1: { p: 7 }, // cell 7, own: passed without capture
      rouge0: { p: 44 }, // cell 8, partner: passed without capture (G15)
      vert0: { p: 27 }, // cell 9
      jaune0: { p: 64 }, // cell 10
    };
    const r = walk(board(pawns), "bleu0", 6, 1, { capturePassed: true, ownIds: bleuAll });
    expect(r.ok && r.captures).toEqual([
      { victim: "vert0", atStep: 3 },
      { victim: "jaune0", atStep: 4 },
    ]);
    // SEVEN_EATS_PASSED_PARTNER true: the rule of 2026-10-13 (Q23), the partner's pawn is eaten too.
    const old = board(pawns, { SEVEN_EATS_PASSED_PARTNER: true });
    const r2 = walk(old, "bleu0", 6, 1, { capturePassed: true, ownIds: bleuAll });
    expect(r2.ok && r2.captures).toEqual([
      { victim: "rouge0", atStep: 2 },
      { victim: "vert0", atStep: 3 },
      { victim: "jaune0", atStep: 4 },
    ]);
  });

  it("a pawn of the colour of the exit standing on its exit is protected at progress 0", () => {
    const b = board({ bleu0: { p: 0 }, bleu1: { p: 72 }, jaune0: { p: -18 } });
    expect(isProtected("bleu0", b.pawns.bleu0, b.rules)).toBe(true);
    expect(isProtected("bleu1", b.pawns.bleu1, b.rules)).toBe(true);
    // jaune0 stands on cell 0 (bleu's exit) but that is not jaune's exit.
    expect(isProtected("jaune0", b.pawns.jaune0, b.rules)).toBe(false);
  });

  it("an extra lap on the exit is protected only if PROTECTED_AFTER_EXTRA_LAP", () => {
    const off = board({ bleu1: { p: 72 } }, { PROTECTED_AFTER_EXTRA_LAP: false });
    expect(isProtected("bleu1", off.pawns.bleu1, off.rules)).toBe(false);
    const on = board({ bleu1: { p: 72 } });
    expect(isProtected("bleu1", on.pawns.bleu1, on.rules)).toBe(true);
  });

  it("pawns in the stable or the home are never protected", () => {
    const b = board({ bleu1: { h: 0 } });
    expect(isProtected("bleu0", b.pawns.bleu0, b.rules)).toBe(false);
    expect(isProtected("bleu1", b.pawns.bleu1, b.rules)).toBe(false);
  });

  it("nobody passes, lands on or captures a protected pawn", () => {
    const b = board({ bleu0: { p: 30 }, rouge0: { p: 0 } });
    // rouge0 stands on cell 36, rouge's exit: bleu0 (cell 30) crosses it.
    expect(walk(b, "bleu0", 10, 1, { capturePassed: false, ownIds: bleuAll })).toEqual({
      ok: false,
      reason: "blocked-protected",
    });
    expect(walk(b, "bleu0", 6, 1, { capturePassed: false, ownIds: bleuAll })).toEqual({
      ok: false,
      reason: "blocked-protected",
    });
    expect(walk(b, "bleu0", 5, 1, { capturePassed: false, ownIds: bleuAll }).ok).toBe(true);
  });

  it("another colour's pawn on the diamond is an ordinary pawn", () => {
    // jaune0 stands on cell 0, bleu's exit, which is not jaune's own exit: rouge0 eats it.
    const b = board({ rouge0: { p: 34 }, jaune0: { p: 54 } });
    expect(isProtected("jaune0", b.pawns.jaune0, b.rules)).toBe(false);
    const r = walk(b, "rouge0", 2, 1, {
      capturePassed: false,
      ownIds: ["rouge0", "rouge1", "rouge2", "rouge3"],
    });
    expect(r.ok && r.captures).toEqual([{ victim: "jaune0", atStep: 1 }]);
  });

  it("blocksPath names the protected pawn on a cell and skips the pawn that moves", () => {
    const b = board({ bleu0: { p: 0 }, bleu1: { p: 2 }, jaune0: { p: 4 } });
    expect(blocksPath(0, "bleu1", b)).toBe("bleu0");
    expect(blocksPath(0, "bleu0", b)).toBeNull();
    expect(blocksPath(2, "jaune0", b)).toBeNull();
    expect(DEFAULT_RULES.PROTECTED_BLOCKS_OWNER).toBe(true);
  });
});
