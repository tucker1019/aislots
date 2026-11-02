CREATE TABLE IF NOT EXISTS lobby_newbie_recharges (
 uid bigint PRIMARY KEY REFERENCES lobby_users(uid),
 starts_at timestamptz NOT NULL,
 enrolled_at timestamptz NOT NULL DEFAULT now(),
 ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 duration_days integer NOT NULL CHECK(duration_days>0),
 config_version text NOT NULL,
 expire_unclaimed boolean NOT NULL
);
CREATE TABLE IF NOT EXISTS lobby_newbie_claim_batches (
 claim_id text PRIMARY KEY,
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 request_id text NOT NULL,
 total_reward bigint NOT NULL CHECK(total_reward>0),
 coins bigint NOT NULL CHECK(coins>=0),
 created_at timestamptz NOT NULL,
 UNIQUE(uid,request_id)
);
CREATE TABLE IF NOT EXISTS lobby_newbie_recharge_tiers (
 uid bigint NOT NULL REFERENCES lobby_newbie_recharges(uid),
 tier_id text NOT NULL,
 required_recharge bigint NOT NULL CHECK(required_recharge>0),
 reward bigint NOT NULL CHECK(reward>0),
 batch_id text REFERENCES lobby_newbie_claim_batches(claim_id),
 PRIMARY KEY(uid,tier_id),
 UNIQUE(uid,required_recharge)
);
CREATE INDEX IF NOT EXISTS lobby_newbie_tiers_batch ON lobby_newbie_recharge_tiers(batch_id);
CREATE INDEX IF NOT EXISTS lobby_recharge_success_time ON lobby_recharge_orders(uid,COALESCE(settled_at,created_at)) WHERE status='success';

ALTER TABLE lobby_newbie_recharges ADD COLUMN IF NOT EXISTS enrolled_at timestamptz NOT NULL DEFAULT now();
