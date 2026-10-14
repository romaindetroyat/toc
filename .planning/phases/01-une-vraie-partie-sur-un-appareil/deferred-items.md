# Deferred items (phase 01)

Out-of-scope discoveries logged by executors. They are not fixed by the plan that found them.

## Found during 01-28

- **Flaky timing test, pre-existing:** `e2e/animations.spec.ts:782` « Réduire les animations : une carte jouée se fond en 150 ms, le cheval glisse en 180 ms… » (desktop project) sometimes fails on `near(mover.begins - card.ends, LEAD, 12)`, always with the same value `23.324` (about one frame more than the ±12 ms tolerance). It also fails with the component files of 09fc1c3, before plan 01-28: 2 of 6 runs on its own. With 01-28 it fails 2 of 8 runs on its own, and it failed in both full-suite runs. The test was not changed or relaxed. Suggested fix, later: find why the knight's slide sometimes starts one frame late under reduced motion, or measure from the frame in which the card fade ends.
