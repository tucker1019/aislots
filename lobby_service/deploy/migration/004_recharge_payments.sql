ALTER TABLE lobby_recharge_orders ADD COLUMN IF NOT EXISTS payment_url text NOT NULL DEFAULT 'https://www.baidu.com';
ALTER TABLE lobby_recharge_orders ADD COLUMN IF NOT EXISTS settle_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE lobby_recharge_orders ADD COLUMN IF NOT EXISTS failure_code integer NOT NULL DEFAULT 0;
ALTER TABLE lobby_recharge_orders ADD COLUMN IF NOT EXISTS settled_at timestamptz;
ALTER TABLE lobby_recharge_orders DROP CONSTRAINT IF EXISTS lobby_recharge_orders_status_check;
ALTER TABLE lobby_recharge_orders ADD CONSTRAINT lobby_recharge_orders_status_check CHECK(status IN ('pending','success','failed'));
CREATE INDEX IF NOT EXISTS lobby_recharge_due ON lobby_recharge_orders(settle_at,order_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS lobby_recharge_user_history ON lobby_recharge_orders(uid,created_at DESC,order_id DESC);
