-- Separate actual wagers/payouts from valid turnover used by turnover promotions.
ALTER TABLE lobby_activity_events ADD COLUMN IF NOT EXISTS valid_bet_amount bigint CHECK(valid_bet_amount >= 0 AND valid_bet_amount <= amount);
ALTER TABLE lobby_activity_events DROP CONSTRAINT IF EXISTS lobby_activity_events_event_type_check;
ALTER TABLE lobby_activity_events ADD CONSTRAINT lobby_activity_events_event_type_check CHECK(event_type IN ('game_bet','game_win','recharge_success'));
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='lobby_activity_daily' AND column_name='bet_amount') THEN
  ALTER TABLE lobby_activity_daily ADD COLUMN bet_amount bigint NOT NULL DEFAULT 0 CHECK(bet_amount >= 0);
  UPDATE lobby_activity_daily d SET bet_amount=COALESCE((SELECT SUM(e.amount) FROM lobby_activity_events e WHERE e.uid=d.uid AND e.business_date=d.business_date AND e.event_type='game_bet'),0);
 END IF;
END $$;
ALTER TABLE lobby_activity_daily ADD COLUMN IF NOT EXISTS win_amount bigint NOT NULL DEFAULT 0 CHECK(win_amount >= 0);
CREATE TABLE IF NOT EXISTS lobby_return_batches (
 claim_id text PRIMARY KEY,
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 reward_group text NOT NULL CHECK(reward_group IN ('rebate','loser_return')),
 claim_date text NOT NULL,
 total_reward bigint NOT NULL CHECK(total_reward > 0),
 coins bigint NOT NULL CHECK(coins >= 0),
 created_at timestamptz NOT NULL,
 UNIQUE(uid,reward_group,claim_date)
);
CREATE TABLE IF NOT EXISTS lobby_return_claims (
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 kind text NOT NULL CHECK(kind IN ('daily','weekly','monthly','loser_return')),
 period_start text NOT NULL,
 period_end text NOT NULL,
 batch_id text NOT NULL REFERENCES lobby_return_batches(claim_id),
 valid_bet bigint NOT NULL CHECK(valid_bet >= 0),
 bet_amount bigint NOT NULL CHECK(bet_amount >= 0),
 win_amount bigint NOT NULL CHECK(win_amount >= 0),
 base_amount bigint NOT NULL CHECK(base_amount >= 0),
 rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),
 reward bigint NOT NULL CHECK(reward > 0),
 PRIMARY KEY(uid,kind,period_start)
);
CREATE INDEX IF NOT EXISTS lobby_return_claims_batch ON lobby_return_claims(batch_id);
