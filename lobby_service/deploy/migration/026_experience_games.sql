-- Existing accounts keep the game they have always played.
ALTER TABLE lobby_experience_accounts ADD COLUMN IF NOT EXISTS game_id text NOT NULL DEFAULT 'AG1';
CREATE INDEX IF NOT EXISTS lobby_experience_accounts_game_due ON lobby_experience_accounts(game_id,next_at) WHERE NOT stopped;
CREATE OR REPLACE FUNCTION lobby_immutable_experience_game() RETURNS trigger AS $$ BEGIN
 IF NEW.game_id<>OLD.game_id THEN RAISE EXCEPTION 'experience game is immutable'; END IF; RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS immutable_experience_game ON lobby_experience_accounts;
CREATE TRIGGER immutable_experience_game BEFORE UPDATE OF game_id ON lobby_experience_accounts FOR EACH ROW EXECUTE FUNCTION lobby_immutable_experience_game();
