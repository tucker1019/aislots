-- No INSERT SELECT from historical ledgers/events: only new postings participate.
CREATE TABLE IF NOT EXISTS lobby_turnover_activation (
 id integer PRIMARY KEY CHECK(id=1), activated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO lobby_turnover_activation(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS lobby_turnover_rules (
 source text PRIMARY KEY, multiplier bigint NOT NULL CHECK(multiplier BETWEEN 0 AND 1000000), version text NOT NULL
);
INSERT INTO lobby_turnover_rules(source,multiplier,version) VALUES
 ('rch_001',1,'turnover-v1'),('rch_002',1,'turnover-v1'),('act_001',1,'turnover-v1'),
 ('act_002',1,'turnover-v1'),('act_003',1,'turnover-v1'),('act_004',1,'turnover-v1'),
 ('act_005',1,'turnover-v1'),('vip_001',1,'turnover-v1'),('vip_002',1,'turnover-v1'),
 ('vip_003',1,'turnover-v1'),('act_006',1,'turnover-v1'),('act_007',1,'turnover-v1'),
 ('agt_001',1,'turnover-v1'),('wdr_003',1,'turnover-v1'),('game_002',0,'turnover-v1'),('wdr_002',0,'turnover-v1')
 ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS lobby_turnover_balances (
 uid bigint PRIMARY KEY REFERENCES lobby_users(uid), remaining bigint NOT NULL DEFAULT 0 CHECK(remaining>=0)
);
CREATE TABLE IF NOT EXISTS lobby_turnover_entries (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, uid bigint NOT NULL REFERENCES lobby_users(uid),
 credit_ledger_id bigint UNIQUE REFERENCES lobby_coin_ledger(id), event_id text UNIQUE REFERENCES lobby_activity_events(event_id),
 source text NOT NULL, amount bigint NOT NULL CHECK(amount>=0), multiplier bigint NOT NULL CHECK(multiplier>=0), version text NOT NULL,
 added bigint NOT NULL CHECK(added>=0), valid_bet bigint NOT NULL CHECK(valid_bet>=0), applied bigint NOT NULL CHECK(applied>=0),
 remaining_before bigint NOT NULL CHECK(remaining_before>=0), remaining_after bigint NOT NULL CHECK(remaining_after>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((credit_ledger_id IS NOT NULL AND event_id IS NULL) OR (credit_ledger_id IS NULL AND event_id IS NOT NULL)),
 CHECK(applied<=valid_bet), CHECK(remaining_before+added=remaining_after+applied)
);
CREATE INDEX IF NOT EXISTS lobby_turnover_entries_user ON lobby_turnover_entries(uid,id DESC);

CREATE OR REPLACE FUNCTION lobby_apply_turnover(p_uid bigint,p_ledger bigint,p_event text,p_source text,p_amount bigint,p_multiplier bigint,p_version text,p_bet bigint) RETURNS void AS $$
DECLARE old_remaining bigint; new_remaining bigint; added bigint; applied bigint;
BEGIN
 -- Same lock order as all wallet operations, including withdrawal creation.
 PERFORM 1 FROM lobby_wallet_balances WHERE uid=p_uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'turnover wallet missing'; END IF;
 INSERT INTO lobby_turnover_balances(uid) VALUES(p_uid) ON CONFLICT DO NOTHING;
 SELECT remaining INTO old_remaining FROM lobby_turnover_balances WHERE uid=p_uid FOR UPDATE;
 added:=p_amount*p_multiplier;
 applied:=LEAST(old_remaining,p_bet);
 new_remaining:=old_remaining+added-applied;
 INSERT INTO lobby_turnover_entries(uid,credit_ledger_id,event_id,source,amount,multiplier,version,added,valid_bet,applied,remaining_before,remaining_after)
 VALUES(p_uid,p_ledger,p_event,p_source,p_amount,p_multiplier,p_version,added,p_bet,applied,old_remaining,new_remaining);
 UPDATE lobby_turnover_balances SET remaining=new_remaining WHERE uid=p_uid;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION lobby_credit_turnover() RETURNS trigger AS $$
DECLARE rule lobby_turnover_rules%ROWTYPE;
BEGIN
 IF NEW.delta<=0 OR NEW.source IN ('game_002','wdr_002') OR NEW.created_at<(SELECT activated_at FROM lobby_turnover_activation WHERE id=1) THEN RETURN NEW; END IF;
 SELECT * INTO rule FROM lobby_turnover_rules WHERE source=NEW.source;
 IF NOT FOUND THEN RAISE EXCEPTION 'turnover credit source not configured'; END IF;
 PERFORM lobby_apply_turnover(NEW.uid,NEW.id,NULL::text,NEW.source,NEW.delta,rule.multiplier,rule.version,0::bigint);
 RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS credit_turnover ON lobby_coin_ledger;
CREATE TRIGGER credit_turnover AFTER INSERT ON lobby_coin_ledger FOR EACH ROW EXECUTE FUNCTION lobby_credit_turnover();

CREATE OR REPLACE FUNCTION lobby_bet_turnover() RETURNS trigger AS $$
DECLARE valid bigint;
BEGIN
 IF NEW.event_type<>'game_bet' OR NEW.occurred_at<(SELECT activated_at FROM lobby_turnover_activation WHERE id=1) THEN RETURN NEW; END IF;
 valid:=COALESCE(NEW.valid_bet_amount,NEW.amount);
 IF valid<0 THEN RAISE EXCEPTION 'negative valid turnover'; END IF;
 PERFORM lobby_apply_turnover(NEW.uid,NULL::bigint,NEW.event_id,'game_001',0::bigint,0::bigint,''::text,valid);
 RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS bet_turnover ON lobby_activity_events;
CREATE TRIGGER bet_turnover AFTER INSERT ON lobby_activity_events FOR EACH ROW EXECUTE FUNCTION lobby_bet_turnover();
