CREATE TABLE IF NOT EXISTS game_statistics_sequences (game_id text NOT NULL,uid text NOT NULL,sequence bigint NOT NULL,PRIMARY KEY(game_id,uid));
CREATE TABLE IF NOT EXISTS game_statistics_outbox (
 id bigserial PRIMARY KEY,game_id text NOT NULL,uid text NOT NULL,bet_id text NOT NULL UNIQUE,sequence bigint NOT NULL,
 bet_amount bigint NOT NULL,win_amount bigint NOT NULL,started_at timestamptz NOT NULL,ended_at timestamptz NOT NULL,delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS statistics_outbox_pending ON game_statistics_outbox(id) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS statistics_outbox_stream ON game_statistics_outbox(game_id,uid,sequence) WHERE delivered_at IS NULL;
