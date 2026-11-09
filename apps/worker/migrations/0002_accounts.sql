-- The accounts of phase 4 in D1 (plan 04-01; 04-RESEARCH Pattern 9; D-01 to D-06, D-10 to D-12).
-- The whole account schema of the phase: a later need goes into 0003, this file is never edited.
-- No e-mail address is stored anywhere (D-01): an account is a pseudo and its passkeys.
--   users               one row per account: the pseudo as shown and its key (case and accents
--                       ignored, D-04), the random WebAuthn user handle (never the pseudo), the backup
--                       code as an HMAC under the TOC_PEPPER secret (D-02, never the code), the inviter
--   passkeys            the account's passkeys (credential id, COSE public key, counter), each with
--                       the RP ID it was made for (a later address move stays possible, D-10) and the
--                       device label shown in « Mon compte »
--   sessions            one row per signed-in browser, keyed by SHA-256 of the HttpOnly cookie's token
--                       (never the token); the passkey it was opened with (removing that passkey ends it)
--   challenges          one row per passkey ceremony, single use, 5 minutes; a sign-up's pending pseudo
--   invitations         a link (or, later, a short friend code), stored as SHA-256 of its code; single
--                       use and 7 days (D-11); claimed (used_at) before its user exists, then used_by;
--                       inviter_id is null only for the test-mode invitations (TOC_TEST_MODE)
--   friendships         two rows per friendship, one per direction (D-06)
--   push_subscriptions  Web Push endpoints of an account, each tied to the session that made it, so
--                       signing out ends that device's notifications (D-08, D-12)
--   table_members       the online tables an account sits at, for « Mes parties en cours » everywhere
-- Times are ms since the epoch (server time). Identifiers are base64url.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  pseudo TEXT NOT NULL,
  pseudo_key TEXT NOT NULL UNIQUE,
  webauthn_user_id TEXT NOT NULL UNIQUE,
  backup_mac TEXT,
  backup_at INTEGER,
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rp_id TEXT NOT NULL,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL,
  transports TEXT,
  device_type TEXT,
  backed_up INTEGER,
  label TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE INDEX passkeys_user ON passkeys (user_id);

CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  passkey_id TEXT REFERENCES passkeys(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  auth_at INTEGER NOT NULL
);

CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE challenges (
  challenge TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login', 'add', 'recover', 'stepup')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  pending TEXT,
  expires_at INTEGER NOT NULL
);

CREATE TABLE invitations (
  code_hash TEXT PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('link', 'code')),
  inviter_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  used_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX invitations_inviter ON invitations (inviter_id);

CREATE TABLE friendships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
) WITHOUT ROWID;

CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT REFERENCES sessions(id_hash) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ok_at INTEGER
);

CREATE INDEX push_user ON push_subscriptions (user_id);

CREATE TABLE table_members (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_id TEXT NOT NULL,
  seat TEXT,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, table_id)
) WITHOUT ROWID;
