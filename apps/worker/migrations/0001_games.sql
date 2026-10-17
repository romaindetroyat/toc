-- The games table of D1 (plan 02-09, HIST-01 support for phase 5, D-14; 02-RESEARCH Pattern 12).
-- One row per finished online game, written once by the table's Durable Object
-- (INSERT ... ON CONFLICT (game_id) DO NOTHING). Live game state never goes here: the Durable
-- Object's SQLite stays the source of truth for resuming.
--   game_id     table_hash || ':' || game_no
--   table_hash  base64url SHA-256 of the table id (the id itself is a capability, never stored)
--   started_at, ended_at  ms since the epoch (server time)
--   winner      'bleu-rouge' or 'jaune-vert'
--   seats       JSON: [{ colour, kind, name, level, handedOver }] in the order bleu, jaune, rouge, vert
--   deals       deals played
--   captures    JSON: { "bleu-rouge": n, "jaune-vert": n }
-- No device token, person id or card is ever written.
CREATE TABLE games (
  game_id TEXT PRIMARY KEY,
  table_hash TEXT NOT NULL,
  game_no INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  winner TEXT NOT NULL,
  seats TEXT NOT NULL,
  deals INTEGER NOT NULL,
  captures TEXT NOT NULL
);

CREATE INDEX games_table_hash ON games (table_hash);
