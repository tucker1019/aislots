CREATE TABLE IF NOT EXISTS lobby_thirdparty_transactions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 provider text NOT NULL,
 transaction_id text NOT NULL,
 round_id text NOT NULL DEFAULT '',
 bet_id text NOT NULL DEFAULT '',
 uid bigint NOT NULL REFERENCES lobby_users(uid),
 game_id text NOT NULL,
 external_game_id text NOT NULL DEFAULT '',
 reason text NOT NULL CHECK(reason IN ('bet','win')),
 amount_minor bigint NOT NULL CHECK(amount_minor <> 0),
 balance_before bigint NOT NULL CHECK(balance_before >= 0),
 balance_after bigint NOT NULL CHECK(balance_after >= 0),
 status text NOT NULL CHECK(status IN ('confirmed','rolled_back')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 rolled_back_at timestamptz,
 UNIQUE(provider, transaction_id)
);
CREATE INDEX IF NOT EXISTS lobby_thirdparty_tx_user ON lobby_thirdparty_transactions(uid, created_at DESC);
CREATE INDEX IF NOT EXISTS lobby_thirdparty_tx_round ON lobby_thirdparty_transactions(provider, round_id);

CREATE OR REPLACE FUNCTION lobby_credit_turnover() RETURNS trigger AS $$
DECLARE rule lobby_turnover_rules%ROWTYPE; redeem_multiplier bigint;
BEGIN
 IF NEW.delta<=0 OR NEW.source IN ('game_002','game_003','wdr_002') OR NEW.created_at<(SELECT activated_at FROM lobby_turnover_activation WHERE id=1) THEN RETURN NEW; END IF;
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
