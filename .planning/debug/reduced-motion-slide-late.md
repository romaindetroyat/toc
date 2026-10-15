---
status: awaiting_human_verify
trigger: "Flaky Playwright test apps/web/e2e/animations.spec.ts:782 (desktop): near(mover.begins - card.ends, LEAD, 12) sometimes fails with 23.324 (one frame beyond the +/-12 ms tolerance), ~2 of 6-8 isolated runs. Find why the knight's slide sometimes starts one frame late under reduced motion and fix the real cause."
created: 2026-10-14T00:00:00Z
updated: 2026-10-14T13:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - the Director's motions are Web Animations left with a pending play; Chromium runs transform/opacity animations of the SVG groups on the compositor and gives them as start time the impl frame that activates the commit carrying them. When the main thread's work in the frame the knight is started in (card node removed, felt shows the card, flushSync raise, style/paint) runs past the frame deadline, the commit lands one frame later and so does the knight's start time: its lead becomes LEAD + 1 frame, measured as 83.324 instead of 66.658.
tdd_checkpoint:
  test_file: apps/web/e2e/animations.spec.ts
  test_name: "une image chargée au départ du cheval ne le retarde pas : il glisse toujours 60 ms après la carte"
  status: green (red: 10/10 failed before the fix, desktop + phone, 83.324 x8 / 99.99 x2; green: 20/20 with the fix)
next_action: human verification in the real app (reduced motion on, play a card: the knight slides right after the card fade); then archive to resolved/ and append the knowledge base entry
commit: e0479d5 (fix + tests)
bug_class: heisenbug-mandelbug (load-dependent timing; deterministic once the load is injected)

reasoning_checkpoint:
  hypothesis: "The knight's slide starts one frame late because its Web Animations are created pending and Chromium (threaded animation) resolves their start time from the compositor frame that activates the commit; heavy main-thread work in that frame pushes the commit to the next frame, so startTime = T(N+1) instead of T(N)."
  confirming_evidence:
    - "Probe: in failing runs mover.animate() is called in the same frame (before rAF) as in passing runs; only the resolved startTime differs, by exactly one 16.666 ms frame (83.324 vs 66.658)."
    - "E2: +14 ms busy-wait before mover.animate() -> 39/40 late (and 1 two frames late); load in that frame causes the slip deterministically."
    - "E1: --disable-threaded-animation -> 20/20 on time, also with the 14 ms busy-wait (20/20): main-thread start times are the frame clock whatever the load."
    - "E3: startTime anchored to document.timeline.currentTime after animate() -> 40/40 on time, 20 of them under the 14 ms load."
  falsification_test: "If anchoring the start time did not remove the slip under injected load, or if --disable-threaded-animation still produced 14-frame gaps, the compositor start-time path would not be the cause."
  fix_rationale: "The Director decides when a motion starts (lead shared with the audio clock, t0 = now + LEAD). Setting each animation's startTime to its timeline's current time when it is created makes the start the frame the Director asked for, independent of when the compositor picks the commit up. Applied to every Director-led motion (knights, cards, party particles) so the animations of one step stay on one clock."
  blind_spots: "Other engines (WebKit, Gecko) were not tested; their document timeline is also the frame clock, refreshed per task, so anchoring is at worst equivalent to their pending start. A timeline that is stale long after an idle period would start the motion early (never seen; the Director only starts motions after input, timers or other motions). HandFan animations are not Director-led and keep the pending start."
  candidate_causes:
    - "code: Director chaining (finished -> onDone -> settled -> drain -> hop) crossing a task boundary - eliminated, mover is created in the right frame every run"
    - "environment: Chromium compositor-synchronised start time + main-thread load (2 workers, headless) - confirmed (E1/E2)"
    - "code: start times never pinned by the animators (pending play) - confirmed as the defect that exposes the product to the environment (E3)"
    - "data/measurement: recorder frame quantisation - eliminated as sole cause, the gap is always an exact frame count and the slip is in the browser's startTime, not in the recorder"
  and_gate: "yes - two conditions together: (1) the animations are left pending (code) AND (2) the frame's main-thread work misses the commit deadline under threaded animation (environment). Removing either one (E3 or E1) removes the failure. The fix removes (1), the only one the product controls."

## Symptoms

expected: mover.begins - card.ends is within LEAD +/- 12 ms under reduced motion (desktop project)
actual: sometimes 23.324 ms off (about one 16.7 ms frame beyond tolerance); always the same value 23.324
errors: expect(near(mover.begins - card.ends, LEAD, 12)) fails, value 23.324
reproduction: pnpm --filter @toc/web exec playwright test e2e/animations.spec.ts:782 --project=desktop --repeat-each 10
started: before plan 01-28 (fails with component files of 09fc1c3 too), 2/6 to 2/8 isolated runs

## Eliminated

## Evidence

- timestamp: 2026-10-14T00:10Z
  checked: chain from card fade to knight slide (director.ts playCardPlayed -> drain -> playMovement; Game.svelte launch(); CardFlights.svelte use:fly -> cardFx.runFlight; animator.ts hop)
  found: card spec delayMs 0 + leadMs 60 -> node.animate(delay 60, duration 150, fill both); launch resolves from animation.finished -> onDone; Director awaits it, folds cardPlayed, then the drain loop plays pawnMoved -> hop -> mover.animate(delay 60, duration 180). The recorder measures begins = startTime + delay, ends = begins + duration. So mover.begins - card.ends = mover.startTime - card.startTime - 150.
  implication: the measured gap is purely the distance between the two animations' resolved start times (frame clock); the test passes when they are 13 frames apart (66.66 ms) and fails at 14 (83.32 ms).

- timestamp: 2026-10-14T00:12Z
  checked: baseline run, --repeat-each 10 desktop
  found: 1/10 failed, value 83.32400000072084 (Received 23.324). 14 x 16.666 - 150 = 83.324 exactly; frames are a perfect 16.666 ms clock (headless Chromium).
  implication: not jitter: the mover's startTime resolves exactly one frame later in the failing run (14 frames after the card's start instead of 13). The card ends at 210 ms = 12.6 frames, so frame 13 is the first frame where it is finished.

- timestamp: 2026-10-14T00:25Z
  checked: temporary probe spec (e2e/zz-probe-tmp.spec.ts, not committed) wrapping Element.prototype.animate, logging ready/finished, transitionrun/animationstart, every new document.getAnimations() entry and every rAF, 20 runs
  found: 17/20 frames=13 (gap 66.658), 3/20 frames=14 (gap 83.324). In BOTH cases the card's finished promise resolves at the start of frame +13 (before rAF callbacks), mover.animate()/facing.animate() are called 4-7 ms later in the same microtask burst, still before rAF of that frame, and at rAF time they are pending with startTime null. No CSS transition/animation or other Element.animate starts near them. Passing: start = that frame's time. Failing: start = next frame's time (e.g. animate at tl 802.8, start 819.434).
  implication: the Director chain (finished -> onDone -> settled -> drain -> hop) is not where the frame is lost: the knight's animation is created in the right frame every time. The extra frame comes from when the browser resolves a pending play's start time. Candidates: (a) compositor-started animation (start time sent back from the impl thread, depends on whether the commit makes the current impl frame), (b) frame N lifecycle not reaching PendingAnimations::Update.

- timestamp: 2026-10-14T00:40Z
  checked: E2 probe with a 14 ms busy-wait right before mover.animate() (more main-thread work in frame N), 2 x 20 runs
  found: 39/40 frames=14, 1/40 frames=15 (always late)
  implication: the slip is caused by main-thread load in the frame the knight is started in; the baseline 10-30 % failures are the runs where frame N's work (card node removed, felt shows the card, flushSync raise of the knight, style/paint) runs past the frame deadline.

- timestamp: 2026-10-14T00:45Z
  checked: E1 probe with Chromium 141 flag --disable-threaded-animation, 20 runs; then the same flag with the 14 ms busy-wait, 20 runs
  found: 20/20 frames=13 in both; start times become the frame's (coarsened) timeline time (gap 66.6-66.8) instead of the unrounded compositor monotonic time (66.658) seen in baseline passing runs
  implication: the knight's transform animations on the SVG <g> run on the compositor; a pending play gets its start time from the impl frame that activates the commit carrying it (frame N if the commit makes it, N+1 otherwise). With main-thread animations the start is the frame clock regardless of load. Mechanism confirmed; (b) eliminated.

- timestamp: 2026-10-14T00:50Z
  checked: candidate fix simulated in the probe: animation.startTime = document.timeline.currentTime right after Element.animate(), with and without the 14 ms busy-wait, 2 x 20 runs (threaded animation on)
  found: 40/40 frames=13 (gap 66.6-66.8), including all 20 runs under load
  implication: anchoring the start time to the frame clock at the moment the Director starts the motion removes the dependency on commit timing.

- timestamp: 2026-10-14T12:40Z
  checked: new e2e regression « une image chargée au départ du cheval ne le retarde pas » (heavyKnightStart: 20 ms busy-wait when a mover animation is started), before the fix, desktop + phone x5
  found: 10/10 failed (83.324 x8, 99.99 x2)
  implication: the regression reproduces the defect deterministically (RED)

- timestamp: 2026-10-14T12:55Z
  checked: with the fix (animateNow in animator.ts, cardFx.ts runFlight, Particles.svelte)
  found: regression 20/20 (desktop + phone x10); target test animations.spec.ts:782 desktop 30/30; full animations.spec.ts both projects 52/52; pnpm typecheck 0 errors; pnpm lint clean; pnpm test 36 files, 727 passed / 2 skipped
  implication: GREEN, no neighbour broken in the animation suite

- timestamp: 2026-10-14T13:05Z
  checked: revert-and-reconfirm: git stash of animator.ts, cardFx.ts, Particles.svelte (tests kept), 782 + regression x10 desktop; then stash pop
  found: reverted: 11/20 failed (all 10 regression runs + at least 1 of the 782 runs; 83.324 / 99.99); reapplied: back to the fixed state (counts above)
  implication: this change is what fixes it

- timestamp: 2026-10-14T13:07Z
  checked: manual mutant at the fix site (Stryker not installed): `if (now !== null)` -> `if (now === null)` in frameClock.ts
  found: frameClock.test.ts "starts the animation at the current time of its timeline" fails; restored -> 2/2 pass
  implication: the unit test bites on the fix line; the e2e regression bites on the revert

- timestamp: 2026-10-14T13:25Z
  checked: full e2e suite, both projects, with the fix
  found: 282 passed, 44 skipped (pre-existing project-conditional test.skip on isMobile), 0 failed, 5.3 min
  implication: no adjacent regression outside the animation suite

## Resolution

root_cause: "The Director's motions were Web Animations left with a pending play. Chromium runs transform/opacity animations of the SVG groups on the compositor and resolves a pending play's start time from the impl frame that activates the commit carrying it. In the frame where the card has landed and the knight is started, the main thread also takes the card off, draws it on the felt and raises the knight (flushSync, style, paint); when that work misses the frame deadline, the commit lands one frame later and the knight's startTime is the next frame: its 60 ms lead (shared with the audio, t0 = now + LEAD) becomes 60 ms + 1 frame. AND-gate: pending start (code) AND a heavy frame under threaded animation (environment)."
fix: "New apps/web/src/board/frameClock.ts animateNow(target, keyframes, options): Element.animate() then animation.startTime = animation.timeline.currentTime (the frame clock), left pending only when the timeline has no time. Every Director-led motion goes through it: all 21 knight animations in animator.ts, the card flights (cardFx.ts runFlight) and the party particles (Particles.svelte), so the animations of one step stay on one clock. Regression: e2e « une image chargée au départ du cheval ne le retarde pas » (20 ms heavier frame when the knight starts) + unit test frameClock.test.ts."
verification:
  target_test:        { result: pass, detail: "animations.spec.ts:782 desktop 30/30 (baseline 1/10 and 3/20 failing); new heavy-frame regression 20/20 (10/10 failing before)" }
  mutation_check:     { result: pass, reason_if_skipped: "Stryker not installed: manual mutant instead", mutant_killed: "if (now !== null) -> if (now === null) killed by frameClock.test.ts; revert of the call sites killed by the e2e regression (10/10)" }
  no_op_deletion:     { result: pass, deletion_justified_by_rca: n/a (additive: start time pinned, no branch removed) }
  adjacent_tests:     { result: pass, suites_run: ["e2e/animations.spec.ts both projects 52/52", "pnpm test 727 passed", "pnpm typecheck", "pnpm lint", "full e2e both projects: 282 passed, 44 skipped (pre-existing isMobile skips), 0 failed"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  oracle_type: specified (the Director's contract: the knight starts LEAD after the card has landed, picture and audio share t0 = now + LEAD)
  guardrail_verdict:  accepted
files_changed: [apps/web/src/board/frameClock.ts, apps/web/src/board/frameClock.test.ts, apps/web/src/board/animator.ts, apps/web/src/board/cardFx.ts, apps/web/src/board/Particles.svelte, apps/web/e2e/animations.spec.ts]
