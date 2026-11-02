-- 只读回放分享能力。仅保存凭据哈希，不将其当作登录会话。
CREATE TABLE replay_shares (
 token_hash text PRIMARY KEY,
 bet_id text NOT NULL REFERENCES bet_tickets(id),
 game_id text NOT NULL,
 session_data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX replay_shares_bet ON replay_shares(bet_id);
