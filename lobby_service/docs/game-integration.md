# AG1 游戏接入

大厅是唯一真实钱包，机台保存开奖、逐轮进度、记录与回放。两端数据库独立；没有游戏转入/转出钱包。

## 配置与运行

大厅 `etc/games.json` 配置游戏开放状态、客户端地址、appname/appkey、国家、币种。地址只允许完整HTTP(S)，禁止携带查询参数、账号密码或片段。服务端生成票据并附加到地址，浏览器不能指定地址。

两端设置相同的 `LOBBY_GAME_SERVICE_TOKEN`，用 `openssl rand -hex 32` 生成，并通过环境变量注入；不放进前端、配置JSON或版本库。未设置时大厅禁止签发票据和访问内部接口，机台真实模式拒绝启动。

```sh
# 大厅：工作目录 lobby_service，保留现有数据库连接配置
export LOBBY_GAME_SERVICE_TOKEN='<两端相同的随机值>'
make GOTOOLCHAIN=local run

# 机台：工作目录 slots_service，保留现有 AISLOTS_DATABASE_URL
export LOBBY_GAME_SERVICE_TOKEN='<两端相同的随机值>'
go run ./cmd/slots-server -config configs/server.lobby.json
```

静态站与反向代理的访问日志仅记录路径，不记录包含票据的完整查询串。

生产环境修改游戏客户端地址、机台的大厅服务地址以及反向代理。开发大厅 `/api/game` 与 `/api/user` 代理8081；AG1默认连接8080。测试钱包使用原 `server.test.json`，不能与真实模式同时启用。

## 用户进入

`POST /api/game/launch`：`{"uid":123,"sid":"大厅会话","gameId":"AG1"}`。

返回 `{"code":"OK","data":{"launchUrl":"http://127.0.0.1:5180/?launchTicket=...","expiresAt":"RFC3339"}}`。票据为随机52字符，仅保存SHA256哈希，有效60秒。

大厅前端防重复点击，取得地址后进入 `/game/AG1`，在 iframe 内加载游戏，支持返回大厅和重新申请入口。AG1使用 `POST /api/v1/login` 提交 `{"gameId":"AG1","launchTicket":"...","exchangeId":"同一次兑换的稳定随机号"}`，游戏服务向大厅兑换身份。不同兑换号不得重用票据；相同兑换号允许24小时内重试，以恢复丢失的登录响应。游戏服务返回同一个游戏会话，不会因为重试生成多个身份。

成功后清除地址栏票据，游戏会话保存在当前标签页的sessionStorage。刷新验证该会话并静态恢复最后已结算盘面；过期要求返回大厅，不回退到固定测试用户。新大厅用户余额为0，沿用大厅钱包，不赠送测试初始余额。

## 内部协议

所有内部接口均为POST JSON，需要 `Authorization: Bearer <LOBBY_GAME_SERVICE_TOKEN>`，只供服务端访问。

| 路径 | 请求 | 返回data |
| --- | --- | --- |
| `/internal/game/exchange` | launchTicket、exchangeId、gameId | uid、appname、appkey、country、currency、coins |
| `/internal/game/balance` | uid、gameId | coins |
| `/internal/game/settle` | uid、gameId、betId、requestId、debit、credit | status（confirmed/rejected）、coins |

金额均为整数分。结算接口一次原子处理当前展示轮的扣款和派彩，余额不足时整轮拒绝，不会支付该轮奖金。相同requestId和内容返回原回执，修改内容则冲突；整局最多一次成功扣款。消除、免费轮只有credit，整个免费过程共用原betId。

钱包行锁下，资金订单、余额、source流水、活动事件/每日汇总和VIP进度一起提交。投注产生game_bet事件（当前AG1有效流水等于实际投注），派奖产生game_win事件；免费和消除不重复累计投注。source由script/coin_sources.py管理。

## 机台恢复

机台在调用大厅前持久化本轮待结算计划，含稳定资金请求号、已抽中的盘面及待提交的绑定SQL参数。规划事务回滚，未结算盘面不会暴露。大厅确认后，机台原子提交盘面、进度、回执并删除计划；显示余额取大厅结算回执。

超时、响应丢失或机台提交失败都保留计划。下一次state/spin先用同一资金请求号恢复，大厅幂等返回原结果，机台应用原盘面，不重抽、不重复扣加币。明确余额不足时丢弃未执行的计划。数据库中有待结算记录但无法恢复时应保留记录排查，不能清表或生成新资金请求号绕过。

## 验证

- 大厅 `make build`、`make model`、`make test`、`make lint`、`make format`；逻辑测试覆盖率91.7%。模型生成前已迁移并验证新表。
- 独立schema数据库测试覆盖票据、并发幂等、余额不足、日汇总和source流水。
- 机台数据库恢复测试覆盖大厅已入账但响应丢失、随后本地提交失败、服务重建、9轮普通及免费过程只扣一次、结算期间大厅充值后的实际余额。
- 两端HTTP联调在各自隔离schema运行，验证票据登录、同请求重试、不同兑换号拒绝、测试登录拒绝、下注幂等、刷新恢复及最终大厅余额。

## 大厅投注记录

`POST /api/game/records`：`{uid,sid,from,to,page,provider}`（provider空字符串表示全部，否则按配置厂商筛选），时间为RFC3339，范围左闭右开且最多8天，页码从1开始，每页20条。使用大厅会话鉴权。

返回 `items`（betId、gameId、gameName、provider、createdAt、betAmount、validBet、profit）、筛选范围全量 `count/betAmount/profit`、`currency`、配置中的 `providers` 和 `hasMore`。金额为整数分；厂商和游戏名称配置在 `etc/games.json`，前端不推断厂商。

仅统计当前用户已确认的大厅结算，按gameId+betId合并全部已结算轮，按首次付费投注日期筛选。免费及消除不另计一局，尚在进行的局只显示已结算部分。当前AG1有效投注等于付费扣款。列表按投注时间倒序分页。

## 平台资金明细

`POST /api/game/wallet-ledger`：`{uid,sid,from,to,category,cursor}`，RFC3339时间左闭右开、最多32天；category空字符串表示全部，其他值从响应categories取；cursor从nextCursor取。每页20条，按流水ID倒序追加。返回items、categories、nextCursor。

`POST /api/game/wallet-ledger/detail`：`{uid,sid,id}`，id为列表流水ID字符串。只能读取当前用户的流水。

item包含id、orderId、type、currency、amount（有符号整数分）、balance（该笔账变后余额）、createdAt、remark。业务分类由服务端映射source，日周月反水合并为“反水奖励”；游戏流水通过结算单关联厂商，显示“AG 投注 / AG 派彩”，不公开具体游戏名称。没有三方转入/转出分类。订单号可复制；不合并不同实际账变，余额取每笔记账快照。

## 个人报表

`POST /api/user/report`，请求带`uid/sid/period`，周期为`today/yesterday/this_week/last_week`；服务端按活动时区计算自然日和周一开始的自然周，返回半开区间`from/to`、统计时区、币种及独立指标。充值只计本金；返水和各项奖励按实际钱包入账时间统计；游戏输赢为派彩减下注，有效投注取可信活动事件的有效流水（非直接复制投注额）。净输赢为游戏输赢加已到账返水、签到、VIP奖励、亏损返还、充值赠送、新手奖励，不含充值本金、取款和充值手续费。取款、代理、账户调整暂标记`supported=false`。同一只读快照聚合，禁止客户端传UID外的统计数据或直接访问机台数据库。新增金币source时须同步确认报表归类。
