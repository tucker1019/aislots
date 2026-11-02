-- Idempotent upgrade: preserve existing profiles and initialize old users once.
ALTER TABLE lobby_users ADD COLUMN IF NOT EXISTS nickname text;
ALTER TABLE lobby_users ADD COLUMN IF NOT EXISTS avatar_id integer;
UPDATE lobby_users SET nickname = 'player_' || uid::text WHERE nickname IS NULL;
UPDATE lobby_users SET avatar_id = floor(random() * 15)::integer + 1 WHERE avatar_id IS NULL;
ALTER TABLE lobby_users ALTER COLUMN nickname SET NOT NULL;
ALTER TABLE lobby_users ALTER COLUMN avatar_id SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lobby_users_avatar_range' AND conrelid = 'lobby_users'::regclass) THEN
  ALTER TABLE lobby_users ADD CONSTRAINT lobby_users_avatar_range CHECK (avatar_id BETWEEN 1 AND 15);
 END IF;
END $$;

-- Balance has its own table; user profile updates cannot modify it.
CREATE TABLE IF NOT EXISTS lobby_wallet_balances (
 uid bigint PRIMARY KEY REFERENCES lobby_users(uid),
 coins bigint NOT NULL DEFAULT 0 CHECK (coins >= 0)
);
INSERT INTO lobby_wallet_balances(uid) SELECT uid FROM lobby_users ON CONFLICT DO NOTHING;
