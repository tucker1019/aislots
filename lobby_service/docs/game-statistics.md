# 游戏 RTP 与排行榜

## 启用与口径

迁移012首次插入的 `lobby_game_statistics_epoch.started_at` 是固定启用时间，重启不重置。不回填历史；首次投注早于启用时间的局不纳入，即使免费链在启用后结束。完整局是一次付费投注及其所有消除、免费游戏；只在整局结算完成后统计。

机台的整局提交事务写入durable outbox和玩家游戏局序号。后台按玩家游戏流顺序投递，失败保留并退避重试；其他玩家不因单个失败阻塞。大厅内部接口要求现有服务端Bearer鉴权，前端不能提交统计。大厅先核对自己已确认的逐轮资金流水是否与整局总投注、总派彩一致，再事务提交局记录、分钟桶、连胜和Top50候选。统计不修改钱包。

`POST /internal/game/complete`：uid、gameId、betId、sequence、betAmount、winAmount、startedAt、endedAt。金额为整数分、时间RFC3339。按gameId+betId幂等，内容改变拒绝；每玩家游戏sequence必须连续。历史排除事件也推进序号，但不增加统计。已收事件重试无需再次入账。数据库恢复后outbox继续投递，不依赖页面在线或客户端动画。

## RTP

`POST /api/game/rtp`：uid、sid、gameId、window（5m/1h/24h）。返回from/to、updatedAt、statisticsSince、betAmount/winAmount（整数分字符串）、rounds、hasData、percent（百分比字符串）。无投注时hasData=false，客户端展示暂无数据，不显示0%。RTP可能超过100%，不足100局提示样本较少；历史统计不代表后续结果。

按首次投注所属UTC分钟增量累计。查询仅汇总5/60/1440个分钟桶，截止最近完整分钟，不扫描原始局记录补边界。较晚结束的免费局补入原分钟，因此此前范围的历史值可以更新。公开接口跨用户共享15秒进程内缓存，鉴权仍每请求执行；缓存失效、重启后从数据库重建。多实例各自缓存允许15秒内差异，没有Redis依赖。

## 排行榜

`POST /api/game/leaderboard`：uid、sid、gameId、board（wins/multiplier/streak）、period（today/week/all）。每种候选榜最多50条，前端返回前20。

- wins：单局总派彩，允许同一玩家多笔上榜。
- multiplier：单局总派彩/本局付费投注，以高精度numeric排序，展示两位小数。
- streak：单局有派彩算一胜，零派彩归零，每玩家只保留最好连续段。
- 今日、最近7个自然日以签到活动时区为准；全部为统计启用以来。
- 金额、倍数近7天读取7个日Top50，最多350个候选排序。连胜维护按连续段、日期的计数，为当日及后6个滚动七日窗口预计算候选，不能简单合并每日最长连胜。跨窗口的连续段在窗口起点截断。
- 同分按成绩结束时间升序、稳定entry key升序。连胜同玩家同分保留较早成绩。
- 先取前20，再连接用户表，不逐用户查询。返回公开HMAC用户标识、完整昵称、当前头像、投注、派彩、倍数、连胜次数和发生时间；不返回真实UID、账号、密码、sid。

## 并发与核对

大厅按游戏短事务锁保证桶、连胜与Top50更新原子一致；机台按玩家流投递锁保证多实例顺序。完整局记录可用于审计及人工重建，日常查询不读取它。分钟表主键(game_id,minute)，候选读取索引(game_id,period,board,score...)。监测outbox最老未送时间、未送条数、顺序冲突日志、事务耗时和查询耗时；错误不丢弃事件、不伪造或跳过序号。

## 验证

隔离schema测试覆盖九轮普通/免费链只产生一条完成通知、丢失回执重试及机台重建、金额核对、重复/改内容/跳序号、启用时间排除、RTP分钟边界、连胜跨天及七日裁剪、Top50裁剪、脱敏信息和缓存克隆隔离。前端测试使用模拟接口，不进行真实下注。

## 手动核对与重建

工作目录lobby_service，使用现有大厅环境配置：

```sh
go run ./app/apis/lobby/api/cmd/statistics-rebuild -game AG1
# 上一条只读记录数，不修改数据。维护时显式传apply：
go run ./app/apis/lobby/api/cmd/statistics-rebuild -game AG1 -apply
```

重建在游戏级锁和同一事务中清空并重新生成该游戏聚合与候选，只使用已经留存的整局完成通知，保留启用时间，不读取机台库、不回填旧投注，不修改钱包。失败回滚；大体量时在维护窗口执行。最多15秒后各实例查询缓存自然失效。

### Ranked order replay

`lobby_game_completions.platform_order_id` is a platform-generated persistent identity for one complete game chain. It is distinct from the game bet ID and per-frame money request ID. Existing completion rows receive identities during migration; no historical game results are imported. Statistics rebuild preserves these identities.

Leaderboard items include `platformOrderId`. `POST /api/game/rank-replay` accepts the viewer's uid/sid, gameId, platformOrderId, board (`wins`/`multiplier`) and period (`today`/`week`/`all`). It rechecks the current Top 20 and resolves the owner/game bet entirely on the server. Streak replays and arbitrary non-ranked orders are rejected.

Configure the game entry `apiUrl` to its private service address. The platform calls `POST /internal/rank-replay` with the existing service Bearer secret and server-resolved uid/gameId/betId. The game verifies a completed owned bet and its configured platform identity before issuing the existing read-only share token. The response is converted to the configured game URL with only `replay` and `share`; no login token or owner identity is sent to the viewer. Never log full replay URLs or service credentials.
