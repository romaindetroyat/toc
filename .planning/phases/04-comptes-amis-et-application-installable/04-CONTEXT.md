# Phase 4: Comptes, amis et application installable - Context

**Gathered:** 2026-10-17
**Status:** Ready for research and planning

<domain>
## Phase Boundary

Each relative has an account and finds their friends again. From the installed app they start a table or a solo game, and they are told when it is their turn or when someone invites them. Requirements: ACCT-01..05, APP-01..03 (see ROADMAP phase 4), as narrowed below by Romain's choices.

Phases 1, 2 and 3 are done: the local game against the computer (levels 1–5), and online tables on a Cloudflare Worker + one SQLite Durable Object per table. A table is joined by a shared link and a first name remembered by the device with a private device token (phase 2 D-01). The D1 database « toc » exists and is bound as DB; it holds the anonymous finished-game rows (HIST-01).

Out of scope: history, stats and leaderboard UI (phase 5); e-mail of any kind (see D-01); spectators; free-text chat.

The game is published at https://toc.romaindetroyat.workers.dev (Worker « toc »), deployed from the cloud container with `wrangler.embarque.jsonc`, the embedded-assets variant (see phase 2 CONTEXT). There is no custom domain. The passkey RP ID is therefore `toc.romaindetroyat.workers.dev` unless a domain is added later. The research must check what moving the RP ID would cost.

</domain>

<decisions>
## Implementation Decisions (Romain, 2026-10-17)

### Accounts
- **D-01: No e-mail at all.** Asked « Pour envoyer les codes par e-mail, il faut un nom de domaine à toi… En as-tu un ? », Romain answered « Pas d'e-mail ». Accounts are a unique pseudo plus a passkey; there is no e-mail address, no e-mail code and no e-mail recovery. This narrows ACCT-01: record it in REQUIREMENTS.md as Romain's choice. No Resend, no domain purchase. — **Reversibility:** moderate. E-mail could be added later as an optional recovery path.
- **D-02: Recovery by a backup code.** When the account is created, the player gets a recovery code to keep (a screenshot or on paper). It lets them add a passkey on a new device. Romain: « Code de secours (Recommandé) ». The code is shown once, stored only as a hash, and can be regenerated from the account.
- **D-03: Sign-up by invitation only.** A new account needs an invitation link from a registered player, so the circle stays among relatives. Romain: « Sur invitation (Recommandé) ». Bootstrapping Romain's own first account is the planner's call: for example a one-time setup link or a secret set with `wrangler secret`, never committed.
- **D-04: Unique pseudo** across the game. Romain: « Unique (Recommandé) ». Case-insensitive uniqueness and allowed characters are the planner's call; accents must be allowed (French names).
- **D-05: Guests stay.** Anyone can still join a table by its link with a first name and no account, as in phase 2. An account adds friends, notifications and, later, history. Romain: « On les garde (Recommandé) ». Signing in on a device must keep that device's seats in its current games: the device token goes with the account.

### Friends and tables
- **D-06: Signing up through someone's invitation link makes you friends automatically.** Romain: « Oui, automatiquement (Recommandé) ». A registered player can also add a friend by code or link (ACCT-03), and sees their friends list.
- **D-07: Tables are joined by the shared link plus friends.** The phase 2 link keeps working. On top of it, the creator can invite a friend in one tap, and the friend gets a notification. Romain: « Lien + amis (Recommandé) ». Seats, teams and per-seat computer strength reuse the phase 2 waiting room. The solo game is the existing local game (« Jouer contre l'ordinateur »).

### Installable app and notifications
- **D-08: Notifications only when the app is closed.** « C'est ton tour » and « on t'invite » are sent only when the player doesn't have the game open, never while they are playing. Romain: « Seulement app fermée (Recommandé) ». This uses Web Push (VAPID keys as Worker secrets, subscriptions in D1) and must work on an installed iPhone app (iOS 16.4+). The research must confirm the iOS constraints and how the Durable Object knows a player is « away », e.g. no open socket for that account.
- **D-09: The PWA follows CLAUDE.md:** vite-plugin-pwa with injectManifest, a prompt-to-update flow (an update never reloads a game in progress), an icon and a splash screen built from the logo of plan 02-04b, `lang: fr`, and a landscape orientation, since the board is landscape only.

### Claude's Discretion
- The auth library: CLAUDE.md suggests better-auth with its passkey plugin and Drizzle on D1. The research must check it works passkey-only and without e-mail on Workers and D1, or recommend a smaller hand-rolled passkey flow with SimpleWebAuthn. Any new package needs Romain's approval, asked through the usual AskUserQuestion.
- The session handling (cookie on the Worker's origin), the D1 schema (users, passkeys, recovery codes, invitations, friendships, push subscriptions), how a socket hello carries the account, how the phase 2 device token links to an account, the exact screens (galet style, French), and the free-plan budget (D1 rows, push sends).

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` § Phase 4 — goal and five success criteria (criterion 1 to be reworded: no e-mail)
- `.planning/REQUIREMENTS.md` — ACCT-01..05, APP-01..03
- `.claude/CLAUDE.md` — stack (better-auth, passkeys, D1/Drizzle, vite-plugin-pwa injectManifest, prompt update, Web Push deferred note)
- `.planning/phases/02-jouer-en-ligne-entre-proches/02-CONTEXT.md` and the 02 SUMMARYs — device token, table link, waiting room, protocol version (currently 5), D1 binding
- `.planning/phases/02-jouer-en-ligne-entre-proches/02-UI-SPEC.md`, `03-UI-SPEC.md` — design contract
- `wrangler.jsonc`, `wrangler.embarque.jsonc`, `tools/build-embedded-worker.mjs` — deploy setup (embedded assets; a service worker and manifest must survive it)

</canonical_refs>

<deferred>
## Deferred Ideas

- E-mail (codes, recovery, notifications): Romain chose « Pas d'e-mail ».
- A custom domain: none for now.
- Romain as an administrator who can reset an account: not chosen; the backup code is the recovery.

</deferred>

---

*Phase: 04-comptes-amis-et-application-installable*
*Context gathered: 2026-10-17*

## Addendum — Romain's answers after research (2026-10-18)

- **Packages approved.** AskUserQuestion « Pour les comptes, les notifications et l'application installable, j'ai besoin d'ajouter 6 outils libres… Tu valides leur installation ? » → « Oui, les 6 (Recommandé) ». The six are:
  - @simplewebauthn/server 14.0.3
  - @simplewebauthn/browser 14.0.0
  - @block65/webcrypto-web-push 2.0.0
  - vite-plugin-pwa 2.0.0
  - workbox-precaching 7.4.1
  - workbox-window 7.4.1

  Pin the exact versions. better-auth, Drizzle and Hono are not used (04-RESEARCH option B).
- **D-10: The address stays `toc.romaindetroyat.workers.dev`.** Romain: « Non, on garde workers.dev (Recommandé) ». The RP ID is that host, and no domain move is planned.
- **D-11: Invitation links are single-use and expire after 7 days.** Romain: « Un par personne, 7 jours (Recommandé) ».
- **D-12: Signing out gives the device's seats back.** The device must sign in again to resume the account's seats. Romain: « Non (Recommandé) », to whether a shared device keeps the seats after « Se déconnecter ».
- **« C'est ton tour » timing (à confirmer par Romain at UAT).** This follows 04-RESEARCH's recommendation. A missing player is notified 30 s after the table pauses for them, and when a saved game is resumed without them. Nobody who is at the table is ever notified.
