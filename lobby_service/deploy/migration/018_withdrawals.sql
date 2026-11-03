CREATE TABLE IF NOT EXISTS lobby_withdrawal_orders (
 order_id text PRIMARY KEY, uid bigint NOT NULL REFERENCES lobby_users(uid), request_id text NOT NULL,
 tier_id text NOT NULL, channel text NOT NULL, account text NOT NULL, name text NOT NULL,
 amount bigint NOT NULL CHECK(amount>0), fee bigint NOT NULL CHECK(fee>=0 AND fee<amount), bonus bigint NOT NULL CHECK(bonus>=0 AND (fee=0 OR bonus=0)),
 status text NOT NULL CHECK(status IN ('pending','success','failed')), created_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz,
 UNIQUE(uid,request_id)
);
CREATE INDEX IF NOT EXISTS lobby_withdrawal_user_time ON lobby_withdrawal_orders(uid,created_at DESC,order_id DESC);
ALTER TABLE lobby_payout_accounts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
UPDATE lobby_payout_accounts SET created_at=LEAST(created_at,updated_at) WHERE created_at>updated_at;
