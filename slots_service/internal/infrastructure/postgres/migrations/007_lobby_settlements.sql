-- A durable intent is committed before calling the lobby. Game state is committed only after confirmation.
CREATE TABLE IF NOT EXISTS lobby_pending_settlements (
 scope text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
