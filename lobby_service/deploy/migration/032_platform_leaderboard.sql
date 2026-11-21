ALTER TABLE lobby_users ADD COLUMN IF NOT EXISTS leaderboard_participating boolean NOT NULL DEFAULT true;
ALTER TABLE lobby_users ADD COLUMN IF NOT EXISTS leaderboard_anonymous boolean NOT NULL DEFAULT false;
ALTER TABLE lobby_game_completions ADD COLUMN IF NOT EXISTS leaderboard_participating boolean NOT NULL DEFAULT true;
ALTER TABLE lobby_game_completions ADD COLUMN IF NOT EXISTS leaderboard_anonymous boolean NOT NULL DEFAULT false;
ALTER TABLE lobby_game_completions ADD COLUMN IF NOT EXISTS leaderboard_nickname text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS game_completions_platform_rank ON lobby_game_completions(ended_at,win_amount,bet_amount) WHERE included;
