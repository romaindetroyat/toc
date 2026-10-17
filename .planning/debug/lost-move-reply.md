---
status: awaiting_human_verify
trigger: "Intermittent workerd failure (about one full pnpm test in three): a player's act gets no reply, no events and no error frame (leak.test.ts in 02-08, bots.test.ts at seq 310 in 02-09). Real server bug or test artifact?"
created: 2026-10-17T15:08:00Z
updated: 2026-10-17T16:40:00Z
---

# The « lost » reply to a move

## Current Focus

bug_class: Bohrbug. It is deterministic for a given action and looks intermittent only because each table's deck seed is random.
hypothesis: CONFIRMED. The reply was never lost: the server refused a legal 7 as `bad-frame`.
next_action: Romain checks it in a real game (see « Human check »), then the note moves to resolved/ with a knowledge-base entry.

## Symptoms

- expected: every `act` from a seated person is answered with its events, or with an error.
- actual: the whole-game workerd tests sometimes waited 60 s for events after an act and timed out.
- errors: 02-09 « timed out waiting for Ana's events after her act at 310 (last frames: table, events 310, table) »; 02-08 « timed out waiting for jaune's events after its act ».

## Root cause

- `@toc/protocol` capped a 7 plan at four parts (`z.maxLength(4)`, one part per knight).
- The engine plays up to seven parts:
  - G5: a knight may come back after another one ([bleu0 1, bleu1 1, bleu0 1, …]).
  - G12: the partner's knights may finish the 7.
- `GameRoom` therefore answered such a legal act with `error bad-frame`, and the move never reached `apply()`. The table stayed on that seq.
- The randomLegal player in the tests splits a 7 by random walk. About 0.3 % of its 7s have five or six parts. That is a few % of whole games per human seat, so a failure now and then.
- Why 02-09 saw « no reply at all »: `bots.test.ts` built its timeout message when the wait began, right after the send. Its « last frames » and « socket close » therefore showed the moment before any reply, and the `bad-frame` that came next was never printed.

## Evidence (key)

- Worker project alone, run 11 of 15: `leak.test.ts`, jaune's act at 357. The last frames were events 356, events 357, error bad-frame. The table was still at 357 and the socket was open.
  - There was one bad-frame only, during a 60 s wait with pings every 10 s. So the pings were auto-answered, and the bad-frame was the act's own reply.
- Under load, with the old cap put back in the working tree only: `bots.test.ts`, whole game, Ana's act at 152.
  - The action was `seven 7C [bleu2 1, bleu0 1, bleu1 1, bleu2 1, bleu1 3]`.
  - The frames were events 152, table, then error bad-frame.
  - « events, table » is exactly 02-09's pattern. This time the message was built after the wait, so it shows the reply.
- Probe over 300 seeded random games (243 841 random actions):
  - 43 were refused by `parseClientFrame`. All were 7s of five or six parts, and `apply()` plays every one of them.
  - Nothing else was refused.
- Real client:
  - The 7 splitter (`turnUi.ts`) takes knights in any order. `normalizePlan` only merges consecutive steps of one knight.
  - On `bad-frame`, `Table.svelte` replaces the game with « La table ne répond pas ».
  - The table then waits for a move the server refused.

## Eliminated

- Alarm/socket race, hibernation wake, eviction:
  - The failing act did get a reply, and its socket stayed open.
  - The act path has no await before `reduce()`.
  - `evictDurableObject` waits until the object is idle (workerd `evictWhenIdle`).
  - The in-memory state is only a cache of SQLite.
- The bot slice alarm overwriting another deadline:
  - There is one alarm, re-armed after every command at `nextDeadline()`, the earliest of the bot, pauseChoice, sweep, expire and d1Retry deadlines.
  - A probe with real alarms only (no `runDurableObjectAlarm`) ran about 16 000 Champion slice alarms over 18 tables with no stall.
- 30-day expiry: never reached at the test pace.
- Test client ping: a ping that reached the handler would come back as a bad-frame every 10 s, not once.
- CPU limit or contention: workerd sets no CPU limit locally. The failure also happened without load (1 in 15 runs of the worker project alone). Load added no failure of its own.
- The 75 s sweep: already ruled out in 02-09.

## Fix (commits)

- `283d75c` test, RED:
  - `frames.test.ts`: every split `sevenPlans()` lists for two knights (some of seven parts) must pass `parseClientFrame`. Eight parts stay refused.
  - `room.test.ts` (workerd): a seven-part 7 on the real socket must be answered with its events and logged as sent.
- `b05833f` fix, GREEN: the plan bound is `SEVEN_PARTS = 7`, the engine's own (seven steps of at least one each). The protocol stays a shape check and `apply()` still judges. No protocol version change.
- `55877a6` test robustness:
  - `bots.test.ts` builds its timeout message after the wait, with the action and the stored table's status and seq. `leak.test.ts` names the action too.
  - The Champions' deal now evicts every second step. Its check « more than one eviction » failed 1 run in 15 when the alarm, firing by itself at pace zero, played most of the deal within 20 steps.

## Verification

- Mutants: `SEVEN_PARTS` set to 4, 6 or 8 each makes `frames.test.ts` fail.
- Before the fix:

  | Setup | Runs | Lost replies | Other failures |
  |---|---|---|---|
  | Worker project alone | 15 | 1 | 1 evictions flake |
  | Two full `pnpm test` at once | 8 | 1 | none |

- After the fix:

  | Setup | Runs | Result |
  |---|---|---|
  | Worker project alone | 20 | 20 green, 30/30 tests each |
  | Two full `pnpm test` at once | 10 | 10 green, 1307 passed and 2 skipped each |

- Gate, `pnpm typecheck && pnpm lint && pnpm test`, run 3 times in a row, all green:
  - svelte-check: 490 files, 0 errors, 0 warnings.
  - Biome: 279 files.
  - Vitest: 83 files, 1307 passed, 2 skipped.
- Online Playwright (`playwright.online.config.ts`): 44 passed. Nothing is listening on 8787 afterwards, and no wrangler or workerd process is left.

## Human check

At an online table, split a 7 by coming back to a knight, for example 1 to A, 1 to B, 1 to A, 1 to B, 3 to A. The move must play. Before the fix, the screen showed « La table ne répond pas ».

## Follow-ups (not done here)

- The client treats any `bad-frame` during a game as « La table ne répond pas » and leaves the turn « waiting ». A refused act could re-open the turn instead, as « illegal » already does.
- The Champion re-arms each slice at the same past `dueAt` and relies on `setAlarm` clamping it to « now ». If a slice alarm ever ran in the same millisecond as its scheduled time, the runtime would see an unchanged alarm and could drop it. This was not observed in about 16 000 real slice alarms. It is cheap to harden later.
