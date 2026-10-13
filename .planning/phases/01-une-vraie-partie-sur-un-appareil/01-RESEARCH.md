# Phase 1: Une vraie partie sur un appareil - Research

**Researched:** 2026-10-13
**Domain:** Pure TypeScript card/board rules engine + Svelte 5 SVG game client with WAAPI animation and Web Audio, local single-device game vs 3 random bots
**Confidence:** MEDIUM-HIGH (HIGH on stack, geometry, test tooling and timeline: all executed in this container. MEDIUM on rules edge cases (need Romain), LOW on CC0 neigh availability and iOS audio (cannot be checked from this container))

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Règles : précision apportée pendant la discussion (remplace la formulation de RULE-15)
- **D-01 :** Pour entrer dans sa maison, il faut le **compte exact jusqu'à une case vide** de la maison. Atteindre le carré 16 ne suffit pas.
  - Si le compte ne tombe pas juste, ou si la case visée est occupée, le cheval n'entre pas.
  - Le cheval dépasse alors sa case d'entrée, continue sur le parcours et repart pour un tour supplémentaire. Ce mouvement est légal.
  - **Reversibility:** costly — modèle de progression des pions et générateur de coups.
- **D-02 :** Quand le compte permet d'entrer pile sur une case vide, l'entrée est **obligatoire**. Le cheval ne peut pas choisir de refaire un tour.
- **D-03 :** Un cheval déjà rentré **peut encore avancer dans sa maison**, au compte exact et sans sauter un autre cheval. Une carte peut donc servir à avancer un pion à l'intérieur de la maison.
- **D-04 :** Rappel des décisions déjà validées (PROJECT.md, « Rule Decisions ») :
  - sens horaire ;
  - entrée par le carré 16 ;
  - losange 18 infranchissable seulement pour le pion de sa couleur ;
  - le 4 peut reculer depuis la sortie, mais jamais pour entrer dans la maison ;
  - tour complet obligatoire ;
  - le 7 dépasse ses propres pions et se joue en entier ou pas du tout ;
  - échange de carte à chaque donne ;
  - le Valet n'échange pas deux pions du même joueur.

  Les autres cas limites (SUMMARY.md, questions 5 à 34) prennent la valeur par défaut de la recherche, à faire valider par Romain dans RULES.md.

#### Écran et plateau
- **D-05 :** Le plateau **tourne pour que la couleur du joueur humain soit en bas**, face à lui. On tourne l'ensemble par quarts de tour, l'illustration n'est pas modifiée.
  - Dans l'illustration d'origine, chaque aide-mémoire est écrit pour un joueur assis de son côté : bleu en bas, jaune à gauche, rouge en haut, vert à droite.
  - Les partenaires sont donc face à face : bleu et rouge, jaune et vert.
  - **Reversibility:** reversible.
- **D-06 :** En solo, le joueur **choisit sa couleur avant la partie**, ce qui fixe aussi son partenaire. Il faut donc un petit écran de lancement : choix de la couleur, puis « Jouer ».
- **D-07 :** Sur téléphone en portrait :
  - le plateau carré occupe toute la largeur en haut de l'écran ;
  - la main du joueur est affichée en éventail dessous ;
  - un bandeau fin indique à qui c'est le tour, le donneur et les équipes.

  Sur grand écran, même logique avec plus d'espace.
- **D-08 :** Le carré vert central sert de **tapis de jeu**.
  - La dernière carte jouée par chacun y est posée devant sa place, comme à une vraie table.
  - Le talon et la défausse y sont aussi.
  - Une main injouable y est posée face visible.

#### Cavaliers et animations
- **D-09 :** Les pions sont des **cavaliers d'échecs de style Staunton en bois peint**.
  - Ils sont teintés à la couleur du joueur, avec un aspect mat et un léger veinage, pour s'accorder au plateau en bois.
  - Ils restent en « fausse 3D » : ombre portée, dégradés, reflet discret.
- **D-10 :** La tête du cheval **regarde dans le sens de la marche** et suit la direction locale du parcours. Elle fait volte-face quand le pion recule de 4.
- **D-11 :** Le cavalier avance par **petits bonds case par case**, avec un « clop » de sabot par bond.
  - Plus la distance est longue, plus le rythme accélère, jusqu'au galop.
  - Repère : 1 case ≈ 0,4 s et 13 cases (le Roi) ≈ 2 s au maximum. La courbe d'accélération est laissée au planner.
- **D-12 :** Pour une prise, l'attaquant **se cabre (ruade)**, puis le cheval mangé est **éjecté en arc jusqu'à son écurie**, avec un hennissement.
  - Avec le 7, chaque prise a lieu au moment où l'attaquant passe sur la case.
- **D-13 :** Pour l'échange au Valet, les deux cavaliers font **deux bonds en arc croisés** et atterrissent chacun à la place de l'autre.
- **D-14 :** Pour l'entrée dans la maison, l'animation reste sobre pour les 3 premiers chevaux d'un joueur. Pour le **4e, petite fête** : le cheval se cabre, un hennissement joyeux retentit, avec un effet visuel léger.
- **D-15 :** La sortie de l'écurie est un bond de l'écurie vers le losange 18, accompagné d'un hennissement.

#### Jouer un coup et rythme
- **D-16 :** Pour jouer, le joueur **touche une carte**, ce qui allume les chevaux jouables, puis **touche un cheval**.
  - L'aperçu du trajet et des chevaux qui seraient mangés s'affiche, puis un bouton **« Jouer »** confirme.
  - On ne joue pas en glissant la carte.
  - Avec l'As et le Roi, un choix « Sortir » ou « Avancer » est proposé quand les deux sont possibles.
- **D-17 :** Pour répartir le 7, le joueur procède **cheval par cheval** :
  - il touche un cheval et choisit un nombre de pas, entre 1 et le reste à jouer ;
  - l'aperçu se met à jour, avec les prises en chemin ;
  - il recommence jusqu'à ce que le reste soit 0, puis confirme une seule fois.

  Il faut pouvoir annuler une étape avant la confirmation.
- **D-18 :** Les ordinateurs jouent à un **rythme naturel**, avec environ 1 s de réflexion puis l'animation. Un bouton **« avance rapide »** raccourcit les temps de réflexion et les animations.
- **D-19 :** Le jeu ne joue **jamais un coup à la place du joueur**, même quand un seul coup est possible : ce coup est seulement mis en évidence.
- **D-20 :** Quand aucune carte n'est jouable :
  - un message explique qu'aucune carte n'est jouable ;
  - un bouton **« Poser mes cartes »** pose la main face visible sur le tapis ;
  - le joueur attend ensuite la donne suivante.
- **D-21 :** Pendant l'échange de carte avec le partenaire :
  - le joueur choisit la carte à passer et voit qui doit encore choisir ;
  - la **carte reçue est marquée** (entourée) dans sa main jusqu'à ce qu'il la joue.

#### Sons et cartes
- **D-22 :** Les bruitages viennent d'**enregistrements libres de droits (CC0)** quand on en trouve de bons, par exemple sur Freesound. Sinon, ils sont **générés par le code** (Web Audio).
  - La licence de chaque fichier est tracée dans un fichier dédié.
  - Romain valide l'ensemble à l'oreille : prévoir une page ou un écran de test des sons.
- **D-23 :** Le hennissement accompagne 4 moments : la **sortie d'écurie**, la **prise** (ruade de l'attaquant, plainte du mangé), l'**entrée dans la maison** (joyeux, fête au 4e) et l'**échange au Valet** (petit hennissement surpris).
  - Les sabots accompagnent chaque bond, au même rythme que l'animation.
  - Des sons de cartes accompagnent la donne, le jeu d'une carte et l'échange.
- **D-24 :** Les cartes reprennent un **jeu classique français** : figures traditionnelles comme sur l'aide-mémoire du plateau.
  - Il faut un visuel libre de droits, du domaine public ou sous licence CC0/CC-BY compatible, à faire valider.
  - Le dos des cartes est assorti au plateau.
- **D-25 :** Une **ambiance sonore légère** est jouée en fond (campagne ou écurie, discrète), avec son propre réglage de volume.
  - Elle se coupe séparément des bruitages. Le réglage global « couper le son » et le réglage « réduire les animations » (FX-06) restent disponibles.

### Claude's Discretion
- La courbe exacte d'accélération des bonds et la durée des prises et des fêtes, dans les repères D-11.
- Les détails graphiques du bandeau d'infos, de l'écran de lancement solo et de l'écran de fin de partie.
- La technique de dessin des cavaliers (SVG fait main, ou rendu à partir d'un modèle) et du veinage du bois.
- La manière d'annuler une étape du 7.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

Also locked (not in CONTEXT.md but approved): `01-UI-SPEC.md` (status: approved, 2026-10-13) is the visual and interaction contract; research below only adds what is needed to implement it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RULE-01 | 4 places, 2 equipes, partenaires face a face | Seat/colour/team constants (Standard Stack > Engine constants); topology verified by calibration |
| RULE-02 | 52 cartes, donnes 5/4/4, rebattage, donneur change | Deck/PRNG pattern (sfc32 + Fisher-Yates, seed from `crypto.getRandomValues` in shell); "first player per deal" gap G9 |
| RULE-03 | Echange d'une carte avec le partenaire a chaque donne | Exchange phase design (apply all 4 swaps when all 4 have chosen, matches UI-SPEC "cards cross"); gap G8 |
| RULE-04 | Tour a tour horaire, jouer est obligatoire | Turn state machine (Pattern 3) |
| RULE-05, RULE-06 | As / Roi : sortir ou avancer de 1 / 13 | Exit-square rules (protected pawn, capture on exit), `ExitAction` + `AdvanceAction`; PLAY-04 mode chooser |
| RULE-07 | Dame 12 ; 10,9,8,6,5,3,2 ; le 5 seulement ses pions | All number cards = "advance one controlled pawn"; gap G10 (confirm no card moves a non-own pawn) |
| RULE-08 | 4 recule, y compris depuis la sortie, jamais vers la maison | Signed unbounded `progress` model (Pattern 1) makes this structural |
| RULE-09 | Valet : echange pion perso / pion autre joueur, pas protege | Jack target filter; gap G1 (progress after swap) is the one real hole |
| RULE-10, RULE-11 | 7 reparti, mange ce qu'il depasse, entier ou rien | Seven planner (Pattern 2): ordered `(pawn, steps)` plan, lazy `nextSteps`, existence DFS (measured 1.2 ms); capture `atStep` events |
| RULE-12 | S'arreter sur un pion adverse/partenaire le mange | `path()` walker + capture resolution (Pattern 1) |
| RULE-13, RULE-14 | Sortie protegee ; sortie qui mange | Centralised `isProtected` / `blocksPath` predicates; scenario matrix (Rules section) |
| RULE-15 | Entree exacte dans la maison (D-01..D-03) | Home-entry resolution algorithm (Pattern 1b); gaps G2, G3 |
| RULE-16 | Main injouable posee face visible | Dead-hand state machine; `handDiscarded` event |
| RULE-17 | Joueur fini joue les pions du partenaire | `controlledPawns(seat)` (single concept); gap G7 |
| RULE-18 | Victoire a 8 pions | `gameWon` event, win check after every move |
| RULE-20 | RULES.md numerote valide par Romain, scenario par regle | RULES.md structure, scenario-as-data format, `rules-trace` script, human checkpoint ordering (Rules section) |
| PLAY-01..PLAY-05 | Cartes jouables en evidence, carte puis pion + apercu, assistant du 7, As/Roi, echange | Pure `TurnUi` reducer (Pattern 6), `previewMove` = `resolveMove` on a copy, `playability()` with reason codes |
| FX-01 | Plateau assemble, net en portrait et grand ecran | Build-time composite (880 KB / 238 KB / 64 KB measured), `<img srcset>` under SVG overlay (SVG `<image>` has no srcset) |
| FX-02 | Cavaliers fausse 3D, 4 couleurs | `<symbol>` + gradients + pre-baked shadow; draft rendered and checked at 17 px and 39 px (Appendix C) |
| FX-03, FX-04 | Animations par action ; duree suit la distance ; sabots meme cadence | One `hopTimes[]` timeline function drives WAAPI and audio (Pattern 4); curve table |
| FX-05 | Bruitages, licences tracees | Synthesis baseline validated in headless Chromium (Appendix D); `LICENSES.md` manifest; CC0 spike must run outside the container |
| FX-06 | Couper le son, reduire les animations | Settings store + reduced-motion branch in the same timeline module; fast mode min clop interval |
</phase_requirements>

## Summary

Phase 1 is a pure-TypeScript engine plus a Svelte 5 SPA, no server. Everything the phase needs was executed in this container: a pnpm workspace with a "just-in-time" `packages/engine` (no build step, no DOM lib) compiles, type-checks, tests (Vitest 4.1.11 + fast-check 4.10.2) and builds with Vite 8.3.4 + Svelte 5.57.2; Playwright 1.64.0 drives the preinstalled Chromium 141 through `executablePath`; `sharp` composites the four quarters in 2.4 s. Two stack facts differ from CLAUDE.md and must be applied at scaffold: **TypeScript 7.0.2 crashes `svelte-check` 4.7.6** (peer is `^5 || ^6`), so pin `typescript@6.0.3`; and Biome 2.5.15 lints `.svelte` files with false positives, so use it on `.ts` only and rely on `svelte-check` for Svelte.

The "LOW confidence" geometry blocker is resolved by measurement, not by a click-calibration tool: the four quarters are 90-degree rotated copies (max deviation 8.6 px of 1280), and a 0.76 s Node script using `sharp` + connected components finds all 72 ring cells, the 16 stables, the 16 home cells, the four diamonds and the four entry squares automatically, and passes the topology invariants (diamonds at ring index 0/18/36/54, entry squares at 70/16/34/52, pitch 122.7..144.8). The script and the measured numbers are in Appendices A and B. Remaining risk is visual review only (the `?debug=geometry` overlay).

The real risks are rules, not infrastructure. Research found one genuine hole beyond SUMMARY questions 5-34: **what `progress` a pawn gets after a Valet swap** (G1, decides whether the "tour complet" can be shortcut). It and nine other gaps (G2-G10) must be in RULES.md for Romain. Audio is the second risk: no CC0 neigh could be confirmed (freesound.org, opengameart.org and github.com are blocked by the container proxy, 403), so the plan must make **synthesis the shipped baseline** (validated here: it renders in 2 ms for a hoof, plausible rising/falling harmonic contour for a neigh) and treat recordings as an optional A/B upgrade that Romain can bring. iOS audio (silent switch, unlock) can only be proven on a real iPhone.

**Primary recommendation:** Scaffold the workspace with TS 6.0.3, ship a tracer slice first (board + calibrated layout + one knight hopping with synthesized clops, unlocked by the "Jouer la partie" tap), run RULES.md drafting and the UI/audio primitives in parallel, gate every engine task behind Romain's RULES.md validation, and make scenarios declarative data so the same fixtures feed RULES.md pictures, engine tests and a dev scenario viewer.

## Project Constraints (from CLAUDE.md)

Source: `/home/user/toc/.claude/CLAUDE.md` (read this session).

- Hosting is Cloudflare (Workers/DO/D1): **not used in Phase 1**, but the engine must stay deployable in a DO unchanged.
- PWA, equally good on phone and desktop. Graphics: reuse the board, **never redraw it**. Sounds: CC0 or generated by code. UI language: French.
- Stack pins that apply here: Svelte 5.57.2, Vite 8.3.4, @sveltejs/vite-plugin-svelte 7.3.1, Vitest **pinned `^4.1` (NOT 5.x)**, fast-check 4.10.2, Playwright 1.64.0, Biome 2.5.15, sharp 0.35.5 (dev only), svgo 4.1.0, Node 22.x, pnpm 10.x.
- CLAUDE.md says TypeScript 7.0.2 with fallback "pin 5.9/6.x for type-checking only if a tool lags": **a tool lags** (see State of the Art), so use 6.0.3.
- Forbidden / avoid: Three.js, `setTimeout` for DO timers (n/a here), Howler.js, SVG `filter: drop-shadow`/blur animated per frame, animating `cx/cy` attributes, trusting the client for rules (design for Phase 2), SSR/SvelteKit, `vitest@latest`.
- Animation: WAAPI on `<g>` transforms, honour `prefers-reduced-motion`, fast-forward/snap on `visibilitychange`. Audio: hand-rolled Web Audio on the audio clock, resume inside the first gesture, persistent mute in `localStorage` with try/catch.
- GSD enforcement: file changes go through a GSD command (the planner/executor handle this).

## Architectural Responsibility Map

Phase 1 has no server tier; the "tiers" are modules. The engine is deliberately placed where Phase 2 will move it (Backend).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rules, deck, deal, exchange, legal moves, 7 plans, events | `packages/engine` (pure, will run in the DO in Phase 2) | Browser (calls it in-process now) | Single source of truth; no I/O so Phase 2/3 reuse it unchanged |
| Hidden-hand projection (`viewFor`) | `packages/engine` | Browser | Cheap now, mandatory in Phase 2 (RULE-19); UI consumes views only |
| Local session loop (turn order, bot think delay) | Browser (`apps/web` game controller) | — | Replaced by the Durable Object in Phase 2; bots call the same engine API |
| Bot level 1 (random legal action) | `packages/bots` (tiny, pure) | Browser | Phase 3 extends it; must use the same generator as the validator |
| Hop timeline (durations, clop times) | `packages/board` (pure function) | Browser animation + audio | Phase 2 server needs `estimateDuration` for bot pacing; also unit-testable |
| Board art delivery | CDN / static assets (build-time composite) | Browser | Pre-sized webp variants chosen by `srcset` |
| Cell pixel geometry (`layout.json`) | `packages/board` data, generated by a tool | Browser SVG overlay | Re-measuring never touches rules code |
| Animation (WAAPI) and sound (Web Audio) | Browser | — | Pure presentation, driven only by engine events |
| Settings, last colour, sound notes | Browser `localStorage` (try/catch) | — | No backend in Phase 1 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | **6.0.3** (not 7.0.2) | Language | `svelte-check@4.7.6` peer is `^5.0.0 \|\| ^6.0.0` and crashes on 7.0.2 (reproduced) |
| Node.js | 22.22.0 (installed) | Runtime | Vite 8 / plugin-svelte 7 need `^20.19 \|\| ^22.12 \|\| >=24` |
| pnpm | 10.34.7 target (container has 10.28.0, works) | Workspace | Set `packageManager` in root `package.json` |
| Vite | 8.3.4 | Dev server / bundler | Build verified in a scratch project |
| Svelte | 5.57.2 | UI | Runes; `$state.raw` for immutable engine views |
| @sveltejs/vite-plugin-svelte | 7.3.1 | Svelte compile | Needs Vite 8 |
| Vitest | **4.1.11** (pin `^4.1`) | Unit/property/scenario tests | Phase 2 pool-workers needs 4.x; latest on npm is 5.0.4 |
| fast-check | 4.10.2 | Property tests | 52-card conservation, 7 sums, determinism, termination |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @playwright/test | 1.64.0 | E2E at 3 viewports, reduced motion, hit-area measurement | Use the preinstalled Chromium via `CHROMIUM_PATH` (see Verification Tooling) |
| svelte-check | 4.7.6 | Type-check `.svelte` | CI; requires TS 5/6 |
| @biomejs/biome | 2.5.15 | Lint + format `.ts` | Exclude `.svelte` from lint (false "unused variable" on template usage, reproduced) |
| sharp | 0.35.5 (dev) | Board composite + srcset variants, calibration decode | Build/tooling only |
| svgo | 4.1.0 (dev) | Optimise the knight symbol | Optional |
| @fontsource-variable/nunito, @fontsource-variable/caveat | 5.3.0 `[ASSUMED]` name | Self-hosted OFL fonts (`latin` + `latin-ext` woff2) | Copy the two woff2 files per family into the app; ship the OFL text |
| lucide-static | 1.56.0 `[ASSUMED]` name | Source of the 12 icon SVGs (ISC) | Copy individual `icons/*.svg` paths at build/dev time, no runtime package |
| ffmpeg (system) | present | Encode any recorded sample to `.mp3` (+ `.m4a`) | Only if recordings are adopted |

Not needed in Phase 1: zod (hand-written `parseSettings` is ~10 lines; Zod arrives with `packages/protocol` in Phase 2), partysocket, Hono, Wrangler, workbox, vite-plugin-pwa, motion (WAAPI is enough), Howler, Tone.js.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TS 6.0.3 | TS 7.0.2 with `typescript@~6` + `@typescript/native@npm:typescript@7` and `svelte-check --tsgo` | svelte-check's own error message prescribes this; extra moving parts, no benefit at this size |
| Calibration by detection | Click tool (`tools/calibrate-board`) | Detection is deterministic and re-runnable (0.76 s); a click/nudge UI is only needed if the art changes shape |
| m4a primary + mp3 fallback (UI-SPEC) | mp3 only | Container Chromium cannot decode AAC (verified), so e2e exercises the mp3 path; mp3-only is simpler but loops get a priming gap |
| HTML `<img srcset>` under the SVG | `<image>` inside the SVG | SVG `<image>` has no `srcset`; choose href in JS from `devicePixelRatio` if the art must live inside the SVG |

**Installation (root + workspaces):**
```bash
pnpm add -Dw typescript@6.0.3 vitest@^4.1.11 fast-check@4.10.2 @biomejs/biome@2.5.15 @playwright/test@1.64.0 sharp@0.35.5 @types/node@22
pnpm --filter @toc/web add -D vite@8.3.4 svelte@5.57.2 @sveltejs/vite-plugin-svelte@7.3.1 svelte-check@4.7.6
pnpm --filter @toc/web add @fontsource-variable/nunito@5.3.0 @fontsource-variable/caveat@5.3.0   # or copy the woff2 files
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

**Version verification (this session, `npm view`, registry reachable):** typescript 7.0.2 latest / 6.0.3 / 5.9.3; vite 8.3.4; svelte 5.57.2; @sveltejs/vite-plugin-svelte 7.3.1; vitest latest 5.0.4, 4.1.11 is the newest 4.x; fast-check 4.10.2; @playwright/test 1.64.0 (modified 2026-10-13); @biomejs/biome 2.5.15; svelte-check 4.7.6; sharp 0.35.5; svgo 4.1.0; zod 4.6.7; pnpm 12.11.2 latest / 10.34.7 newest 10.x; lucide-static 1.56.0; @fontsource-variable/nunito and /caveat 5.3.0. All CLAUDE.md versions used in this phase resolve. [VERIFIED: npm registry]

## Package Legitimacy Audit

`gsd_run query package-legitimacy check` returned **SUS for every package**, with only two reasons: `too-new` (the *latest version* was published within days, e.g. vite 8.3.4 on 2026-10-08, vitest 2026-10-12) and `unknown-downloads` (the download-stats API is not reachable through the sandbox proxy). These are artefacts of the environment, not of the packages: each has a first-publish date between 2012 and 2023, a GitHub source repo, and **no `postinstall`/`install` script** (checked with `npm view <pkg> scripts.postinstall scripts.install`, all empty).

| Package | Registry | Age (first publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|-----------|-------------|---------|-------------|
| svelte | npm | 2016 | n/a (proxy) | github.com/sveltejs/svelte | SUS (too-new, unknown-downloads) | Approved (CLAUDE.md stack) |
| vite | npm | 2020 | n/a | github.com/vitejs/vite | SUS (same) | Approved |
| @sveltejs/vite-plugin-svelte | npm | n/a | n/a | github.com/sveltejs/vite-plugin-svelte | SUS (same) | Approved |
| vitest | npm | 2021 | n/a | github.com/vitest-dev/vitest | SUS (same) | Approved, pin ^4.1 |
| fast-check | npm | 2017 | n/a | github.com/dubzzz/fast-check | SUS (same) | Approved |
| @playwright/test | npm | 2020 | n/a | microsoft/playwright | SUS (same) | Approved |
| @biomejs/biome | npm | 2023 | n/a | biomejs/biome | SUS (same) | Approved |
| svelte-check | npm | 2020 | n/a | sveltejs/language-tools | SUS (unknown-downloads) | Approved |
| sharp | npm | 2013 | n/a | lovell/sharp | SUS (same) | Approved (dev only) |
| svgo | npm | 2012 | n/a | svg/svgo | SUS (unknown-downloads) | Approved (dev only) |
| typescript | npm | 2012 | n/a | microsoft/TypeScript | SUS (unknown-downloads) | Approved, 6.0.3 |
| zod | npm | 2020 | n/a | colinhacks/zod | SUS (same) | Not needed in Phase 1 |
| @fontsource-variable/nunito | npm | 2023 | n/a | fontsource/font-files | SUS (unknown-downloads) | `[ASSUMED]` name (from training), license OFL-1.1 read from registry; planner gates via the single checkpoint below |
| @fontsource-variable/caveat | npm | 2023 | n/a | fontsource/font-files | SUS (unknown-downloads) | `[ASSUMED]` name, OFL-1.1 |
| lucide-static | npm | n/a | n/a | lucide-icons | not run | `[ASSUMED]` name; ISC; 12 required icons all present (checked in the tarball) |

**Packages removed due to SLOP verdict:** none.
**Packages flagged SUS:** all of the above. Recommendation: do **not** add 15 separate checkpoints. Add **one** `checkpoint:human-verify` at scaffold time: "the committed `pnpm-lock.yaml` contains only the packages in this table (plus their transitive deps) and no install scripts run" (`pnpm` 10 blocks dependency build scripts by default; sharp and esbuild need an explicit `pnpm.onlyBuiltDependencies` entry only if their binaries are not fetched as optional deps; they installed and ran here without it).
**Tagging note:** names in the first twelve rows come from CLAUDE.md (project-approved, earlier registry check). The three `[ASSUMED]` names came from training knowledge; registry existence plus license read does not upgrade them under the provenance rule.

## Architecture Patterns

### System Architecture Diagram

```
 launch screen (#/)                     "Jouer la partie" tap  ──►  AudioEngine.unlock()  (gesture)
   colour tile ─► settings                                   │
                                                             ▼
 ┌───────────────────────────── apps/web (browser) ─────────────────────────────┐
 │  GameController (local session)                                               │
 │    seed ◄─ crypto.getRandomValues(4×u32)                                      │
 │    state: GameState (full, JSON)  ──viewFor(seat)──►  PlayerView ($state.raw)│
 │       ▲                                    │                                  │
 │       │ apply(action)                      ▼                                  │
 │  bot turn: think delay 700-1300 ms   TurnUi reducer (pure) ◄── taps           │
 │   └─ L1: randomLegal(view)           card → pawn → preview → confirm          │
 │       │      human: Action ───────────────┘   (preview = resolveMove on copy) │
 │       ▼                                                                       │
 │   events[]  ──────────────► Director queue ──► renderReduce(renderState, ev)  │
 │                               │   │                                           │
 │            hopTimeline(n,mode)│   └─► Animator (WAAPI on <g>)  ─► Board SVG   │
 │                               └─────► AudioEngine.schedule(clops on audio clock)
 │  input locked until Director idle;  visibilitychange → snap renderState = view │
 └───────────────────────────────────────────────────────────────────────────────┘
        packages/engine (pure)      packages/board (layout.json, rotate, hopTimeline)
        packages/bots (L1)          tools/calibrate-board, tools/rules-trace
```

### Recommended Project Structure
```
toc/
├── package.json, pnpm-workspace.yaml, tsconfig.base.json, biome.json   # packageManager pnpm@10.34.7
├── RULES.md                         # French, numbered, validated by Romain (RULE-20)
├── assets/
│   ├── plateau/quart-*.webp         # sources, untouched
│   └── audio/LICENSES.md            # one row per file / per synthesised sound / font / icon / card art
├── packages/
│   ├── engine/  (JIT package: "exports": {".": "./src/index.ts"}, tsconfig lib ES2022 only, types [])
│   │   ├── src/{types,topology,rng,deck,path,moves/,seven,legal,reducer,view,events,replay}.ts
│   │   └── test/{scenarios/,props/,purity.test.ts}
│   ├── board/   # layout.json (0..1), rotate.ts, hopTimeline.ts (pure) + tests
│   └── bots/    # randomLegal(view, seat, rng) only in Phase 1
├── apps/web/
│   ├── src/{game/,board/,audio/,ui/,i18n/fr.ts,settings/,routes/}
│   ├── public/ (plateau-{640,1280,2560}.webp generated, fonts)
│   └── e2e/ + playwright.config.ts
└── tools/{calibrate-board/calibrate.mjs, build-board.mjs, rules-trace.mjs}
```
`packages/engine` compiled with `lib: ["ES2022"]` and `types: []` makes `window`/`document` a type error (verified: `tsc` exit 2 on `window.innerWidth`), but `Math.random`, `Date.now`, `crypto` still type-check, so add `test/purity.test.ts` that greps `packages/engine/src` for `Math.random|Date.now|new Date|performance|crypto|setTimeout|setInterval|localStorage|fetch|node:` and fails.

### Pattern 1: Signed, unbounded `progress` per pawn (the model that makes the rules structural)
**What:** A pawn is `{zone:'stable'} | {zone:'ring', progress:number} | {zone:'home', slot:0..3}`. `ringIndex = (EXIT[color] + progress) mod 72`. `progress` counts steps since leaving the exit, may be negative (backward 4 from the exit) and is **not capped at 70**, because D-01 lets a pawn overshoot its entry and run another lap. Occupancy is derived from the pawn list (no second board array to desync).
**Entry square rule:** the entry cell is ring index `EXIT-2`, reached at `progress ≡ 70 (mod 72)` **and** `progress ≥ 70`. A pawn at `progress = -2` (after a backward 4 then forward) stands on the same cell but has not done the lap, so it cannot enter. Home slots are `slot 0..3`, slot 0 nearest the entry (measured: slot order is nearest-to-the-square, not the detection order).

**1b. Home entry resolution (D-01, D-02, D-03), per forward micro-move of `n` steps from `progress p`:**
```
walk q = p+1 … p+n (cell by cell; check blocksPath at each ring cell)
when q ≡ 70 (mod 72) and q ≥ 70 and r = (p+n) - q ≥ 1:
    if 1 ≤ r ≤ 4 and home slots 0..r-1 are all empty:   # exact count, empty target, no jumping a home pawn
        → pawn ends in home slot r-1                    # MANDATORY (D-02): there is no ring alternative for this count
    else (r ≥ 5, or target/path occupied):
        → continue on the ring (D-01), progress ends at p+n
if r == 0: pawn stands on the entry square (ring); that does not enter.
home pawn at slot s moving k: legal iff s+k ≤ 3 and slots s+1..s+k all empty (D-03); never leaves home.
```
`[ASSUMED]` generalisation: "blocked by a home pawn" behaves like "occupied" (pawn continues on the ring) rather than "illegal". D-01 only literally covers wrong count / occupied target. Listed as G2.

**When to use:** everywhere; one `path(pawn, steps, dir)` returns the ordered cells crossed and is used by legality, previews, the 7, captures, highlighting **and** animation (Pitfall 1 of PITFALLS.md).

### Pattern 2: The 7 as an ordered plan with lazy next-step generation
**What:** A 7 turn is an ordered list `[{pawn, steps}]` summing to exactly 7, applied in sequence on a cloned board. Because order matters (captures, protected pawns appearing/leaving), the UI builds it step by step; the engine answers `nextSteps(partialPlan) -> Map<pawn, number[]>` (only steps that can still complete to exactly 7) and `isComplete`.
**Measured sizes (this session):** with 4 controllable pawns the full ordered enumeration is 62 500 plans / 78 124 nodes (6.5 ms with no rule cost); with 8 pawns it would be 4.25 M, but a player never controls more than 4 movable pawns (own pawns, or the partner's once all own pawns are home and the home is full). The "can this partial plan still reach 7" existence DFS with memo on `(state hash, remaining)` measured 1.2 ms in the worst case (nothing completes). So: **existence DFS for playability and `nextSteps`; full enumeration only in tests and (Phase 3) bots with a cap.**
**Events:** one `pawnMoved` per micro-move; each mid-path capture is a `pawnCaptured{atStep}` where `atStep` indexes into that move's `path`, so the director fires the capture beat at the right hop without splitting the timeline (D-12).
**Property tests:** every plan produced by the (test-only) full generator is accepted by the validator and vice versa on boards with ≤3 movable pawns; plan sum is always 7; a plan is atomic (rejected plan leaves state untouched).

### Pattern 3: Deal state machine
`DEAL (5 | 4 | 4, cycle of 52) → EXCHANGE → PLAY(turnSeat) → DEAL_END`. `EXCHANGE` holds `chosen: Record<Seat, Card|null>`; **apply the four swaps in one step when the 4th choice arrives** and emit one `cardsExchanged` event (UI-SPEC: "When all have chosen, cards cross (300ms)", prompt shows who still has to choose). A turn starts by evaluating the hand: if no card is playable the player must `discardHand` (human via the « Poser mes cartes » button, D-20; bot automatically). A seat with an empty hand is skipped. `DEAL_END` when all four hands are empty. After deal 3 of the cycle: reshuffle, dealer rotates (G9). Win is checked after every move and preempts everything. `playability(view, seat)` returns per card `{playable:true}` or `{playable:false, reason}` using the UI-SPEC reason codes (below).

### Pattern 4: One timeline function drives animation and audio (FX-04)
`hopTimeline(n, mode)` is pure and lives in `packages/board`; it returns `total`, `hopDur` and the per-hop landing times and clop times. WAAPI and the audio scheduler both consume it, so cadence cannot drift from the visuals. Defaults from UI-SPEC: `total(n) = 400 + 133·(n − 1)` ms (verified quote: "total(n) = `400 + 133·(n − 1)` ms, per hop = total / n: 1 cell 400ms, 4 cells 800ms, 13 cells 2000ms (max)").

| n cells | total ms | ms per hop | clops (UI-SPEC cadence) | ×0.4 fast: total / hop |
|---------|----------|-----------|--------------------------|------------------------|
| 1 | 400 | 400 | 1 (pas) | 160 / 160 |
| 3 | 666 | 222 | 1 per hop | 266 / 89 |
| 4 | 799 | 200 | 1 per hop (trot) | 320 / 80 |
| 7 | 1198 | 171 | 1 per hop | 479 / 68 |
| 8 | 1331 | 166 | 2 per hop at 0 and 0.5 hop (galop) | 532 / 67 |
| 13 | 1996 | 154 | 2 per hop (77 ms apart) | 798 / 61 |

Computed from the formula in this session. **Fast mode gotcha:** at ×0.4 and n=13 the galop clops are ~30 ms apart (a buzz). Recommend a `MIN_CLOP_GAP_MS = 50` in the audio scheduler (drop the half-hop clops first), and cap polyphony with a voice pool (UI-SPEC already says steal oldest). Keep the cadence table as a single config object so Romain's listening session on the sound-test page (distance slider) tunes one place.

**WAAPI structure (verified in Chromium):** per pawn, an outer `<g transform="translate(x y)">` (static anchor, set by Svelte) and two inner animated groups. Translation along the path = ONE animation on the mover with `n+1` linear keyframes, `duration = total`; the hop arc = ONE animation on the inner group with `iterations = n`, `duration = hopDur` (so both stay in lock step). Place each pawn's feet at local `(0,0)`: SVG elements without a CSS box have `transform-origin: 0 0` (computed `0px 0px`, `transform-box: view-box`, measured), so `rotate(-14deg)` for the rear pivots at the hooves with no origin tweaks. Do not animate an element that also carries an SVG `transform` attribute (the CSS property wins and the two collide): static position on the outer `<g>` attribute, animation on the inner `<g>`. `px` in `translate()` equals SVG user units inside the `0 0 2560 2560` viewBox (measured: `translate(2000px,1280px)` landed at 304.7 + 8 css px on a 390 px board).

### Pattern 5: Events are self-contained, the render state is a fold of events
`renderReduce(renderState, event)` is a pure function used by the Director (event by event) and by fast-forward (all queued events at once). **Property test:** for random full games, folding every emitted event over the initial render state equals the pawn/pile projection of `viewFor(finalState, seat)`. If this holds, hidden-tab fast-forward, reconnect (Phase 2) and replay are the same code (PITFALLS 12). Events (adapted from ARCHITECTURE Pattern 6; additions marked *new*): `dealt`, `handDealt`(private), `cardsExchanged` *new (replaces per-pair cardPassed/cardReceived, matches the UI)*, `cardPlayed`, `pawnExited`, `pawnMoved{path, dir}`, `pawnCaptured{by, victim, at, atStep}`, `pawnSentHome{to: stable slot}`, `pawnsSwapped`, `pawnEnteredHome{path, slot, homeCount}` (so the 4th pawn triggers the party, D-14), `handDiscarded`, `playerFinished` *new* (UI shows the « Tes quatre chevaux sont rentrés » prompt), `reshuffled` *new*, `turn`, `gameWon`.

### Pattern 6: Turn UI as a pure reducer
States: `idle | cardSelected | modeChoice(As/Roi) | pawnPreview | jackTarget | sevenBuilding(plan) | exchangeChoosing | deadHand | waiting`. `reduce(uiState, uiEvent, view)` is plain TypeScript, tested with Vitest; Svelte only renders it. Preview of a move is `resolveMove(view.board, seat, action)` (pure on a copy), so highlight, preview and apply cannot diverge. **Split `apply` into `resolveMove(board, seat, action)` (needs only board + own hand, so it also works on a `PlayerView`) and the deal/exchange transitions (need the full state)**; otherwise Phase 2 clients cannot preview.

### Pattern 7: Board rendering stack
Square wrapper (`B = min(100vw, 100dvh − chrome, 880px)`): `<img srcset="plateau-1280.webp 1280w, plateau-2560.webp 2560w" sizes="B px">` below, one `<svg viewBox="0 0 2560 2560">` above holding overlays, pawns, felt cards and the hit layer. Rotate by quarter turns: apply `transform: rotate(k·90deg)` to the `<img>` only, and rotate **anchor coordinates** in JS with `(x,y) → (2560−y, x)` per clockwise quarter turn, so pawns/cards/badges stay upright (UI-SPEC: "Pawns, cards, badges and halos are **not** rotated: only their anchor positions are transformed"). Rotation per colour from the UI-SPEC table: Bleu 0°, Jaune −90°, Rouge 180°, Vert +90°. Measured composite sizes (q80): 2560 px 880 KB, 1280 px 238 KB, 640 px 64 KB; the 2560 px decode is ~26 MB, so serve 1280 to phones.

### Pattern 8: Scenario fixtures as data (single source for RULES.md, tests and a viewer)
```ts
// packages/engine/test/scenarios/r10-seven-capture.ts
export const s: Scenario = {
  id: 'R-10.2', rule: 'R-10', title: 'Le 7 mange ce qu\'il dépasse',
  before: { pawns: { bleu: [{ring: 10}, 'stable', 'stable', 'stable'], rouge: [{ring: 14}, ...] },
            hands: { bleu: ['7♥'] }, turn: 'bleu', phase: 'play' },
  action: { t: 'play7', card: '7♥', plan: [{ pawn: 'bleu0', steps: 7 }] },
  expect: { legal: true, captured: ['rouge0'], after: { /* declarative pawns */ } },
};
```
A script renders `before`/`after` pictures with the real board for RULES.md (no engine needed, they are declarative), the engine tests assert `apply(before, action)` equals `after`, and a dev-only route `#/scenario/R-10.2` loads the fixture into the UI for Playwright captures of every animation (capture, swap, 4th pawn home) without playing to that point. `tools/rules-trace.mjs` fails CI if a `### R-xx` heading in RULES.md has no test/scenario or a scenario cites an unknown rule.

### Anti-Patterns to Avoid
- **Position-based pawn model / separate code paths for 4, 7, Jack:** use one `path()` and `isProtected`/`blocksPath`.
- **Animating from state diffs:** only from events; diff is for fast-forward.
- **`<image srcset>` assumptions inside SVG** (not supported): use HTML `<img>` under the SVG.
- **Reactive deep proxies on engine state:** `$state` deep-proxies objects; use `$state.raw` and replace the whole view (Svelte docs: "State declared with `$state.raw` cannot be mutated; it can only be _reassigned_" [CITED: sveltejs/svelte documentation/docs/02-runes/02-$state.md]).
- **Awaiting audio in the game loop;** audio is fire-and-forget behind an interface so tests use a fake.
- **Auto-playing a forced move for the human** (D-19) or auto-posing a human's dead hand (D-20).
- **jsdom for animation tests:** it has no `Element.animate`; test the pure timeline and drive real WAAPI in Playwright.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cell pixel coordinates | Click-through calibration UI or hand-typed numbers | Appendix A script (`sharp` + connected components) emitting `layout.json` + invariant checks | Detected in 0.76 s, re-runnable, centroid accuracy beats clicking; quarters are rotated copies within 8.6 px |
| Board delivery | Four stacked quarter `<img>`s at runtime | Build-time composite via `sharp` (`tools/build-board.mjs`) with 640/1280/2560 variants | One decode, memory budget (PITFALLS 19) |
| Property/regression testing of rules | Ad-hoc loops with `Math.random` | fast-check with fixed seeds (`fc.assert(..., {seed})`) | Shrinking gives minimal failing deals |
| Animation sequencing | A tween library or rAF loop | WAAPI `element.animate` + `await anim.finished` | Compositor-friendly, zero bytes (verified working on SVG `<g>`) |
| Audio scheduling | `setTimeout` clops, Howler | `AudioBufferSourceNode.start(t)` on the `AudioContext` clock | Cadence survives main-thread load; hoof render is 2 ms |
| Fonts | Manual subsetting | Fontsource variable woff2 (OFL) | latin + latin-ext already split; contains « » œ Œ é è ê à ç ’ and U+00A0 (cmap-checked) |
| Icons | Redrawn icons | Copy the 12 Lucide SVGs (ISC) | All 12 present in lucide-static 1.56.0 |
| Card faces (court cards) | Drawing Valet/Dame/Roi | A licensed asset behind a manifest, or plain pip cards for now | See Open Question 2; UI-SPEC allows plain pip cards until validated |
| Seeded PRNG | `Math.random` | ~10-line sfc32 with serialisable state (Code Examples) | Determinism for replay/tests; engine purity |
| Router | A routing library | ~30-line hash router for `#/`, `#/partie`, `#/sons` (STACK.md) | 3 routes |

**Key insight:** the expensive failures here are semantic (what `progress` means after a swap, mandatory entry, protected pawns), not mechanical, so spend effort on the model, RULES.md and fixtures, and none on custom tooling libraries.

## Geometry: measured facts (resolves the STATE.md "calibration" blocker)

All values from the Appendix A script run in this session [VERIFIED: tool run, output quoted].

- Assembled layout (UI-SPEC): Jaune (0,0), Rouge (1280,0), Bleu (0,1280), Vert (1280,1280); felt x/y 853..1707.
- The script found **exactly 72 ring cells** (per quarter: 16 numbered circles + 1 diamond + 1 entry square = 18, times 4), and its check printed `{"exitsAndEntriesOk":true,"pitchMin":122.7355286785371,"pitchMax":144.82769072245816}`.
- Ring index scheme confirmed on the real art: blue diamond = 0, jaune 18, rouge 36, vert 54; entry squares at 70 (bleu), 16 (jaune), 34 (rouge), 52 (vert), i.e. `entry = exit − 2`. Quarter `q` holds indices `61+18q … 6+18q` (blue: 61..71,0..6; jaune: 7..24; rouge: 25..42; vert: 43..60). Detection order of numbers matches ARCHITECTURE Pattern 8.
- Cell circle diameter 84 units (blobs 84×84, area ≈ 1810 for ring, 5530 filled for stable/home circles); diamond bbox 148-149, entry square bbox 106. UI-SPEC's "≈ 85" is correct.
- Rotation consistency (quarter `q` rotated 90° clockwise about its centre vs the next quarter): ring max 8.6 px, home/stable max 7.6 px, diamond ≤ 7.7 px, square ≤ 7.4 px (of 1280). Therefore: use the **detected** coordinates (not rotated copies of one quarter), and keep a rotation-consistency test with tolerance 12 px as a drift alarm.
- Home slot order: detection returns home circles unordered; sort by distance to the entry square (slot 0 nearest). Stable slot order: by distance to the diamond. Entry square to home slot 0 distance ≈ 165 units (diagonal), home pitch ≈ 127.
- Neighbouring ring cells are ≈ 129 units apart: on a 390 px board that is **19.6 px**, so a 44 px hit target overlaps neighbours; the UI-SPEC disambiguation tray will fire often on phones (test it at 375×667).
- Visual review: an overlay of the 72 indices on the assembled composite was rendered and inspected; indices run clockwise from the blue diamond up the left edge, across the top, down the right edge and back along the bottom; every label sits on its cell.

## Rules: what RULES.md and the engine must settle

### Status of SUMMARY questions for Phase 1
| Q | Status |
|---|--------|
| 1 (7 passes own pawns), 2 (no entry when backward), 3 (lap required), 5 (exchange per deal), 14 (protection = owner's pawn on own exit), 19 (7 whole or nothing) | Decided (PROJECT.md / D-04) |
| 10 (Jack own-own) | **Decided differently from the research default:** RULE-09 says own-own swap is illegal; so the Jack target must be another colour's ring pawn |
| 29 (board fixed or rotated) | **Decided differently:** D-05 rotates the board |
| 4, 26-28, 30-34 | Not Phase 1 (disconnect, toggles, takeover, chat, domain, email, push, language) |
| 6-9, 11-13, 15-18, 20-25 | Default hypotheses in SUMMARY; copy into RULES.md as "à valider" |

### Gaps found beyond Q5-34 (add to RULES.md; each needs a stated default)
| # | Gap | Proposed default | Why it matters |
|---|-----|------------------|----------------|
| G1 | **`progress` after a Valet swap.** The swapped pawn stands on the other pawn's ring cell; does it keep its lap count or take the position's? | Position-derived: new `progress = (cell − EXIT[color]) mod 72` in `[0,71]` (a pawn that lands on its own « 16 » square can enter; one that lands just after its exit has lost its lap). Alternative: keep own lap | Decides whether the Jack can shortcut "tour complet". Backward-4 gives `-4` while a swap to the same cell would give `68` (different meaning) |
| G2 | Entry blocked by a home pawn that would be jumped (not covered literally by D-01) | Treated like "occupied": pawn continues on the ring | Without it the move is either illegal or ambiguous |
| G3 | A pawn that overshoots and stands on its own exit (progress 72) is protected like on the first pass? | Yes (protection is about the cell and the colour, not the lap) | Consistency with RULE-13 |
| G4 | Exit square occupied by the owner's own protected pawn blocks the owner's own 4-backward and 7 path through that cell? | Yes: protected pawns block everyone including their owner's other pawns | RULE-13 says "aucun pion ne peut le dépasser" |
| G5 | Can the same pawn appear twice (non-consecutively) in a 7 plan? | Yes (ordered plan, simplest generator); consecutive duplicates merge | Edge cases when another pawn's move frees/blocks a cell in between |
| G6 | Jack with an own pawn on its own exit square | Not usable (protected cannot be swapped) | RULE-09: "ni un pion protégé sur sa sortie" |
| G7 | For a finished player, which pawns count as "own" for Jack, 7 and captures | Controlled (partner's) pawns are own for that turn; Jack swaps a partner pawn with an opponent pawn | Q16/Q17 default |
| G8 | Exchange simultaneity | All four choose, swaps applied together (UI-SPEC copy) | Engine phase shape |
| G9 | **Who starts each deal and when the dealer rotates** | First deal: seat after the dealer starts; dealer rotates at each reshuffle (per 52-card cycle); within a cycle the same dealer, the seat after the dealer starts each deal. UI-SPEC copy ("Donneur : {Nom} · Donne {k} sur 3", "On rebat les cartes. Donneur : {Nom}") already assumes per-cycle | RULE-02 says "à chaque paquet"; physical practice may rotate per deal |
| G10 | Do any card other than 5 move a pawn that is not the player's? | No: every card moves only the player's (controlled) pawns; Jack swaps one own with one other | RULE-07's parenthesis reads as removing Tock's "5 moves anyone" |

### RULES.md structure (French, in repo root)
One section per rule, each with a stable id and at least one scenario. Suggested map to requirements: `R-01 Equipes et places` (RULE-01), `R-02 Plateau et progression` (topology, entry/exit, home, no requirement id but everything depends on it), `R-03 Paquet, donnes, donneur` (RULE-02), `R-04 Echange de carte` (RULE-03), `R-05 Tour et obligation de jouer` (RULE-04), `R-06 As et Roi` (RULE-05/06), `R-07 Cartes a avancer` (RULE-07), `R-08 Le 4` (RULE-08), `R-09 Le Valet` (RULE-09), `R-10 Le 7` (RULE-10/11), `R-11 Prise` (RULE-12), `R-12 Case de sortie protegee` (RULE-13/14), `R-13 Entree dans la maison` (RULE-15), `R-14 Main injouable` (RULE-16), `R-15 Joueur qui a fini` (RULE-17), `R-16 Fin de partie` (RULE-18). Each rule block: **Règle** (one or two sentences), **Cas limites** (bullets citing G-numbers), **Scénarios** (ids `R-10.1`...). Mark every default not yet confirmed with « à valider ».

### Minimum scenario inventory (must-pass; covers success criterion 1)
Sortie protégée: forward pass blocked; backward-4 pass blocked; 7 mid-plan blocked; Jack target refused; capture refused; opponent pawn parked on **my** exit is eaten by my exit; my own pawn on my exit blocks my second exit; opponent's pawn on its own exit is protected only for its colour. 7: all on one pawn; split 3+4 and 2+2+3 across 3 pawns; capture mid-path and at the end; passes own pawns without eating; cannot stop on own pawn; impossible 7 is unplayable; order matters (A first frees B); plan rejected atomically. 4: backward from exit; backward onto an opponent (capture); never into home; backward through protected pawn refused. Jack: legal swap with opponent/partner; own-own refused; stable/home pawn refused; no target = unplayable; swap result progress (G1). Home: exact count into slot 0..3; overshoot continues a lap; occupied target continues; blocked by home pawn (G2); mandatory entry (D-02); advance inside home (D-03) incl. no jump; lap not done (after backward 4) cannot enter; pawn standing on the « 16 » square does not enter. Exit: Ace/King exit vs advance choice; no stable pawn; exit captures. Dead hand: partial playable hand; all-dead table; deal terminates. Finished player: plays partner pawns for 2, 5, 7, Jack, exit; win at 8. Deal: 5/4/4 sizes, reshuffle, dealer rotation, exchange (card conservation).

### Property tests (fast-check, fixed seeds)
52 cards conserved at every step; no two pawns on one ring cell and one pawn per home slot; every action in `legalActions` applies without throwing and keeps invariants; `apply` rejects every action not in `legalActions` (sampled); 7 plans sum to 7 and generator equals validator on ≤3 movable pawns; same seed + same actions gives byte-identical JSON; every deal terminates; random-legal games reach `gameWon` within a cap (**measure and report mean/max deals before promising game length; unmeasured**); `renderReduce(events)` equals the view projection; `viewFor(state, seat)` JSON never contains another seat's cards (cheap now, required by RULE-19 in Phase 2).

### Reason codes the engine must supply (from UI-SPEC, verbatim)
`no-pawn-can-move`, `no-pawn-to-exit`, `jack-no-target`, `seven-incomplete`, `blocked-protected`. [VERIFIED: 01-UI-SPEC.md:188-193]. Suggested derivation: for an unplayable card, re-run the generator with protection ignored; if that yields a move, reason is `blocked-protected`; else Jack → `jack-no-target`, 7 → `seven-incomplete`, As/Roi/others → `no-pawn-can-move` (use `no-pawn-to-exit` only if the planner finds a case that needs it).

## Common Pitfalls

### Pitfall 1: TypeScript 7 breaks `svelte-check`
**What goes wrong:** `pnpm add -D typescript@7.0.2` installs fine, `tsc` and Vite/Vitest work, `svelte-check` throws "TypeScript 7 support currently requires both TypeScript 7 and TypeScript 6 installed ... `--tsgo` flag" (reproduced).
**How to avoid:** pin `typescript@6.0.3`. **Warning sign:** `unmet peer typescript@"^5.0.0 || ^6.0.0": found 7.0.2` in the install log.

### Pitfall 2: Unpinned Vitest pulls 5.x
`vitest@latest` is 5.0.4; the Phase 2 workers pool needs 4.x. Pin `^4.1.11` in the root and add a Renovate rule.

### Pitfall 3: Container Chromium cannot decode AAC/m4a
Verified: `decodeAudioData` on the same hoof sample: wav OK, mp3 OK, ogg OK, **m4a `EncodingError: Unable to decode audio data`**. A loader that only tries m4a would silently fail in every Playwright run. Implement `[m4a, mp3]` candidates with try/catch decode (UI-SPEC order) so e2e exercises the mp3 path; the m4a path is verifiable only on Safari/iPhone. If no recordings are adopted, none of this applies (synthesised buffers need no codec).

### Pitfall 4: Fonts lack U+202F
UI-SPEC says the font subset "must contain ... U+202F". Checked the Fontsource `latin` and `latin-ext` woff2 cmaps (fontTools): **« » œ Œ é è ê à ç ’ U+00A0 present, U+202F absent in both families.** The browser falls back to the system font for that glyph (a thin space), which is harmless. Do not write a task or test that asserts the font contains U+202F; assert the catalogue text uses it instead (a unit test over `fr.ts`).

### Pitfall 5: Biome false positives on `.svelte`
Biome 2.5.15 parses Svelte but flags template-used variables as unused. Exclude `.svelte` from `linter` (keep format optional) and gate with `svelte-check`.

### Pitfall 6: Playwright browser download and revision mismatch
`@playwright/test@1.64.0` expects its own Chromium revision; the container has `chromium-1194` (Chromium 141). With `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and `launchOptions.executablePath` it runs (verified, both a phone-emulated and a desktop project passed). WebKit is not installed: no automated iOS Safari coverage.

### Pitfall 7: Hit targets on a 390 px board
Cell pitch is 19.6 px. Overlapping candidates are the norm for Valet targets and clustered pawns. Build the disambiguation tray as a first-class path, measure hit areas in Playwright (`boundingBox`), and verify at 320×480, 375×667, 390×844.

### Pitfall 8: Animation and audio drift under fast mode
×0.4 durations compress galop clops to ~30 ms. Add `MIN_CLOP_GAP_MS`, cap voices, and do not let the audio clock and WAAPI start at different times: schedule both from one `t0 = now + lead` (≈ 60 ms) and compensate with `AudioContext.outputLatency` when available.

### Pitfall 9: iOS audio is silent behind the ringer switch
Web Audio defaults to the `ambient` session on iOS, so the silent switch mutes it; `navigator.audioSession.type = 'playback'` (MDN BCD lists Safari 16.4+, iOS mirrors it, status experimental) or a looping silent `<audio>` element (the unmute.js technique) moves it to the media channel. Neither is confirmed on current iOS from this container. **Plan:** call `AudioContext.resume()` and set `audioSession.type='playback'` (feature-detected) inside the « Jouer la partie » tap, keep the UI-SPEC hint text, and put the real-iPhone test in the end-of-phase human checkpoint with the ringer switch both ways.

### Pitfall 10: Rules decided silently in code
Any rule whose default is still « à valider » must be a named constant/flag so a change is a one-line edit plus fixture update. A `TODO ask Romain` in code is a blocker.

### Pitfall 11: Hidden-tab backlog
rAF/WAAPI pause in background tabs. On `visibilitychange` hidden: pause the Director and the ambience; on return apply the end state of all queued events instantly, play no sounds for skipped events, show the latest bot line (UI-SPEC). The `renderReduce` property test is what makes this safe.

### Pitfall 12: Round-trip of UI-SPEC copy typography
French spacing (U+202F, U+00A0, `’`) is easy to lose in templates. Keep all strings in `fr.ts` with typed keys and add a test that scans each string for ` ?`, ` !`, ` ;`, ` :` with a plain space and for `'` straight apostrophes.

## Code Examples

Validated patterns (all executed in this session unless marked).

### sfc32 PRNG with serialisable state, Fisher-Yates (engine, no Math.random)
```ts
export type Rng = [number, number, number, number];
export function next(s: Rng): [number, Rng] {            // sfc32, returns [0,1) and the new state
  let [a, b, c, d] = s;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0;
  return [(t >>> 0) / 4294967296, [a, b, c, d]];
}
export function shuffle<T>(xs: readonly T[], s: Rng): [T[], Rng] {
  const out = xs.slice(); let r = s;
  for (let i = out.length - 1; i > 0; i--) { let u: number; [u, r] = next(r); const j = Math.floor(u * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
  return [out, r];
}
// shell only: const seed = crypto.getRandomValues(new Uint32Array(4)) -> newGame(cfg, [...seed] as Rng)
```
Note: `Math.floor` is fine; `Math.random` is what the purity test forbids. `[ASSUMED]` statistical quality (sfc32 is a well-known PractRand generator); deal fairness for a family game is not a security property, and RULE-02's "cryptographic" requirement is met by the CSPRNG seed in Phase 1 and by the server in Phase 2.

### Hop timeline (packages/board, pure)
```ts
export type Mode = 'normal' | 'fast' | 'reduced';
const SCALE = { normal: 1, fast: 0.4, reduced: 1 } as const;
export const MIN_CLOP_GAP_MS = 50;
export function hopTimeline(n: number, mode: Mode = 'normal') {
  if (mode === 'reduced') return { total: 180, hop: 180, landings: [180], clops: [180] };   // single 180 ms slide, one clop
  const total = (400 + 133 * (n - 1)) * SCALE[mode];            // UI-SPEC: 1 cell 400, 4 cells 800, 13 cells 2000
  const hop = total / n;
  const landings = Array.from({ length: n }, (_, i) => (i + 1) * hop);
  const gallop = n >= 8;                                         // UI-SPEC cadence: 2 clops per hop at 0 and 0.5 hop
  const raw = gallop ? landings.flatMap((t) => [t - hop, t - hop / 2]) : landings;   // gallop: at 0 and 0.5 hop from each hop start; else on landing
  const clops: number[] = [];                                                          // keep a clop only if >= MIN_CLOP_GAP_MS after the last KEPT one
  for (const t of raw) if (clops.length === 0 || t - clops[clops.length - 1]! >= MIN_CLOP_GAP_MS) clops.push(t);
  return { total, hop, landings, clops };
}
```
(Executed: n=13 normal gives 26 clops, min gap 77 ms; n=13 fast keeps 13 clops, min gap 61 ms; n=4 gives 4 clops 200 ms apart. Clop placement for the galop pattern, and whether clops sit on take-off or landing, are tuning choices for the sound-test page; unit-test the invariants: monotone, within `[0,total]`, gap ≥ `MIN_CLOP_GAP_MS`, `hop` decreases with `n`.)

### Mover + arc animations that stay in lock step (verified pattern)
```ts
const a1 = mover.animate(keyframesAlongPath(path), { duration: total, fill: 'forwards', easing: 'linear' }); // n+1 translate() keyframes
const a2 = arc.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-0.18 * pitch}px)`, offset: 0.5 }, { transform: 'translateY(0)' }],
                       { duration: hop, iterations: n });                                                    // one arc per hop
await Promise.all([a1.finished, a2.finished]);
```

### Audio unlock inside the gesture, synthesis baseline (hoof validated in headless Chromium)
```ts
export function unlock(): AudioContext {
  const ctx = (ctxSingleton ??= new AudioContext());
  (navigator as any).audioSession && ((navigator as any).audioSession.type = 'playback');   // feature-detected, iOS ringer switch
  void ctx.resume();                                      // call synchronously inside the click handler
  return ctx;
}
// retry on every later pointerdown while ctx.state !== 'running'; never await audio in the game loop
```
Synthesis recipes (render with `OfflineAudioContext` once at unlock, keep `AudioBuffer`s): see Appendix D. Measured: hoof renders in 2.0 ms; neigh buffer peak 0.60 / rms 0.13; its spectrogram shows a harmonic contour rising then falling with vibrato, formants following the filter sweeps. Whether it sounds like a horse is a listening decision for Romain on `#/sons` (D-22).

### Playwright config for this container
```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  webServer: { command: 'pnpm --filter @toc/web build && pnpm --filter @toc/web preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:4173', launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] } },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },   // 390x664 emulated
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
// run: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm exec playwright test
```
`page.emulateMedia({ reducedMotion: 'reduce' })` was verified to flip `matchMedia('(prefers-reduced-motion: reduce)')`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TypeScript 5.x/6.x | TS 7 native (`latest` 7.0.2) | npm latest at research date | `svelte-check` needs TS 6 (+ optional `@typescript/native` alias and `--tsgo`); stay on 6.0.3 |
| Vitest 4 | Vitest 5.0.4 is `latest` | before 2026-10-12 | Pin 4.1.x until pool-workers supports 5 (Phase 2) |
| pnpm 10 | pnpm 12.11.2 is `latest` | npm `latest` | Use `packageManager: pnpm@10.34.7`; revalidate 12 later |
| Silent-`<audio>` hack for iOS mute switch | `navigator.audioSession.type = 'playback'` | Safari 16.4 (MDN BCD `api/AudioSession.json`, experimental) | Use the API first, keep hack as fallback; device test required |
| Click-calibrating art | Image-processing detection | n/a | 0.76 s, deterministic |

**Deprecated/outdated:** `<image srcset>` inside SVG (not a thing); Howler.js (unmaintained since 2023-09 per STACK.md); SVG `filter: drop-shadow` per frame.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Package names `@fontsource-variable/{nunito,caveat}` and `lucide-static` are the right sources (names came from training knowledge; registry, license and file contents were checked) | Standard Stack | Low; swap for manual woff2/SVG downloads |
| A2 | G1-G10 defaults (esp. G1 progress after a Jack swap, G9 dealer/first player) are what Romain wants | Rules | Rework of engine fixtures; this is the main schedule risk, hence the checkpoint |
| A3 | Setting `navigator.audioSession.type='playback'` un-mutes Web Audio behind the iOS silent switch on current iOS | Pitfall 9 | Silent game on iPhones with ringer off; fallback hack + device test |
| A4 | Safari/iOS decodes MP3 via `decodeAudioData` (well-known, not tested here) | Pitfall 3 | If false, ship m4a too (UI-SPEC already asks for m4a primary) |
| A5 | Random-legal bots finish a game in a tolerable number of deals | Property tests | Very long games hurt UX and e2e; **unmeasured**, measure with the engine's self-play before promising |
| A6 | The synthesised neigh recipe is acceptable to Romain; no CC0 recording confirmed | Audio | May need recordings brought by Romain; synthesis stays the shipped fallback |
| A7 | Bellot svg-cards (Paris pattern) is LGPL and Byron Knoll's set is contested CC0 (both from search snippets) | Open Question 2 | Card art may need Romain's decision or own art |
| A8 | sfc32 is adequate for deal fairness | Code Examples | Negligible for this use |
| A9 | Treating "blocked by a home pawn" like "occupied" (G2) matches the intent of D-01 | Pattern 1b | Entry behaviour differs in rare blocked-home positions |
| A10 | The galop pattern (2 clops/hop) and clop placement sound right | Pattern 4 | Tune by ear in the sound test; constants isolated |

## Open Questions

1. **RULES.md validation timing vs the tracer slice.**
   - Known: STATE.md says RULES.md must be validated before the engine; the tracer slice (scaffold, layout, board, one hopping knight, synthesized clops) needs only validated topology, not card rules.
   - Recommendation: order = scaffold + tracer, then RULES.md draft + illustrations, then Romain checkpoint, then engine; UI/audio primitives can proceed in parallel with the checkpoint. The Romain checkpoint is blocking for engine tasks even though `human_verify_mode` is `end-of-phase` in config.json.
2. **Card-face artwork (D-24).**
   - Known: no clearly CC0 French-pattern deck found. Byron Knoll vector cards are listed CC0 on OpenGameArt but commenters dispute it (Bicycle-derived faces, uncertain Ace of Spades); David Bellot's svg-cards 2.0 is Paris pattern but LGPL; Kenney's Boardgame Pack is CC0 but not French pattern. License pages were unreachable (403).
   - Recommendation: ship plain pip cards with letter courts (V, D, R) behind a face-manifest; ask Romain to choose: accept LGPL for card SVGs (with source/credit), supply his own art, or keep pip cards. The board's aide-memoire thumbnails suggest Romain already used a traditional-figure deck for the board; ask him where it came from.
3. **CC0 neigh/whinny/hoof recordings.** Needs a person with browser access to freesound.org/opengameart.org (CC0 filter), per-file licence page saved, then A/B on `#/sons`. Not blocking.
4. **Random-bot game length.** Unmeasured. First engine plan should include a self-play harness (10 000 games, report mean/max deals, assert termination under a cap).
5. **Real iPhone checks** (audio unlock, ringer switch, background/foreground) are human-only: put them in the end-of-phase checkpoint.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | 22.22.0 | — |
| npm registry | installs | ✓ | reachable (also raw.githubusercontent.com) | — |
| pnpm | workspace | ✓ | 10.28.0 (target 10.34.7; corepack 0.34.0 present) | use 10.28.0 |
| Chromium (Playwright) | e2e, headless audio/WAAPI checks | ✓ | Chromium 141 at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` | — |
| Playwright WebKit / Firefox | iOS/Safari coverage | ✗ | — | real iPhone, human checkpoint |
| sharp (npm) | board composite, calibration | ✓ | 0.35.5 installed and run | — |
| ffmpeg | encode recorded samples | ✓ | encoders: aac, libmp3lame, libopus, libvorbis | — |
| freesound.org / opengameart.org / github.com / MDN / svelte.dev | CC0 spike, licence reading | ✗ | proxy 403 / DNS failure | Romain or an unrestricted machine |
| Real iPhone | FX-05 on iOS | ✗ | — | human_needed checkpoint |

**Missing dependencies with no fallback:** none blocking execution.
**Missing with fallback:** CC0 recordings (synthesis ships), iOS device (checkpoint), WebKit (device).

## Verification Tooling (nyquist_validation is `false`, so no Validation Architecture section; this is what the planner asked for)

| Layer | Tool | Notes |
|-------|------|-------|
| Engine rules, scenarios, properties | Vitest 4.1.11 + fast-check 4.10.2 in `packages/engine` | node env, ms-scale; `pnpm vitest run packages/engine` |
| Pure UI logic (TurnUi reducer, timeline, renderReduce, rotate, fr.ts typography, parseSettings) | Vitest | no jsdom needed |
| Rules traceability | `tools/rules-trace.mjs` | RULES.md ids vs `describe('R-xx')`/scenario ids |
| Engine purity | `test/purity.test.ts` + `lib: ES2022` | grep forbidden globals |
| Geometry | `tools/calibrate-board` run as a test: asserts 72 cells, exits/entries, pitch band, rotation drift ≤ 12 px | 0.76 s |
| Type check | `tsc -p` per package + `svelte-check` (TS 6.0.3) | |
| E2E UI | Playwright, `phone` (iPhone 13 emulated) + `desktop` projects, plus explicit viewports 320×480, 375×667, 390×844, 480×320 landscape | assert board square, no cropping, hit area ≥ 44 px via `boundingBox`, reduced motion via `emulateMedia`, `document.getAnimations()` durations vs `hopTimeline` |
| Audio logic | `AudioBackend` interface with a fake recording `start(t)` calls; in Chromium, `OfflineAudioContext` renders buffers (peak/rms non-zero) | cannot judge sound quality or iOS behaviour |
| Visual | Playwright screenshots of the scenario viewer (`#/scenario/R-xx.y`) for capture/swap/4th-pawn; pawn legibility shots at 17 px and 39 px sizes | review by eye in the checkpoint |
| Human-only | Romain: RULES.md, sound test page, card art licence; iPhone: audio unlock with ringer on/off, installed vs Safari tab | |

Sampling: quick = `vitest run` (engine + pure logic) per task; full = vitest + svelte-check + playwright per wave; phase gate = all green plus the human checkpoints.

## Security Domain

`security_enforcement` is enabled (absent = enabled; `security_asvs_level: 1`). Phase 1 has no network, accounts or server.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 4 |
| V3 Session Management | no | Phase 4 |
| V4 Access Control | no | Phase 2/4 |
| V5 Input Validation | yes (small) | `localStorage` values (`toc.settings.v1`, `toc.soundnotes.v1`, last colour) are untrusted: `JSON.parse` in try/catch, validate shape and clamp ranges, fall back to defaults; URL params (`?debug=geometry`, `#/scenario/…`, `?scenario=`) accepted only from an allow-list and compiled out of production builds |
| V6 Cryptography | yes (small) | Deck seed from `crypto.getRandomValues` (never `Math.random`); no hand-rolled crypto |
| V14 Config | yes | No `{@html}`, no `innerHTML`; all text through Svelte; self-hosted fonts/icons (no third-party requests) |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered `localStorage` / URL param | Tampering | Parse + validate + allow-list |
| Debug routes shipped to production | Information disclosure | Gate by `import.meta.env.DEV` or a build flag |
| XSS via copied notes (« Copier mes notes ») | Tampering | Plain text clipboard only, render notes as text |
| Predictable deals | Tampering | CSPRNG seed; server shuffle in Phase 2 |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-10-13) for every version in Standard Stack; `svelte-check@4.7.6` peer `typescript ^5.0.0 || ^6.0.0`; vitest 4.1.11 peers.
- Executed in this container: pnpm workspace + Vite 8.3.4 + Svelte 5.57.2 + Vitest 4.1.11 + fast-check + svelte-check (TS 6.0.3 pass, TS 7.0.2 crash) + Biome 2.5.15; `@playwright/test` 1.64.0 with `/opt/pw-browsers/chromium-1194`; WAAPI/transform-origin/viewBox measurements; `OfflineAudioContext` synthesis + `decodeAudioData` format matrix; `sharp` composite; fontTools cmap check; Lucide icon presence; 7-plan counting benchmark.
- In-repo documents read this session: `01-CONTEXT.md`, `01-UI-SPEC.md`, `REQUIREMENTS.md`, `STATE.md`, `PROJECT.md`, `ROADMAP.md`, `research/SUMMARY.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `.claude/CLAUDE.md`, `.planning/config.json`.
- `raw.githubusercontent.com/sveltejs/svelte/main/documentation/docs/02-runes/02-$state.md` (`$state.raw`).
- `raw.githubusercontent.com/mdn/browser-compat-data/main/api/AudioSession.json` (Safari 16.4, iOS mirrors, experimental).
- `raw.githubusercontent.com/w3c/audio-session/main/explainer.md` (session types incl. `playback`, `ambient`, `auto`).

### Secondary (MEDIUM confidence)
- `raw.githubusercontent.com/swevans/unmute/master/README.md` (silent `<audio>` technique, iOS media vs ringer channel).
- WebSearch: WebKit bugs 264473 / 237322 (default session `ambient`, `playback` keeps playing when muted); community unlock guidance (resume inside touchend/click).

### Tertiary (LOW confidence, search snippets only, pages unreachable)
- OpenGameArt: zebra whinny CC-BY 3.0; horse-gallop pack mixes CC0 and CC-BY 4.0 (node 167525); Byron Knoll "Playing Cards (Vector & PNG)" listed CC0 with disputed provenance (node 15838); Kenney Boardgame Pack / Playing Cards Pack CC0; David Bellot svg-cards (Paris pattern) LGPL.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, each package installed and exercised; TS 7 incompatibility reproduced.
- Geometry: HIGH, detected and cross-checked against topology invariants and by eye on an overlay.
- Architecture: MEDIUM-HIGH, patterns inherited from project research and re-checked on the points that touch Phase 1 (WAAPI structure, JIT packages, event fold).
- Rules: MEDIUM, defaults need Romain; G1 and G9 are the real unknowns.
- Audio: MEDIUM for the pipeline (synthesis works, decode matrix measured), LOW for CC0 availability and iOS behaviour.
- Pitfalls: MEDIUM-HIGH.

**Research date:** 2026-10-13
**Valid until:** 2026-10-27 (fast-moving: TypeScript 7, Vitest 5, pnpm 12 ecosystems changing); geometry and rules findings do not expire unless the art changes.

---

## Appendix A: `tools/calibrate-board/calibrate.mjs` (validated: 0.76 s, 72 cells, checks pass)

```js
// Detects every cell of the board on the 4 quarter images (no manual clicking).
import sharp from 'sharp';
import fs from 'node:fs';
const DIR = process.argv[2] ?? 'assets/plateau';
const OFF = { jaune: [0, 0], rouge: [1280, 0], bleu: [0, 1280], vert: [1280, 1280] };
const COLOR = { bleu: [1, 0, 214], jaune: [255, 255, 0], rouge: [212, 1, 0], vert: [1, 156, 1] };
const W = 1280;
function blobs(mask, minArea) {            // 4-connected components, iterative flood fill
  const seen = new Uint8Array(mask.length), out = [], stack = new Int32Array(mask.length);
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    let sp = 0, n = 0, sx = 0, sy = 0, x0 = W, y0 = W, x1 = 0, y1 = 0;
    stack[sp++] = s; seen[s] = 1;
    while (sp) {
      const i = stack[--sp], x = i % W, y = (i / W) | 0;
      n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= mask.length || seen[j] || !mask[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        seen[j] = 1; stack[sp++] = j;
      }
    }
    if (n >= minArea) out.push({ cx: sx / n, cy: sy / n, w: x1 - x0 + 1, h: y1 - y0 + 1, area: n });
  }
  return out;
}
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cells = [], pieces = {};
for (const q of Object.keys(OFF)) {
  const { data } = await sharp(`${DIR}/quart-${q}.webp`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const col = new Uint8Array(W * W), dark = new Uint8Array(W * W), c = COLOR[q];
  for (let i = 0; i < W * W; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    col[i] = Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]) < 60 ? 1 : 0;
    dark[i] = r + g + b < 150 ? 1 : 0;
  }
  const [ox, oy] = OFF[q], P = (b) => [b.cx + ox, b.cy + oy];
  for (const b of blobs(dark, 800)) if (b.w < 100 && b.h < 100) cells.push({ q, kind: 'circle', p: P(b) }); // the felt (426 px) is excluded
  const cb = blobs(col, 300);
  const diamond = cb.find((b) => b.w > 130), square = cb.find((b) => b.w > 100 && b.w <= 130);
  cells.push({ q, kind: 'diamond', p: P(diamond) }, { q, kind: 'square', p: P(square) });
  const round = cb.filter((b) => b.w < 100).map(P);          // 8 coloured circles = 4 stables + 4 home
  const spread = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); };
  let best = null;                                           // stables = the 4 aligned on an axis, home = the 4 on the diagonal
  for (let m = 0; m < 256; m++) {
    const A = [], B = [];
    for (let k = 0; k < 8; k++) (m >> k & 1 ? A : B).push(round[k]);
    if (A.length !== 4) continue;
    const s = spread(A); if (!best || s < best.s) best = { s, A, B };
  }
  pieces[q] = { diamond: P(diamond), square: P(square), stable: best.A, home: best.B };
}
if (cells.length !== 72) throw new Error(`expected 72 ring cells, got ${cells.length}`);
// ring order: start on the blue diamond, first step to blue "1", then nearest-neighbour chain
const start = cells.findIndex((c) => c.q === 'bleu' && c.kind === 'diamond');
const used = new Set([start]), order = [start];
const first = cells.map((c, i) => [i, d2(c.p, [207, 1280 + 618])]).sort((a, b) => a[1] - b[1])[0][0];
used.add(first); order.push(first);
while (order.length < 72) {
  const last = cells[order.at(-1)].p;
  const nxt = cells.map((c, i) => [i, d2(c.p, last)]).filter(([i]) => !used.has(i)).sort((a, b) => a[1] - b[1])[0][0];
  used.add(nxt); order.push(nxt);
}
const ring = order.map((i) => cells[i].p.map((v) => Math.round(v * 10) / 10));
const names = ['bleu', 'jaune', 'rouge', 'vert'];
const ok = [0, 18, 36, 54].every((e, k) => cells[order[e]].kind === 'diamond' && cells[order[e]].q === names[k]
  && cells[order[(e + 70) % 72]].kind === 'square' && cells[order[(e + 70) % 72]].q === names[k]);
const pitch = ring.map((p, i) => d2(p, ring[(i + 1) % 72]));
const out = { size: 2560, ring, pieces: Object.fromEntries(names.map((q) => {
  const p = pieces[q];
  return [q, { home: [...p.home].sort((a, b) => d2(a, p.square) - d2(b, p.square)),      // slot 0 nearest the entry square
               stable: [...p.stable].sort((a, b) => d2(a, p.diamond) - d2(b, p.diamond)) }];
})), checks: { exitsAndEntriesOk: ok, pitchMin: Math.min(...pitch), pitchMax: Math.max(...pitch) } };
console.log(JSON.stringify(out.checks));
fs.writeFileSync('layout.raw.json', JSON.stringify(out));   // then normalise /2560 (0..1) into packages/board/layout.json
```
Hard-coded assumption: the colour thresholds (`< 60` L1 distance, `sum < 150` for black) and the `[207, 1898]` seed for blue « 1 » come from this art; if the art is re-exported the checks (72 cells, exits/entries) fail loudly. The `?debug=geometry` overlay remains the human review step.

## Appendix B: measured cell centres (2560 units, rounded; expect the script to reproduce them within ~1 px)

`ring[0..71]` (index 0 = blue diamond, clockwise; 18 = jaune diamond, 36 = rouge, 54 = vert; entry squares 70, 16, 34, 52):
```
[[121,1996],[207,1899],[297,1804],[374,1705],[434,1598],[486,1477],[509,1348],[507,1218],[482,1092],[436,976],[373,868],[296,770],[211,675],[162,551],[169,428],[234,320],[358,265],[418,146],[557,123],[653,209],[747,299],[847,376],[954,436],[1075,488],[1204,511],[1334,509],[1460,484],[1576,438],[1684,375],[1782,297],[1877,213],[2001,163],[2124,171],[2232,236],[2294,360],[2406,420],[2439,560],[2352,656],[2262,750],[2185,849],[2125,956],[2073,1077],[2050,1206],[2052,1336],[2077,1462],[2123,1578],[2186,1686],[2264,1784],[2348,1879],[2397,2003],[2390,2126],[2325,2234],[2202,2289],[2141,2408],[2004,2432],[1903,2346],[1808,2256],[1709,2179],[1602,2119],[1481,2068],[1352,2044],[1222,2047],[1096,2071],[980,2118],[872,2180],[774,2258],[679,2343],[555,2392],[432,2385],[324,2319],[264,2195],[150,2136]]
```
Per colour (stable slots ordered by distance to the diamond, home slots by distance to the entry square):
```
bleu  stable [[94,1826],[94,1699],[94,1571],[94,1443]]      home [[381,2077],[471,1987],[562,1897],[652,1806]]
jaune stable [[727,95],[854,95],[982,95],[1109,95]]         home [[476,382],[566,472],[656,563],[746,653]]
rouge stable [[2466,730],[2466,857],[2466,985],[2466,1113]] home [[2179,479],[2089,569],[1998,659],[1908,750]]
vert  stable [[1833,2461],[1706,2461],[1578,2460],[1450,2461]] home [[2084,2174],[1994,2084],[1904,1993],[1813,1903]]
```
Felt slots, talon and défausse centres come from UI-SPEC (verified quote: "Last card, Bleu seat | (1280, 1570)", Jaune (990, 1280), Rouge (1280, 990), Vert (1570, 1280), Talon (1180, 1280), Défausse (1380, 1280), cards 160 × 224).

## Appendix C: knight symbol draft (technique validated; art still needs polish)

Rendered at 17 px, 39 px and 90 px board scales, four colours, mirrored and unmirrored, over the oak colour: the silhouette reads as a Staunton knight at 39 px and as a recognisable horse head at 17 px. Technique: one `<symbol viewBox="0 0 110 190">` per colour, feet at the bottom centre; body `linearGradient` light→body→dark (light = mix(body, #FFF, .35), dark = mix(body, #2B1D12, .40), UI-SPEC tokens), a white 35 % radial highlight, 3-4 static semi-transparent grain strokes, outline 3 units `#2B1D12`, **no filters**; shadow = one shared pre-baked `<ellipse rx=60 ry=14 fill="#2B1D12" fill-opacity=".28">`; instances via `<use>`; mirror with `scale(-1 1)` on the outer group. Silhouette path used (head faces right):
```
M26 160 C24 128 20 98 33 66 C37 50 39 34 45 14 L58 30 C72 32 88 46 99 68 C105 79 103 91 94 92
C86 93 79 87 71 85 C66 98 70 112 82 131 C88 143 91 152 91 160 Z
base: M26 160 L91 160 L98 168 L98 176 C98 182 88 186 55 186 C22 186 12 182 12 176 L12 168 Z
```
Known weaknesses of the draft: the mane tick marks stick out of the silhouette; the base is plain. Plan a visual-review task at 17/39/90 px and treat these as the acceptance sizes.

## Appendix D: Web Audio synthesis recipes (rendered in headless Chromium, outputs non-silent)

- **Hoof clop (2 ms render):** 100 ms white-noise burst (LCG-seeded buffer) → `bandpass` 1400 Hz (+120 Hz per variant, Q 1.2) → gain 0→0.9 in 2 ms, exponential decay to 0.001 by 70 ms; plus a sine 170→60 Hz (exp) over 90 ms with gain 0→0.8 in 3 ms decaying by 110 ms. Make 3 variants and pick at random; jitter ±4 % `playbackRate`, ±1.5 dB gain at play time (UI-SPEC).
- **Neigh (1.1 s):** sawtooth, frequency 420→900 Hz (0.25 s) →700 (0.5 s) →330 Hz exp at the end, 22 Hz vibrato of ±18 Hz; fed in parallel into three `bandpass` formants (650 Hz Q5 gain 1.0, 1300 Hz Q6 gain 0.7, 2700 Hz Q8 gain 0.4), each swept to 1100 / 2000 / 3200 Hz by 30 % of the duration and back to 0.8 of start; envelope 0→1 in 60 ms, hold to 65 %, exponential release; plus 12 % band-passed breath noise at 3 kHz. Derive the variants (joyful: shorter, higher, 1.4× pitch; plainte: lower, falling; surpris: 0.35 s, rising only; snort/ruade: noise-heavy, 0.25 s) by changing duration, pitch contour and formant targets. Mirror each as a `LICENSES.md` row « Généré par le code ».
- Card sounds (riffle, down, slide): filtered noise bursts with short envelopes, same approach.
- Ambiance loop: synthesised low-level filtered noise bed with slow LFO as the baseline; a recorded loop is optional. Avoid MP3 loops (encoder priming gap); use two overlapping sources with a 1.5 s crossfade.
