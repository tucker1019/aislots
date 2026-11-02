CREATE TABLE IF NOT EXISTS lobby_users (
 uid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 account text UNIQUE,
 password_hash text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((account IS NULL) = (password_hash IS NULL))
);
CREATE TABLE IF NOT EXISTS lobby_sessions (
 sid_hash text PRIMARY KEY,
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lobby_sessions_uid ON lobby_sessions(uid);
