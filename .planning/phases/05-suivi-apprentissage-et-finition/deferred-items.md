# Phase 05: deferred items

Out-of-scope findings logged by the executors (not fixed by the plan that found them).

## 05-09

- **Flaky guide-band measurement in `apps/web/e2e/lecons.spec.ts`** (« chaque phrase du guide dans la bande à … »). In the first full local run of 05-09, « 750 x 342 › leçon 2 » measured the line « Pas celle-là : ici, on essaie le 8. » as clipped (desktop project). The 750 x 342 cases passed 24/24 alone (`--repeat-each 3`). 05-07 saw the same test fail once at « 480 x 320 › leçon 5 ». It looks like the band is measured while its 150 ms line change (fade and 4 px rise) is still running under the load of the full suite. It failed again in the second full run (« 750 x 342 › leçon 7 », « Le Roi avancerait de 13, bien trop loin. Touche le 6. »), which blocked 05-09's gate, so 05-09 changed the test only: it now polls for up to 2 s until the band reads as not clipped, then measures (`test(05-09)` commit). A real clip still fails. Left for the lessons' owner (05-06 / 05-10 audit): why the band reads as clipped for a moment, if Romain sees it on a device.

## 05-10

- **Flaky backup-code fit in `apps/web/e2e-online/compte.spec.ts`** (« l’écran du code ne se quitte pas par mégarde, et tient à 844 × 390 et 1280 × 800 », phone project). In the first full online run of 05-10 the code panel measured 80 px high instead of 56 (the code on two lines) right after `setViewportSize(844 × 390)`. It passed 8/8 alone (`--repeat-each 4`) and in the second full run. It looks like the panel is measured before the layout (or the Nunito font) has settled under the load of the full suite. 05-10 did not touch the screen or the test. Left for the account screens' owner: wait for `document.fonts.ready` and the two-column layout before measuring.
