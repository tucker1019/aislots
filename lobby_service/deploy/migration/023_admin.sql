CREATE TABLE IF NOT EXISTS lobby_admin_users(username text PRIMARY KEY,password_hash text NOT NULL,role text NOT NULL CHECK(role IN ('admin','operator','finance','viewer')),disabled boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS lobby_admin_sessions(token_hash text PRIMARY KEY,username text NOT NULL REFERENCES lobby_admin_users(username),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS lobby_admin_session_expiry ON lobby_admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS lobby_admin_audits(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,username text NOT NULL,action text NOT NULL,target text NOT NULL,reason text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS lobby_admin_reviews(request_id text PRIMARY KEY,username text NOT NULL,kind text NOT NULL,order_id text NOT NULL,decision text NOT NULL,reason text NOT NULL,status text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE lobby_withdrawal_orders DROP CONSTRAINT IF EXISTS lobby_withdrawal_orders_status_check;
ALTER TABLE lobby_withdrawal_orders ADD CONSTRAINT lobby_withdrawal_orders_status_check CHECK(status IN ('pending','approved','success','failed'));
