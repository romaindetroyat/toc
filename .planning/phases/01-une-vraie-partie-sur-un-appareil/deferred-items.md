# Deferred items (phase 01)

Out-of-scope discoveries logged by executors. They are not fixed by the plan that found them.

## Found during 01-28

- **Flaky timing test, pre-existing:** `e2e/animations.spec.ts:782` « Réduire les animations : une carte jouée se fond en 150 ms, le cheval glisse en 180 ms… » (desktop project) sometimes fails on `near(mover.begins - card.ends, LEAD, 12)`, always with the same value `23.324` (about one frame more than the ±12 ms tolerance). It also fails with the component files of 09fc1c3, before plan 01-28: 2 of 6 runs on its own. With 01-28 it fails 2 of 8 runs on its own, and it failed in both full-suite runs. The test was not changed or relaxed. Suggested fix, later: find why the knight's slide sometimes starts one frame late under reduced motion, or measure from the frame in which the card fade ends.
  - **Fixed in e0479d5** (debug session `.planning/debug/reduced-motion-slide-late.md`). Root cause: the knight's Web Animations were left with a pending play, and Chromium, which runs these transform/opacity animations on the compositor, gives them as start time the frame in which the compositor picks up their commit. When the main-thread work of the frame in which the card lands (card taken off, felt drawn, knight raised) missed the frame deadline, the knight started one frame later: 14 frames after the card instead of 13 (83.324 ms instead of 66.658). The Director's chaining on the card's `finished` was right every time. Fix: `animateNow()` (`apps/web/src/board/frameClock.ts`) sets every Director-led animation's start time to the frame clock when it is created (knights, card flights, party particles). Test unchanged, tolerance unchanged; a new deterministic regression makes the knight's start frame 20 ms heavier (10/10 failures before, 20/20 passes after). After the fix: `:782` 30/30 on desktop, `animations.spec.ts` 52/52 on both projects, full e2e 282 passed / 44 skipped (project-conditional skips).

## Found during 01-41

- **Stale comments in the app, comment-only (01-41 forbids app changes):** three doc comments still describe the seat index k as a turn of the board, which no longer turns since the galet (01-32 to 01-40). No behaviour is involved, and no verify grep matches them.
  - `apps/web/src/game/session.svelte.ts:51` « Clockwise quarter turns of the board toward the human (D-05). » on `Session.k`;
  - `apps/web/src/game/director.ts:122` « Clockwise quarter turns of the board toward the human (D-05): hop points are screen anchors. » on `quarterTurns`;
  - `apps/web/src/board/geometry.ts:30` « … after the board rotation » in the doc of `facingFor`.
  Suggested wording, later: « The human's seat index k (quarterTurnsFor): which colour sits at the bottom of the galet », as FeltTable.svelte and Overlay.svelte already say.
  - **Fixed in 01-54:** the three comments now say « The human's seat index (quarterTurnsFor): which colour sits at the bottom of the galet » (session.svelte.ts on `Session.k`, director.ts on `quarterTurns`), and the doc of `facingFor` (geometry.ts) speaks of the galet as the human sees it, which never turns. Comment-only, no behaviour change.
- **01-UI-SPEC.md, addendum « Plateau galet », not in 01-41's files:** item 2 still writes `sceneXY(place, k, layout)` (the layout parameter left in 01-40), and « Faits techniques » still describes the portrait scene (2000 × 3000) as kept in the code « pour l'instant » (removed in 01-40).

## Found during 01-43

- **Rule pictures ring pawns, not moves:** tools/render-scenarios.mjs draws one halo per pawn, and an allowed move overrides a refused one on the same pawn (lines 234-235). In R-13.23 every knight of a refused 7 plan also moves in an allowed plan, so the picture shows bleu A and bleu B ringed in green and no red ring; R-13.22 rings bleu A once for both the 2 and the 9. The text of R-13 says which plans are refused. Drawing per-move halos (or the landing cell) would change the renderer and so could alter the 112 earlier pictures, which 01-43 must keep byte-identical.

## Deferred by Romain (2026-10-15)

- **Plans 01-52 and 01-53 are not executed.** Romain wrote on 2026-10-15, after 01-51 was built: « OK, continue, laisse les sons de côté sauf les sabots des chevaux, et montre moi quand c'est prêt. » So:
  - 01-52 (the neighs in three or four versions) is deferred: the neighs keep their single version « A » (today's synthesis);
  - 01-53 (the card sounds in three or four versions, and the new « Victoire » and « Défaite » sounds at the end of a game) is deferred: the card sounds keep their single version « A », and no « Victoire » or « Défaite » sound is added;
  - the hooves (01-51) are kept: four versions A–D on `#/sons`, his choice heard in his games, « Copier mes choix » to send it.
  - ROADMAP.md marks both plans « reporté le 2026-10-15 ». 01-CONTEXT.md (« Recette 3 de Romain ») and 01-UAT.md (notes on tests 31, 37, 38 and 42) record the deferral. Gap G-01-29 stays open for the neighs, the card sounds and the end-of-game sounds, for a later phase or when Romain asks for them again.
