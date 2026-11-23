ALTER TABLE lobby_platform_leaderboard_rewards ADD COLUMN IF NOT EXISTS available_at timestamptz;
ALTER TABLE lobby_platform_leaderboard_rewards ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE lobby_platform_leaderboard_rewards
 SET available_at=COALESCE(available_at,created_at),
     expires_at=COALESCE(expires_at,created_at + interval '1 day');
ALTER TABLE lobby_platform_leaderboard_rewards ALTER COLUMN available_at SET NOT NULL;
ALTER TABLE lobby_platform_leaderboard_rewards ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE lobby_platform_leaderboard_rewards DROP CONSTRAINT IF EXISTS lobby_platform_leaderboard_rewards_status_check;
ALTER TABLE lobby_platform_leaderboard_rewards ADD CONSTRAINT lobby_platform_leaderboard_rewards_status_check CHECK(status IN ('ineligible','claimable','claimed','expired'));
CREATE INDEX IF NOT EXISTS leaderboard_rewards_expiry ON lobby_platform_leaderboard_rewards(expires_at) WHERE status='claimable';
CREATE INDEX IF NOT EXISTS lobby_activity_daily_business_date ON lobby_activity_daily(business_date,uid);

CREATE TABLE IF NOT EXISTS lobby_reward_notification_periods (
 reward_type text NOT NULL CHECK(reward_type IN ('rebate_daily','rebate_weekly','rebate_monthly','loss_return','leaderboard')),
 period_start date NOT NULL,
 period_end date NOT NULL,
 board text NOT NULL DEFAULT '' CHECK(board IN ('','wins','multiplier')),
 available_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 send_on_settlement boolean NOT NULL,
 reminder_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
 send_on_expired boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(reward_type,period_start,board),
 CHECK(period_end > period_start),
 CHECK(expires_at > available_at)
);

CREATE TABLE IF NOT EXISTS lobby_reward_notification_targets (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 reward_type text NOT NULL,
 period_start date NOT NULL,
 board text NOT NULL DEFAULT '',
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 reward_amount bigint NOT NULL CHECK(reward_amount > 0),
 rank integer NOT NULL DEFAULT 0,
 action_path text NOT NULL CHECK(action_path IN ('/earn','/platform-leaderboard')),
 available_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 send_on_settlement boolean NOT NULL,
 reminder_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
 send_on_expired boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(uid,reward_type,period_start,board),
 CHECK(expires_at > available_at)
);
CREATE INDEX IF NOT EXISTS lobby_reward_notification_targets_due ON lobby_reward_notification_targets(available_at,expires_at,id);
CREATE INDEX IF NOT EXISTS lobby_reward_notification_targets_user ON lobby_reward_notification_targets(uid,id DESC);

CREATE TABLE IF NOT EXISTS lobby_player_mails (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 target_id bigint NOT NULL REFERENCES lobby_reward_notification_targets(id),
 stage_key text NOT NULL,
 sent_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 read_at timestamptz,
 deleted_at timestamptz,
 UNIQUE(target_id,stage_key)
);
CREATE INDEX IF NOT EXISTS lobby_player_mails_inbox ON lobby_player_mails(uid,id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS lobby_player_mails_unread ON lobby_player_mails(uid,id DESC) WHERE deleted_at IS NULL AND read_at IS NULL;

CREATE TABLE IF NOT EXISTS lobby_reward_notification_dispatches (
 target_id bigint NOT NULL REFERENCES lobby_reward_notification_targets(id),
 stage_key text NOT NULL,
 status text NOT NULL CHECK(status IN ('sent','skipped')),
 mail_id bigint REFERENCES lobby_player_mails(id),
 processed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(target_id,stage_key),
 CHECK((status='sent' AND mail_id IS NOT NULL) OR (status='skipped' AND mail_id IS NULL))
);
