ALTER TABLE lobby_users ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'real' CHECK(account_type IN ('real','experience'));
CREATE TABLE IF NOT EXISTS lobby_experience_accounts (
 id integer PRIMARY KEY CHECK(id=1),uid bigint NOT NULL UNIQUE REFERENCES lobby_users(uid),
 request_id text NOT NULL DEFAULT '',bet bigint NOT NULL DEFAULT 0,bet_level integer NOT NULL DEFAULT 0,
 next_at timestamptz NOT NULL DEFAULT now(),last_bet_id text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lobby_experience_events (
 event_id text PRIMARY KEY,uid bigint NOT NULL REFERENCES lobby_users(uid),event_type text NOT NULL,game_id text NOT NULL,
 amount bigint NOT NULL,occurred_at timestamptz NOT NULL,business_date date NOT NULL
);
CREATE OR REPLACE FUNCTION lobby_immutable_account_type() RETURNS trigger AS $$ BEGIN
 IF NEW.account_type<>OLD.account_type THEN RAISE EXCEPTION 'account type is immutable'; END IF; RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS immutable_account_type ON lobby_users;
CREATE TRIGGER immutable_account_type BEFORE UPDATE OF account_type ON lobby_users FOR EACH ROW EXECUTE FUNCTION lobby_immutable_account_type();
ALTER TABLE lobby_game_settlements ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'real';
ALTER TABLE lobby_game_completions ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'real';
ALTER TABLE lobby_coin_ledger ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'real';
CREATE OR REPLACE FUNCTION lobby_snapshot_account_type() RETURNS trigger AS $$ BEGIN
 SELECT account_type INTO STRICT NEW.account_type FROM lobby_users WHERE uid=NEW.uid; RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS snapshot_account_type ON lobby_game_settlements;
CREATE TRIGGER snapshot_account_type BEFORE INSERT ON lobby_game_settlements FOR EACH ROW EXECUTE FUNCTION lobby_snapshot_account_type();
DROP TRIGGER IF EXISTS snapshot_account_type ON lobby_game_completions;
CREATE TRIGGER snapshot_account_type BEFORE INSERT ON lobby_game_completions FOR EACH ROW EXECUTE FUNCTION lobby_snapshot_account_type();
DROP TRIGGER IF EXISTS snapshot_account_type ON lobby_coin_ledger;
CREATE TRIGGER snapshot_account_type BEFORE INSERT ON lobby_coin_ledger FOR EACH ROW EXECUTE FUNCTION lobby_snapshot_account_type();
CREATE INDEX IF NOT EXISTS lobby_settlement_type_time ON lobby_game_settlements(account_type,created_at);
CREATE OR REPLACE VIEW lobby_bet_statistics_by_account_type AS
 SELECT account_type,game_id,(created_at AT TIME ZONE 'UTC')::date AS utc_date,
 COUNT(*) FILTER(WHERE debit>0) AS paid_bets,COUNT(DISTINCT uid) FILTER(WHERE debit>0) AS bettors,
 SUM(debit)::numeric AS bet_amount,SUM(credit)::numeric AS win_amount
 FROM lobby_game_settlements WHERE status='confirmed' GROUP BY account_type,game_id,(created_at AT TIME ZONE 'UTC')::date;
INSERT INTO lobby_turnover_rules(source,multiplier,version) VALUES('exp_001',0,'experience-v1') ON CONFLICT DO NOTHING;
