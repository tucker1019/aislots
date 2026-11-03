CREATE TABLE IF NOT EXISTS lobby_game_statistics_epoch (id integer PRIMARY KEY CHECK(id=1), started_at timestamptz NOT NULL DEFAULT now());
INSERT INTO lobby_game_statistics_epoch(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS lobby_game_completions (
 game_id text NOT NULL, bet_id text NOT NULL, uid bigint NOT NULL REFERENCES lobby_users(uid), sequence bigint NOT NULL CHECK(sequence>0),
 bet_amount bigint NOT NULL CHECK(bet_amount>0), win_amount bigint NOT NULL CHECK(win_amount>=0), started_at timestamptz NOT NULL, ended_at timestamptz NOT NULL, included boolean NOT NULL,
 PRIMARY KEY(game_id,bet_id), UNIQUE(game_id,uid,sequence)
);
CREATE INDEX IF NOT EXISTS game_completions_player ON lobby_game_completions(game_id,uid,started_at);
CREATE TABLE IF NOT EXISTS lobby_game_rtp_minutes (
 game_id text NOT NULL, minute timestamptz NOT NULL, bet_amount numeric(38,0) NOT NULL, win_amount numeric(38,0) NOT NULL, rounds bigint NOT NULL,
 PRIMARY KEY(game_id,minute)
);
CREATE TABLE IF NOT EXISTS lobby_game_streaks (
 game_id text NOT NULL, uid bigint NOT NULL REFERENCES lobby_users(uid), last_sequence bigint NOT NULL DEFAULT 0, current_streak bigint NOT NULL DEFAULT 0, run_id bigint NOT NULL DEFAULT 0,
 PRIMARY KEY(game_id,uid)
);
CREATE TABLE IF NOT EXISTS lobby_game_streak_days (
 game_id text NOT NULL, uid bigint NOT NULL, run_id bigint NOT NULL, day date NOT NULL, wins bigint NOT NULL,
 PRIMARY KEY(game_id,uid,run_id,day)
);
CREATE TABLE IF NOT EXISTS lobby_game_rank_candidates (
 game_id text NOT NULL, period text NOT NULL, board text NOT NULL, entry_key text NOT NULL, uid bigint NOT NULL REFERENCES lobby_users(uid), bet_id text NOT NULL,
 score numeric(100,50) NOT NULL, bet_amount bigint NOT NULL, win_amount bigint NOT NULL, streak bigint NOT NULL DEFAULT 0, ended_at timestamptz NOT NULL,
 PRIMARY KEY(game_id,period,board,entry_key)
);
CREATE INDEX IF NOT EXISTS game_rank_read ON lobby_game_rank_candidates(game_id,period,board,score DESC,ended_at,entry_key);
ALTER TABLE lobby_game_rank_candidates ALTER COLUMN score TYPE numeric(100,50);
