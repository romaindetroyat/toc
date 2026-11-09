---
phase: 04-comptes-amis-et-application-installable
plan: 13
subsystem: accounts
tags: [gap, iphone, pwa, invitation, sign-in-sheet, e2e, tdd]
status: complete

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-09: the invitation route #/invitation/<code> and the sign-in sheet; 04-10: the FriendCodeSheet field pattern; @toc/protocol isInvitationCode"
provides:
  - "flow.invitationFromInput: the code of a pasted invitation link (any origin), of the message around it, or of the bare code; null otherwise"
  - "SignInSheet.svelte: « J’ai une invitation », its field, « Continuer », the inline error and the iPhone line"
  - "e2e-online/coller-invitation.spec.ts: sign-up from a pasted full link, from a bare code, from the shared message; a refused value"
  - "04-UAT.md test 60 (Romain's iPhone check) and « À confirmer » 61"
affects: [phase-04-verification]

estimate:
  tokens: 30000
  tasks: 3
actuals:
  tokens: 11300
  tasks: 3
  commits: 6
plan_head_before: 20ced836db02c39f03a81d2d607009d587940887
plan_head_after: 1734b7cad81ffc793c0fc02146bbded4669c0b08

tech-stack:
  added: []
  patterns:
    - "A pasted value is parsed leniently on the client but only a code accepted by the shared protocol check ever reaches the route"
    - "An e2e paste is a real one: the test writes the clipboard, then Ctrl/Cmd+V; the app's readText is counted and must stay at 0"

key-files:
  created:
    - apps/web/e2e-online/coller-invitation.spec.ts
  modified:
    - apps/web/src/account/flow.ts
    - apps/web/src/account/flow.test.ts
    - apps/web/src/ui/SignInSheet.svelte
    - apps/web/src/i18n/fr/compte.ts
    - apps/web/e2e-online/comptes.ts
    - .planning/phases/04-comptes-amis-et-application-installable/04-UAT.md
    - .planning/phases/04-comptes-amis-et-application-installable/04-UI-SPEC.md

key-decisions:
  - "The field lives in the sign-in sheet's hint, under « Pas encore de compte ? », on every device (the home tile « Se connecter » / « Créer un compte » opens that sheet); the iPhone line sits right under the field. The install sheet is unchanged (« colle-le ici » only makes sense next to the field). À confirmer par Romain (UAT 61)"
  - "The parser ignores the origin of a pasted link: the app only ever opens its own #/invitation/<code>, so a link copied from the live site works in a local build and the reverse"
  - "The whole shared message (« Marie t’invite sur TOC … https://…/#/invitation/<code> ») is accepted: WhatsApp often copies the message, not only the link"
  - "An empty value gets the same error line as a malformed one: the brief gives one sentence, and it says what to do"
  - "The field shows with or without WebAuthn: the invitation page then says what the browser can do (its 04-09 « unsupported » row)"

requirements-completed: [ACCT-01, APP-01]

coverage:
  - id: D1
    description: "The parser: bare code, full link of any origin, message around it, trailing text; null for empty, wrong length, foreign character, another route, not a string, over 2000 characters"
    requirement: ACCT-01
    verification:
      - kind: unit
        ref: "apps/web/src/account/flow.test.ts « invitationFromInput » (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "From a fresh signed-out home: the sheet, a real paste, « Continuer », the pseudo step and the sign-up with the virtual authenticator; same with a bare code; a bad value stays home with the error; no clipboard read by the app"
    requirement: ACCT-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/coller-invitation.spec.ts (3 tests × phone + desktop)"
        status: pass
    human_judgment: false
  - id: D3
    description: "In the installed app on a real iPhone: paste the link, Face ID, the account"
    requirement: APP-01
    verification: []
    human_judgment: true
    rationale: "04-UAT.md test 60, pending with Romain after the next deploy"

duration: 27min
completed: 2026-10-18
---

# Phase 4 Plan 13: « J’ai une invitation » : coller le lien dans l’application installée (iPhone) Summary

**The sign-in sheet now takes a pasted invitation link, the message around it or the bare code, and « Continuer » opens #/invitation/<code> inside the installed app, so an iPhone user who installed TOC first can create the account with Face ID.**

## The gap

Romain, on his iPhone, 2026-10-18: « Il n’y a pas d’option face id » in the installed app. The home tile « Se connecter » / « Créer un compte » opened a sheet whose only word on accounts was « Il faut l’invitation d’un proche qui a déjà un compte : demande-lui le lien. ». On iOS a tapped link always opens Safari, never the Home Screen app, and the installed app has its own cookie jar (04-RESEARCH A2), so the invitation route was unreachable from inside the app.

## What changed

- `flow.invitationFromInput(raw)` (`apps/web/src/account/flow.ts`): not a string or over 2000 characters → null; trimmed bare code accepted by `isInvitationCode` → it; else the first `#/invitation/([A-Za-z0-9_-]+)` in the text, kept only when `isInvitationCode` accepts the capture.
- `SignInSheet.svelte`: in the hint, after « Pas encore de compte ? » and its sentence, the label « J’ai une invitation » (Label 700), a text field (inputmode url, no autocapitalize, no spellcheck, enterkeyhint go) and the secondary « Continuer » on one row, 8 apart; the error line with the x icon in a polite region (`aria-invalid`, `aria-describedby`), cleared when the person types; then the Label muted line « Sur iPhone, ouvre ton lien d’invitation dans Safari, ou colle-le ici dans l’application. ». A good value closes the sheet and sets `location.hash`. Styles reuse FriendCodeSheet's field and existing tokens only (`--creme`, `--noyer`, `--creme-attenuee`, `--ambre` focus ring, `--button-height`, `--radius-button`, `--space-*`).
- Copy in `compte.signIn.invite` (label, submit, error, iphone).
- `e2e-online/comptes.ts`: `completeSignUp(page, pseudo)` split out of `signUp` (same steps), so the spec finishes the sign-up after reaching the pseudo step by paste.
- No `navigator.clipboard.readText` anywhere in `apps/web/src`; the spec counts calls and expects 0.

## Gate (run one after another)

| Suite | Result |
|-------|--------|
| `pnpm typecheck && pnpm lint && pnpm test` | 0 errors; Biome 375 files clean; Vitest 115 files, **1 846 passed, 2 skipped** (1 841 before + 5 new; the same 2 engine skips) |
| Full local Playwright | **459 passed, 99 skipped, 0 failed** (7.2 min), as in 04-12 |
| Full online Playwright | **108 passed, 0 failed** (8.1 min): 102 before + coller-invitation × 2 projects |
| PWA Playwright | **10 passed** (26.8 s) |

Before and after the runs, ports 8787, 4173 and 4174 refused a connection (checked with /dev/tcp). The screenshot run's `vite preview` was killed by its PID afterwards.

## Screenshots (looked at)

In `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`: `04-13-844x390-feuille.png`, `04-13-844x390-champ-vide.png`, `04-13-844x390-champ-rempli.png`, `04-13-844x390-erreur.png`, `04-13-844x390-apres-continuer.png` and the same five at 1280x800.

- 844 × 390: the sheet opens with the passkey button in sight, as before; the hint with the field scrolls inside the sheet (« Fermer » stays at the bottom). Field 299 px wide, « Continuer » beside it, the row ends 24 px inside the dialog; no horizontal scroll of the page. The error wraps on two lines under the field.
- 1280 × 800: the whole body shows, field and error included, no scrolling.
- After « Continuer » the URL is `#/invitation/Ab3_-defGHIJklmnOPq9xZ`. Under `vite preview` there is no Worker, so the invitation page shows its « Pas de connexion » row; with the Worker the online spec reaches the pseudo step.

## Deviations from Plan

1. **[Rule 2 - Missing] 04-UAT.md test 3 corrected.** It told Romain to « ouvrir le lien privé dans l’application installée », which is exactly what iOS cannot do. It now says to copy the link and paste it in « J’ai une invitation » (test 60).
2. **[Rule 2 - Missing] 04-UI-SPEC « Sign-in sheet » row added** for the new field (not in the plan's file list), so the contract matches the code; the fit note says the hint scrolls inside the sheet.
3. **comptes.ts helper split** (`completeSignUp`), not listed in the plan's files; behaviour of `signUp` unchanged (every spec using it passed).

## Known Stubs

None.

## For Romain to confirm

- Where the field lives (sign-in sheet, every device, under « Pas encore de compte ? ») and that at 844 × 390 you scroll the sheet to reach it (UAT 61).
- On the real iPhone after the next deploy: copy the link from WhatsApp or Messages, paste it in the installed app, Face ID (UAT 60). Not live until the orchestrator deploys this branch again (no migration, no secret).

## Self-Check: PASSED

- FOUND: apps/web/e2e-online/coller-invitation.spec.ts, apps/web/src/account/flow.ts (invitationFromInput), apps/web/src/ui/SignInSheet.svelte (data-invite-paste)
- FOUND commits: c1d0a37, f53ba12, 5fa0f7d, a24d4d4, 08e96cc, 1734b7c
