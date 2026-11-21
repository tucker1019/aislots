CREATE TABLE IF NOT EXISTS lobby_game_recommendation_edges (
 scene text NOT NULL CHECK (scene IN ('favorites', 'game_play')),
 user_id bigint NOT NULL DEFAULT 0,
 source_game_id text NOT NULL,
 target_game_id text NOT NULL,
 score numeric(30,10) NOT NULL CHECK (score >= 0),
 support_users bigint NOT NULL CHECK (support_users >= 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (scene, user_id, source_game_id, target_game_id),
 CHECK (source_game_id <> target_game_id)
);
CREATE INDEX IF NOT EXISTS game_recommendation_read
 ON lobby_game_recommendation_edges(scene, user_id, source_game_id, score DESC, support_users DESC, target_game_id);
CREATE INDEX IF NOT EXISTS game_favorites_activity
 ON lobby_game_favorites(created_at, uid, game_id);
CREATE INDEX IF NOT EXISTS game_completions_recommendation_window
 ON lobby_game_completions(started_at, account_type, uid, game_id);
