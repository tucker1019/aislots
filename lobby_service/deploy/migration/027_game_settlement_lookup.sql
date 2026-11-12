-- The statistics consumer checks both debit and credit records for one bet.
-- lobby_game_one_debit cannot serve this lookup because it excludes credits.
-- For an existing large table, create this index CONCURRENTLY as a separate
-- maintenance statement before restart; the idempotent startup DDL then skips it.
CREATE INDEX IF NOT EXISTS lobby_game_settlements_confirmed_bet
 ON lobby_game_settlements(uid,game_id,bet_id)
 INCLUDE(debit,credit,created_at)
 WHERE status='confirmed';
