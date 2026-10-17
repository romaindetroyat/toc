---
phase: 02-jouer-en-ligne-entre-proches
plan: 04b
type: execute
wave: 5
depends_on: ["02-04"]
autonomous: true
gap_closure: false
files_modified:
  - assets/logo/logo-source.webp
  - tools/build-icons.mjs
  - apps/web/public/icons/
  - apps/web/public/favicon.ico
  - apps/web/public/manifest.webmanifest
  - apps/web/src/assets/logo/logo-128.webp
  - apps/web/index.html
  - apps/web/src/routes/Home.svelte
  - apps/web/src/i18n/fr/credits.ts
  - assets/audio/LICENSES.md
  - apps/web/src/licences/licences.test.ts
  - apps/web/e2e/logo.spec.ts
requirements: []
---

# Plan 02-04b: Romain's logo as app icon and on the home

<objective>
Romain sent an image on 2026-10-17 with the words « Utilise cette image comme logo » (square
illustration: wooden board with the four horse pawns and a fan of cards R♦ D♣ 7♠ A♥ on a blue
background). Make it the app's icon (favicon, Apple touch icon, PWA manifest icons with a maskable
variant) and show it at a modest size beside « TOC » on the home (02-04), without changing the home's
fit at 844 × 390, 750 × 342, 480 × 320 and 1280 × 800. No service worker in this plan.
</objective>

<context>
- 02-UI-SPEC « Home « Accueil » » layouts: compact « TOC » row is 34 high (two columns: 24 px free at
  750 × 342); computer header has 346 px free at 1280 × 800.
- Licence register: assets/audio/LICENSES.md (read by the « Crédits et licences » sheet); its test
  checks that every file under apps/web/src/assets is covered.
- Embedded deploy: wrangler.embarque.jsonc already has Data rules for png/webp/ico and Text for
  webmanifest; worker-embedded/index.js already maps their content types.
- sharp 0.35.5 is already a root dev dependency (tools/build-knights.mjs); ImageMagick `convert` is
  installed for the .ico. No new dependency.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Source, icon generator, icons, manifest and links, licence row</name>
  <files>assets/logo/logo-source.webp, tools/build-icons.mjs, apps/web/public/icons/*, apps/web/public/favicon.ico, apps/web/public/manifest.webmanifest, apps/web/src/assets/logo/logo-128.webp, apps/web/index.html, assets/audio/LICENSES.md, apps/web/src/i18n/fr/credits.ts, apps/web/src/licences/licences.test.ts</files>
  <action>
  Keep the original at assets/logo/logo-source.webp (never modified). tools/build-icons.mjs (sharp)
  writes: public/icons/icon-32.png, icon-48.png, apple-touch-icon.png (180), icon-192.png,
  icon-512.png, maskable-512.png (the board at 64 % with rounded corners on a blue gradient matching
  the source's background, so a circle mask keeps the whole board), favicon.ico (16/32/48 via
  ImageMagick from the PNGs), and src/assets/logo/logo-128.webp for the home. Palette PNG to keep
  sizes small. Add manifest.webmanifest (name and short_name « TOC », lang fr, display standalone,
  start_url and scope « / », background and theme #2B1D12 = --noyer, the 192/512 icons and the
  maskable one) and the links in index.html. Licence row `logo` (type `logo`, « Logo fourni par
  Romain, 2026-10-17 ») covering the three locations; group « Logo » and name in credits.ts; extend
  the bundled-files coverage test to apps/web/public/icons.
  </action>
  <verify><automated>pnpm test -- apps/web/src/licences && node tools/build-icons.mjs && git diff --exit-code apps/web/public apps/web/src/assets</automated></verify>
  <done>Icons and manifest exist, are linked from index.html, and the register covers them.</done>
</task>

<task type="auto">
  <name>Task 2: Logo beside « TOC » on the home, e2e, embedded check</name>
  <files>apps/web/src/routes/Home.svelte, apps/web/e2e/logo.spec.ts</files>
  <action>
  Decorative `<img alt="">` of logo-128.webp before the « TOC » title in each layout: 34 × 34 in
  the compact layouts (the title row's height, so no fit change), 64 × 64 beside the title and
  tagline on the computer and in portrait; rounded corners clip the blue square. e2e
  apps/web/e2e/logo.spec.ts: the icon, apple-touch-icon and manifest links and every manifest icon
  answer 200 with an image/manifest type, the home logo is loaded and visible, and no layout of the
  UI-SPEC sizes scrolls where it did not before. Rebuild the embedded bundle, dry-run
  wrangler.embarque.jsonc and run tools/check-bundle.mjs.
  </action>
  <verify><automated>pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @toc/web exec playwright test e2e/logo.spec.ts e2e/accueil.spec.ts e2e/launch.spec.ts</automated></verify>
  <done>Logo visible on the home at the four sizes without regressions; embedded bundle check passes.</done>
</task>

</tasks>

<verification>
pnpm typecheck && pnpm lint && pnpm test green; Playwright logo, accueil, launch specs 0 failed;
screenshots of the home at 844 × 390 and 1280 × 800 looked at.
</verification>
