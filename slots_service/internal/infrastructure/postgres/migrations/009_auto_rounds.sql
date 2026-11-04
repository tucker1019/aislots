CREATE TABLE game_auto_rounds (
 appname text NOT NULL,appkey text NOT NULL,uid text NOT NULL,game_id text NOT NULL,request_id text NOT NULL,
 amount bigint NOT NULL CHECK(amount>0),country text NOT NULL,currency text NOT NULL,
 spin_token text NOT NULL DEFAULT '',bet_id text NOT NULL DEFAULT '',done boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(appname,appkey,uid,game_id,request_id)
);
CREATE UNIQUE INDEX game_auto_round_active ON game_auto_rounds(appname,appkey,uid) WHERE NOT done;
