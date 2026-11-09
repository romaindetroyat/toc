-- « Mes résultats » in D1 (plan 05-01, HIST-02 to HIST-04, D-01 to D-04, D-13; 05-RESEARCH Pattern 3).
-- The whole results schema of phase 5: a later need goes into 0004, this file is never edited (nor
-- are 0001 and 0002: the anonymous games rows stay as they are and are not linked, D-04).
--   played      one row per finished game that had at least one account at the table: online (the
--               table's Durable Object writes it in the same batch as the legacy games row) or solo
--               (reported by a signed-in browser, client-claimed, plan 05-05)
--     id          online: the games row's game_id ('<table_hash>:<game_no>'); solo: 'solo:<user_id>:<uuid>'
--     seats       JSON, in the order bleu, jaune, rouge, vert: { colour, kind: 'account' | 'guest' |
--                 'bot', account (the account id, server-only: never in an answer but the caller's own
--                 seat), name (the pseudo, the guest's first name or the horse name), level,
--                 handedOver, captured, lost, home }
--     creator     online: the table creator's shown name
--     accounts    the number of distinct accounts seated
--   game_seats  one row per account seat of a played game: the history, the stats and the ranking
--               read it (and played for the details). Its key orders a player's history newest first
--               (keyset paging, no extra index). Written only for an account that still exists.
--     won         0 / 1
--     ranked      0 / 1: online and at least two distinct accounts seated (D-02, D-13)
--     solo        0 / 1
-- Times are ms since the epoch (server time; a solo report's own times). No device token, `who` or
-- card is ever written. Applied locally by the tests and `wrangler dev`; the remote database gets it
-- before the Worker that writes it is deployed.

CREATE TABLE played (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('online', 'solo')),
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  winner TEXT NOT NULL CHECK (winner IN ('bleu-rouge', 'jaune-vert')),
  seats TEXT NOT NULL,
  deals INTEGER NOT NULL,
  creator TEXT,
  accounts INTEGER NOT NULL
);

CREATE TABLE game_seats (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ended_at INTEGER NOT NULL,
  game_id TEXT NOT NULL REFERENCES played(id) ON DELETE CASCADE,
  colour TEXT NOT NULL CHECK (colour IN ('bleu', 'jaune', 'rouge', 'vert')),
  won INTEGER NOT NULL,
  ranked INTEGER NOT NULL,
  solo INTEGER NOT NULL,
  captured INTEGER NOT NULL,
  lost INTEGER NOT NULL,
  home INTEGER NOT NULL,
  PRIMARY KEY (user_id, ended_at, game_id)
) WITHOUT ROWID;
