-- 按登录身份、游戏、国家/币种查询整局记录；准备中但尚未下注的凭据不入历史。
CREATE INDEX bet_tickets_history ON bet_tickets (
 appname, appkey, uid, (data->>'GameID'),
 (data->'Player'->>'country'), (data->'Player'->>'currency'),
 created_at DESC, id DESC
) WHERE status IN ('active','complete');
