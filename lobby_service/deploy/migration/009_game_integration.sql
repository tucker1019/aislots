CREATE TABLE IF NOT EXISTS lobby_game_tickets (
 token_hash text PRIMARY KEY, uid bigint NOT NULL REFERENCES lobby_users(uid), game_id text NOT NULL,
 expires_at timestamptz NOT NULL, exchange_id text NOT NULL DEFAULT '', exchanged_at timestamptz
);
CREATE INDEX IF NOT EXISTS lobby_game_tickets_expiry ON lobby_game_tickets(expires_at);
CREATE TABLE IF NOT EXISTS lobby_game_settlements (
 request_id text PRIMARY KEY, uid bigint NOT NULL REFERENCES lobby_users(uid), game_id text NOT NULL,
 bet_id text NOT NULL, debit bigint NOT NULL CHECK(debit>=0), credit bigint NOT NULL CHECK(credit>=0),
 status text NOT NULL CHECK(status IN ('confirmed','rejected')), coins bigint NOT NULL CHECK(coins>=0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lobby_game_one_debit ON lobby_game_settlements(bet_id) WHERE debit>0 AND status='confirmed';
