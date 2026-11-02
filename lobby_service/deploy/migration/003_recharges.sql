CREATE TABLE IF NOT EXISTS lobby_recharge_orders (
 order_id text PRIMARY KEY,
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 request_id text NOT NULL,
 tier_id text NOT NULL,
 amount bigint NOT NULL CHECK(amount > 0),
 bonus bigint NOT NULL CHECK(bonus >= 0),
 fee bigint NOT NULL CHECK(fee >= 0),
 credit_amount bigint NOT NULL CHECK(credit_amount > 0),
 coins bigint NOT NULL CHECK(coins >= 0),
 status text NOT NULL CHECK(status = 'success'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(uid,request_id),
 CHECK(bonus = 0 OR fee = 0),
 CHECK(credit_amount = amount + bonus - fee)
);
CREATE TABLE IF NOT EXISTS lobby_coin_ledger (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 order_id text NOT NULL REFERENCES lobby_recharge_orders(order_id),
 source text NOT NULL,
 delta bigint NOT NULL CHECK(delta <> 0),
 balance_before bigint NOT NULL CHECK(balance_before >= 0),
 balance_after bigint NOT NULL CHECK(balance_after >= 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,source),
 CHECK(balance_after = balance_before + delta)
);
CREATE INDEX IF NOT EXISTS lobby_coin_ledger_user ON lobby_coin_ledger(uid,id);
