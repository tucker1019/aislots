CREATE TABLE IF NOT EXISTS outbox_events (
    id bigserial PRIMARY KEY,
    event_key text NOT NULL UNIQUE,
    event_type text NOT NULL,
    aggregate_id text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed')),
    attempts integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_events_pending_idx ON outbox_events (available_at, id) WHERE status IN ('pending', 'failed');
