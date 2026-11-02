CREATE TABLE IF NOT EXISTS lobby_vip_states (
 uid bigint PRIMARY KEY REFERENCES lobby_users(uid),
 level integer NOT NULL DEFAULT 0 CHECK(level >= 0),
 highest_level integer NOT NULL DEFAULT 0 CHECK(highest_level >= level),
 upgrade_bet bigint NOT NULL DEFAULT 0 CHECK(upgrade_bet >= 0),
 upgrade_recharge bigint NOT NULL DEFAULT 0 CHECK(upgrade_recharge >= 0),
 idle_since timestamptz NOT NULL,
 protection_start timestamptz,
 protection_end timestamptz,
 protection_bet bigint NOT NULL DEFAULT 0 CHECK(protection_bet >= 0),
 protection_recharge bigint NOT NULL DEFAULT 0 CHECK(protection_recharge >= 0),
 protection_required_bet bigint NOT NULL DEFAULT 0 CHECK(protection_required_bet >= 0),
 protection_required_recharge bigint NOT NULL DEFAULT 0 CHECK(protection_required_recharge >= 0),
 protection_version text NOT NULL DEFAULT '',
 next_weekly_at timestamptz NOT NULL,
 next_monthly_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS lobby_vip_claim_batches (
 claim_id text PRIMARY KEY,
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 kind text NOT NULL CHECK(kind IN ('upgrade','weekly','monthly')),
 request_id text NOT NULL,
 total_reward bigint NOT NULL CHECK(total_reward > 0),
 coins bigint NOT NULL CHECK(coins >= 0),
 created_at timestamptz NOT NULL,
 UNIQUE(uid,kind,request_id)
);
CREATE TABLE IF NOT EXISTS lobby_vip_rewards (
 reward_id text PRIMARY KEY,
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 kind text NOT NULL CHECK(kind IN ('upgrade','weekly','monthly')),
 reward_key text NOT NULL,
 level integer NOT NULL CHECK(level>=0),
 amount bigint NOT NULL CHECK(amount>=0),
 status text NOT NULL CHECK(status IN ('pending','claimed','ineligible','no_reward')),
 period_start text NOT NULL DEFAULT '',
 period_end text NOT NULL DEFAULT '',
 available_at timestamptz NOT NULL,
 expires_at timestamptz,
 required_bet bigint NOT NULL DEFAULT 0,
 required_recharge bigint NOT NULL DEFAULT 0,
 actual_bet bigint NOT NULL DEFAULT 0,
 actual_recharge bigint NOT NULL DEFAULT 0,
 batch_id text REFERENCES lobby_vip_claim_batches(claim_id),
 config_version text NOT NULL,
 UNIQUE(uid,kind,reward_key)
);
CREATE INDEX IF NOT EXISTS lobby_vip_rewards_claim ON lobby_vip_rewards(uid,kind,status);
CREATE INDEX IF NOT EXISTS lobby_vip_rewards_batch ON lobby_vip_rewards(batch_id);
CREATE INDEX IF NOT EXISTS lobby_vip_next_weekly ON lobby_vip_states(next_weekly_at,uid);
CREATE INDEX IF NOT EXISTS lobby_vip_next_monthly ON lobby_vip_states(next_monthly_at,uid);
CREATE INDEX IF NOT EXISTS lobby_vip_protection_due ON lobby_vip_states(protection_end,uid) WHERE protection_end IS NOT NULL;
CREATE INDEX IF NOT EXISTS lobby_vip_idle_due ON lobby_vip_states(idle_since,uid) WHERE level>0 AND protection_end IS NULL;
