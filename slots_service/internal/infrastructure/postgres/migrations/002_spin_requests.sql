CREATE TABLE spin_request_tokens (
 scope text NOT NULL, game_id text NOT NULL, token text NOT NULL,
 PRIMARY KEY(scope,game_id)
);
CREATE TABLE spin_request_receipts (
 scope text NOT NULL, game_id text NOT NULL, request_id text NOT NULL,
 data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(scope,game_id,request_id)
);
