-- Only the first initialization reads historical users and settlements. The
-- writer locks span backfill + trigger installation in this migration's transaction.
CREATE TABLE IF NOT EXISTS lobby_admin_member_totals (
 account_type text PRIMARY KEY CHECK(account_type IN ('real','experience')),
 members bigint NOT NULL CHECK(members>=0)
);
CREATE TABLE IF NOT EXISTS lobby_admin_game_totals (
 account_type text NOT NULL CHECK(account_type IN ('real','experience')),
 shard integer NOT NULL CHECK(shard>=0 AND shard<64),
 bet_amount numeric(38,0) NOT NULL CHECK(bet_amount>=0),
 win_amount numeric(38,0) NOT NULL CHECK(win_amount>=0),
 PRIMARY KEY(account_type,shard)
);
CREATE TABLE IF NOT EXISTS lobby_admin_overview_initialized (
 id integer PRIMARY KEY CHECK(id=1),initialized_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION lobby_admin_count_members() RETURNS trigger AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO lobby_admin_member_totals(account_type,members) VALUES(NEW.account_type,1)
  ON CONFLICT(account_type) DO UPDATE SET members=lobby_admin_member_totals.members+1;
 ELSE
  UPDATE lobby_admin_member_totals SET members=members-1 WHERE account_type=OLD.account_type;
 END IF;
 RETURN NULL;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS admin_member_totals ON lobby_users;
CREATE TRIGGER admin_member_totals AFTER INSERT OR DELETE ON lobby_users FOR EACH ROW EXECUTE FUNCTION lobby_admin_count_members();
CREATE OR REPLACE FUNCTION lobby_admin_count_game() RETURNS trigger AS $$ BEGIN
 IF TG_OP<>'INSERT' AND OLD.status='confirmed' THEN
  UPDATE lobby_admin_game_totals SET bet_amount=bet_amount-OLD.debit,win_amount=win_amount-OLD.credit
   WHERE account_type=OLD.account_type AND shard=(OLD.uid%64)::integer;
 END IF;
 IF TG_OP<>'DELETE' AND NEW.status='confirmed' THEN
  INSERT INTO lobby_admin_game_totals(account_type,shard,bet_amount,win_amount)
   VALUES(NEW.account_type,(NEW.uid%64)::integer,NEW.debit,NEW.credit)
  ON CONFLICT(account_type,shard) DO UPDATE
   SET bet_amount=lobby_admin_game_totals.bet_amount+EXCLUDED.bet_amount,
       win_amount=lobby_admin_game_totals.win_amount+EXCLUDED.win_amount;
 END IF;
 RETURN NULL;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS admin_game_totals ON lobby_game_settlements;
CREATE TRIGGER admin_game_totals AFTER INSERT OR UPDATE OR DELETE ON lobby_game_settlements FOR EACH ROW EXECUTE FUNCTION lobby_admin_count_game();

DO $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(current_schema() || ':admin-overview-v1'));
 IF NOT EXISTS(SELECT 1 FROM lobby_admin_overview_initialized WHERE id=1) THEN
  LOCK TABLE lobby_users,lobby_game_settlements IN SHARE ROW EXCLUSIVE MODE;
  DELETE FROM lobby_admin_member_totals;
  DELETE FROM lobby_admin_game_totals;
  INSERT INTO lobby_admin_member_totals(account_type,members)
   SELECT kinds.account_type,count(u.uid) FROM (VALUES('real'),('experience')) kinds(account_type)
   LEFT JOIN lobby_users u ON u.account_type=kinds.account_type GROUP BY kinds.account_type;
  INSERT INTO lobby_admin_game_totals(account_type,shard,bet_amount,win_amount)
   SELECT account_type,(uid%64)::integer,sum(debit::numeric),sum(credit::numeric)
   FROM lobby_game_settlements WHERE status='confirmed' GROUP BY account_type,uid%64;
  INSERT INTO lobby_admin_overview_initialized(id) VALUES(1);
 END IF;
END $$;
