CREATE TABLE IF NOT EXISTS game_sessions (
 token_hash text PRIMARY KEY,
 data jsonb NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_sessions_expiry ON game_sessions(expires_at);
-- Test adapter only. Real platform users never get a local wallet.
CREATE TABLE IF NOT EXISTS test_wallets (
 appname text NOT NULL, appkey text NOT NULL, uid text NOT NULL, currency text NOT NULL,
 balance bigint NOT NULL CHECK(balance >= 0),
 PRIMARY KEY(appname, appkey, uid, currency)
);
CREATE TABLE IF NOT EXISTS bet_tickets (
 id text PRIMARY KEY,
 appname text NOT NULL, appkey text NOT NULL, uid text NOT NULL,
 status text NOT NULL CHECK(status IN ('prepared','active','complete','expired')),
 data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_bet_per_subject ON bet_tickets(appname,appkey,uid) WHERE status IN ('prepared','active');
CREATE TABLE IF NOT EXISTS bet_orders (
 bet_id text PRIMARY KEY REFERENCES bet_tickets(id),
 status text NOT NULL, data jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS player_game_states (
 appname text NOT NULL, appkey text NOT NULL, uid text NOT NULL,
 game_id text NOT NULL,country text NOT NULL,currency text NOT NULL,data jsonb NOT NULL,
 PRIMARY KEY(appname,appkey,uid,game_id,country,currency)
);
CREATE TABLE IF NOT EXISTS game_spins (
 bet_id text NOT NULL REFERENCES bet_tickets(id),spin_index integer NOT NULL CHECK(spin_index>=0),
 data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(bet_id,spin_index)
);
CREATE TABLE IF NOT EXISTS spin_steps (
 bet_id text NOT NULL,spin_index integer NOT NULL,step_index integer NOT NULL CHECK(step_index>=1),
 response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(bet_id,spin_index,step_index),
 FOREIGN KEY(bet_id,spin_index) REFERENCES game_spins(bet_id,spin_index)
);
CREATE TABLE IF NOT EXISTS test_wallet_ledger (
 operation_id text PRIMARY KEY,
 appname text NOT NULL,appkey text NOT NULL,uid text NOT NULL,currency text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('debit','credit')),amount bigint NOT NULL,balance_after bigint NOT NULL CHECK(balance_after>=0),
 created_at timestamptz NOT NULL DEFAULT now()
);
