CREATE TABLE IF NOT EXISTS lobby_redeem_codes (
 id text PRIMARY KEY,
 code_hash text NOT NULL UNIQUE,
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 amount bigint NOT NULL CHECK(amount > 0),
 turnover_multiplier bigint NOT NULL CHECK(turnover_multiplier IN (0,1)),
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 redeemed_at timestamptz,
 claim_id text UNIQUE
);
CREATE INDEX IF NOT EXISTS lobby_redeem_codes_user ON lobby_redeem_codes(uid,created_at DESC);
INSERT INTO lobby_turnover_rules(source,multiplier,version) VALUES('act_009',1,'turnover-v1') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION lobby_credit_turnover() RETURNS trigger AS $$
DECLARE rule lobby_turnover_rules%ROWTYPE; redeem_multiplier bigint;
BEGIN
 IF NEW.delta<=0 OR NEW.source IN ('game_002','wdr_002') OR NEW.created_at<(SELECT activated_at FROM lobby_turnover_activation WHERE id=1) THEN RETURN NEW; END IF;
 SELECT turnover_multiplier INTO redeem_multiplier FROM lobby_redeem_codes WHERE claim_id=NEW.order_id AND redeemed_at IS NOT NULL;
 IF FOUND AND NEW.source='act_009' THEN
   PERFORM lobby_apply_turnover(NEW.uid,NEW.id,NULL::text,NEW.source,NEW.delta,redeem_multiplier,'redeem-code-v1',0::bigint);
   RETURN NEW;
 END IF;
 SELECT * INTO rule FROM lobby_turnover_rules WHERE source=NEW.source;
 IF NOT FOUND THEN RAISE EXCEPTION 'turnover credit source not configured'; END IF;
 PERFORM lobby_apply_turnover(NEW.uid,NEW.id,NULL::text,NEW.source,NEW.delta,rule.multiplier,rule.version,0::bigint);
 RETURN NEW;
END $$ LANGUAGE plpgsql;
