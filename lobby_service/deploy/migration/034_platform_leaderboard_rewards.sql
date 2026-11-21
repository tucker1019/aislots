CREATE TABLE IF NOT EXISTS lobby_platform_leaderboard_rewards (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 business_date date NOT NULL,
 board text NOT NULL CHECK(board IN ('wins','multiplier')),
 rank integer NOT NULL CHECK(rank BETWEEN 1 AND 10),
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 platform_order_id bigint NOT NULL,
 amount bigint NOT NULL CHECK(amount>=0),
 anonymous boolean NOT NULL,
 status text NOT NULL CHECK(status IN ('ineligible','claimable','claimed')),
 claim_id text UNIQUE,
 claimed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(business_date,board,rank)
);
CREATE INDEX IF NOT EXISTS leaderboard_rewards_user ON lobby_platform_leaderboard_rewards(uid,business_date);
