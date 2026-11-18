-- Policy records retain legacy values; unpaid rewards use the current published configuration.
ALTER TABLE lobby_return_rate_rules ADD COLUMN IF NOT EXISTS platform_fee_rate_bps integer NOT NULL DEFAULT 0 CHECK(platform_fee_rate_bps BETWEEN 0 AND 10000);
ALTER TABLE lobby_return_rate_rules ADD COLUMN IF NOT EXISTS reward_sources jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS lobby_coin_ledger_reward_period ON lobby_coin_ledger(uid,created_at,source) WHERE delta>0;
