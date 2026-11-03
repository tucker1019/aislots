CREATE TABLE IF NOT EXISTS lobby_invite_codes (
 uid bigint PRIMARY KEY REFERENCES lobby_users(uid), code text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lobby_invite_relations (
 invitee_uid bigint PRIMARY KEY REFERENCES lobby_users(uid), inviter_uid bigint NOT NULL REFERENCES lobby_users(uid),
 registered_at timestamptz NOT NULL, deadline timestamptz NOT NULL, config_version text NOT NULL,
 min_deposit_count integer NOT NULL CHECK(min_deposit_count>0), min_deposit_amount bigint NOT NULL CHECK(min_deposit_amount>0),
 min_bet_amount bigint NOT NULL CHECK(min_bet_amount>0), reward_amount bigint NOT NULL CHECK(reward_amount>0),
 CHECK(invitee_uid<>inviter_uid), CHECK(deadline>registered_at)
);
CREATE INDEX IF NOT EXISTS lobby_invite_relations_inviter ON lobby_invite_relations(inviter_uid);
CREATE TABLE IF NOT EXISTS lobby_invite_batches (
 claim_id text PRIMARY KEY, uid bigint NOT NULL REFERENCES lobby_users(uid), request_id text NOT NULL,
 total_reward bigint NOT NULL CHECK(total_reward>0), coins bigint NOT NULL CHECK(coins>=0), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(uid,request_id)
);
CREATE TABLE IF NOT EXISTS lobby_invite_rewards (
 invitee_uid bigint PRIMARY KEY REFERENCES lobby_invite_relations(invitee_uid), inviter_uid bigint NOT NULL REFERENCES lobby_users(uid),
 amount bigint NOT NULL CHECK(amount>0), earned_at timestamptz NOT NULL DEFAULT now(), batch_id text REFERENCES lobby_invite_batches(claim_id), claimed_at timestamptz,
 CHECK((batch_id IS NULL)=(claimed_at IS NULL))
);
CREATE INDEX IF NOT EXISTS lobby_invite_rewards_owner ON lobby_invite_rewards(inviter_uid,batch_id);
