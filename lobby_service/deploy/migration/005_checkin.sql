-- Ledger order_id is a general business reference, not exclusively a recharge order.
ALTER TABLE lobby_coin_ledger DROP CONSTRAINT IF EXISTS lobby_coin_ledger_order_id_fkey;
CREATE TABLE IF NOT EXISTS lobby_activity_daily (
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 business_date text NOT NULL,
 valid_bet bigint NOT NULL DEFAULT 0 CHECK(valid_bet >= 0),
 recharge_amount bigint NOT NULL DEFAULT 0 CHECK(recharge_amount >= 0),
 PRIMARY KEY(uid,business_date)
);
CREATE TABLE IF NOT EXISTS lobby_activity_events (
 event_id text PRIMARY KEY,
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 event_type text NOT NULL CHECK(event_type IN ('game_bet','recharge_success')),
 game_id text NOT NULL DEFAULT '',
 amount bigint NOT NULL CHECK(amount > 0),
 occurred_at timestamptz NOT NULL,
 business_date text NOT NULL
);
CREATE TABLE IF NOT EXISTS lobby_checkin_claims (
 claim_id text NOT NULL UNIQUE,
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 business_date text NOT NULL,
 day integer NOT NULL CHECK(day > 0),
 config_version text NOT NULL,
 required_bet bigint NOT NULL CHECK(required_bet >= 0),
 required_recharge bigint NOT NULL CHECK(required_recharge >= 0),
 reward bigint NOT NULL CHECK(reward > 0),
 coins bigint NOT NULL CHECK(coins >= 0),
 created_at timestamptz NOT NULL,
 PRIMARY KEY(uid,business_date)
);
