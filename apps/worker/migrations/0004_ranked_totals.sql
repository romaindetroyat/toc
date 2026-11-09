-- The friends ranking's totals (quick task 261109-8v7, Romain 2026-11-09: « On reste gratuit »).
-- GET /api/me/ranking used to sum every ranked game_seats row of the circle on each opening, so the
-- rows read grew with the history and would one day reach the D1 Free plan's daily read limit. It now
-- reads one ranked_totals row per member of the circle.
--   ranked_totals  one row per account that has played at least one ranked game (ranked = 1 in
--                  game_seats: online, two accounts or more; never solo): games and wins.
-- The trigger keeps it in step with game_seats: it fires only for a row really inserted (an
-- INSERT … ON CONFLICT DO NOTHING that ignores a resend inserts nothing, so it counts nothing), in the
-- same transaction as the insert. game_seats rows are never updated nor deleted on their own; an
-- account's deletion removes its seats and its totals together (ON DELETE CASCADE). The rows already
-- recorded are counted once below. 0001 to 0003 are never edited.

CREATE TABLE ranked_totals (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  games INTEGER NOT NULL,
  wins INTEGER NOT NULL
) WITHOUT ROWID;

INSERT INTO ranked_totals (user_id, games, wins)
  SELECT user_id, COUNT(*), SUM(won) FROM game_seats WHERE ranked = 1 GROUP BY user_id;

CREATE TRIGGER game_seats_ranked_totals AFTER INSERT ON game_seats
  WHEN NEW.ranked = 1
BEGIN
  INSERT INTO ranked_totals (user_id, games, wins) VALUES (NEW.user_id, 1, NEW.won)
    ON CONFLICT (user_id) DO UPDATE SET games = games + 1, wins = wins + excluded.wins;
END;
