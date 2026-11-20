CREATE TABLE IF NOT EXISTS lobby_game_favorites (
 uid bigint NOT NULL REFERENCES lobby_users(uid) ON DELETE CASCADE,
 game_id text NOT NULL CHECK (length(game_id) BETWEEN 1 AND 64),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (uid, game_id)
);
