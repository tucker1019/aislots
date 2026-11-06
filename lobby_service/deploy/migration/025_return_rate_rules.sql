-- A rule applies by the activity period's local start date, not claim time.
-- Baselines are initialized from the existing published configuration by admin seeding.
CREATE TABLE IF NOT EXISTS lobby_return_rate_rules (
 kind text NOT NULL CHECK(kind IN ('daily','weekly','monthly','loser_return')),
 effective_from date NOT NULL,
 rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(kind,effective_from)
);
