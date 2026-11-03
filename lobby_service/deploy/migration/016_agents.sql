-- Permanent ancestor index. A branch is the first child below the ancestor.
CREATE TABLE IF NOT EXISTS lobby_agent_paths (
 ancestor_uid bigint NOT NULL REFERENCES lobby_users(uid), descendant_uid bigint NOT NULL REFERENCES lobby_users(uid),
 branch_uid bigint NOT NULL REFERENCES lobby_users(uid), depth integer NOT NULL CHECK(depth>0), effective_at timestamptz NOT NULL,
 PRIMARY KEY(ancestor_uid,descendant_uid), CHECK(ancestor_uid<>descendant_uid)
);
CREATE INDEX IF NOT EXISTS agent_paths_descendant ON lobby_agent_paths(descendant_uid,ancestor_uid);
WITH RECURSIVE paths AS (
 SELECT inviter_uid AS a,invitee_uid AS d,invitee_uid AS b,1 AS n,registered_at AS t,ARRAY[inviter_uid,invitee_uid] AS visited FROM lobby_invite_relations
 UNION ALL SELECT p.a,r.invitee_uid,p.b,p.n+1,GREATEST(p.t,r.registered_at),p.visited||r.invitee_uid FROM paths p JOIN lobby_invite_relations r ON r.inviter_uid=p.d WHERE NOT r.invitee_uid=ANY(p.visited)
) INSERT INTO lobby_agent_paths SELECT a,d,b,n,t FROM paths ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION lobby_agent_bind_path() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM lobby_agent_paths WHERE ancestor_uid=NEW.invitee_uid AND descendant_uid=NEW.inviter_uid) THEN RAISE EXCEPTION 'cyclic agent relation'; END IF;
 INSERT INTO lobby_agent_paths VALUES(NEW.inviter_uid,NEW.invitee_uid,NEW.invitee_uid,1,NEW.registered_at);
 INSERT INTO lobby_agent_paths SELECT ancestor_uid,NEW.invitee_uid,branch_uid,depth+1,GREATEST(effective_at,NEW.registered_at) FROM lobby_agent_paths WHERE descendant_uid=NEW.inviter_uid;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agent_bind_path ON lobby_invite_relations;
CREATE TRIGGER agent_bind_path AFTER INSERT ON lobby_invite_relations FOR EACH ROW EXECUTE FUNCTION lobby_agent_bind_path();
CREATE TABLE IF NOT EXISTS lobby_agent_queue (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,business_date text NOT NULL,event_id text NOT NULL UNIQUE);
-- Upgrade early development schemas without losing queued dates.
ALTER TABLE lobby_agent_queue ADD COLUMN IF NOT EXISTS id bigint GENERATED ALWAYS AS IDENTITY;
ALTER TABLE lobby_agent_queue ADD COLUMN IF NOT EXISTS event_id text;
UPDATE lobby_agent_queue SET event_id='bootstrap:'||business_date WHERE event_id IS NULL;
ALTER TABLE lobby_agent_queue ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE lobby_agent_queue DROP CONSTRAINT IF EXISTS lobby_agent_queue_pkey;
ALTER TABLE lobby_agent_queue ADD PRIMARY KEY(id);
CREATE UNIQUE INDEX IF NOT EXISTS agent_queue_event ON lobby_agent_queue(event_id);
CREATE INDEX IF NOT EXISTS agent_queue_date ON lobby_agent_queue(business_date);
CREATE OR REPLACE FUNCTION lobby_agent_event_queue() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.event_type IN ('game_bet','game_win') THEN INSERT INTO lobby_agent_queue(business_date,event_id) VALUES(NEW.business_date,NEW.event_id) ON CONFLICT DO NOTHING; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agent_event_queue ON lobby_activity_events;
CREATE TRIGGER agent_event_queue AFTER INSERT ON lobby_activity_events FOR EACH ROW EXECUTE FUNCTION lobby_agent_event_queue();
CREATE TABLE IF NOT EXISTS lobby_agent_days (
 business_date text PRIMARY KEY, rules jsonb NOT NULL, status text NOT NULL DEFAULT 'preview' CHECK(status IN ('preview','settled')),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lobby_agent_days ADD COLUMN IF NOT EXISTS aggregated boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS lobby_agent_personal (
 business_date text NOT NULL,uid bigint NOT NULL REFERENCES lobby_users(uid),provider text NOT NULL,
 valid_bet bigint NOT NULL CHECK(valid_bet>=0),bet_amount bigint NOT NULL,win_amount bigint NOT NULL,bet_count bigint NOT NULL,
 PRIMARY KEY(business_date,uid,provider)
);
CREATE TABLE IF NOT EXISTS lobby_agent_claims (
 claim_id text PRIMARY KEY,uid bigint NOT NULL REFERENCES lobby_users(uid),request_id text NOT NULL,amount bigint NOT NULL CHECK(amount>0),coins bigint NOT NULL CHECK(coins>=0),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(uid,request_id)
);
CREATE TABLE IF NOT EXISTS lobby_agent_daily (
 business_date text NOT NULL REFERENCES lobby_agent_days(business_date),uid bigint NOT NULL REFERENCES lobby_users(uid),provider text NOT NULL,
 team_bet bigint NOT NULL CHECK(team_bet>=0),rate bigint NOT NULL,direct_commission bigint NOT NULL CHECK(direct_commission>=0),other_commission bigint NOT NULL CHECK(other_commission>=0),
 claim_id text REFERENCES lobby_agent_claims(claim_id),PRIMARY KEY(business_date,uid,provider)
);
CREATE INDEX IF NOT EXISTS agent_daily_owner ON lobby_agent_daily(uid,business_date,claim_id);
CREATE TABLE IF NOT EXISTS lobby_agent_contributions (
 business_date text NOT NULL,uid bigint NOT NULL REFERENCES lobby_users(uid),member_uid bigint NOT NULL REFERENCES lobby_users(uid),provider text NOT NULL,
 depth integer NOT NULL,valid_bet bigint NOT NULL,commission bigint NOT NULL CHECK(commission>=0),
 PRIMARY KEY(business_date,uid,member_uid,provider)
);
CREATE INDEX IF NOT EXISTS agent_contribution_owner ON lobby_agent_contributions(uid,business_date,provider);
-- Seed existing bound history once. Subsequent boots do not enqueue all history again.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM lobby_agent_days) THEN
 INSERT INTO lobby_agent_queue(business_date,event_id) SELECT DISTINCT business_date,'bootstrap:'||business_date FROM lobby_activity_events WHERE event_type IN ('game_bet','game_win') ON CONFLICT DO NOTHING;
 END IF;
END $$;

CREATE INDEX IF NOT EXISTS agent_personal_owner ON lobby_agent_personal(uid,business_date,provider);
CREATE INDEX IF NOT EXISTS agent_paths_children ON lobby_agent_paths(ancestor_uid,depth,descendant_uid);
