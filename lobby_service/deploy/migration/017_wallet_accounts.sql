CREATE TABLE IF NOT EXISTS lobby_payout_accounts (
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 channel text NOT NULL CHECK (channel IN ('test1', 'test2')),
 account text NOT NULL CHECK (char_length(account) BETWEEN 1 AND 128),
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (uid, channel)
);
