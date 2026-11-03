# 反水与 Loser Return

基础地址 `http://127.0.0.1:8081`，四个接口均需有效uid、sid，可携带既有公共查询参数。所有金额是JSON数字、整数分，展示时/100；响应header有X-Trace-Id。与机台保持独立数据库及接口边界。

## 业务规则

| 奖励 | 基数 | 领取窗口 | 默认比例 |
| --- | --- | --- | --- |
| 日反水daily | 昨天有效流水 | 今天00:00至明天00:00 | 0.8% |
| 周反水weekly | 上周一至周日有效流水 | 本周一当天 | 0.1% |
| 月反水monthly | 上个月自然月有效流水 | 本月1号当天 | 0.1% |
| loser_return | max(昨天实际投注－昨天游戏派彩,0) | 今天00:00至明天00:00 | 10% |

全部使用与签到一致的活动时区，默认Asia/Jakarta。周期开始包含、结束不包含。窗口结束作废，未领取奖励不累计、不补领。每天的日反水只指向昨天；本周、本月则各自独立。

同一笔有效流水可同时参与日、周、月反水。一号恰好周一时，可一次领取三份反水；Loser Return再单独领取一次。领取活动奖励、充值赠送不算游戏派彩，不影响净亏损。

每种奖励先对整个周期汇总，再乘比例并向下取整到分；不足一分为0，不创建奖励流水。Loser Return盈利或持平时为0。

## 比例配置

[etc/returns.json](../etc/returns.json)，环境变量 `LOBBY_RETURN_CONFIG` 可覆盖路径，修改后重启生效。

```json
{"dailyRateBps":80,"weeklyRateBps":10,"monthlyRateBps":10,"loserReturnRateBps":1000}
```

10000基点=100%；80=0.8%，10=0.1%，1000=10%。四个字段必须明确配置，允许0–10000整数；0表示该奖励比例为0。不使用浮点金额。活动时区统一沿用checkin.json，不单独配置另一套时区。

尚未领取的奖励、当前预估使用当前配置比例；领取后保存统计和比例快照，不因配置修改或迟到事件而改变，也不追加补发。正式接机台时，投注及全部派彩应可靠地提交完毕后再提供最终可领奖统计。

## 1. 反水信息

`GET /api/activity/rebate/info?uid=123&sid=YOUR_SID`

返回结构固定为daily、weekly、monthly三项，每项都有claim和preview。claimableTotal只合计当前窗口内可领取且未领取的奖励。

以下以2026年6月1日（周一）为例：昨天有效流水100000分、上周300000分、上月700000分；今天新增150000分有效流水。

```json
{
 "code":"OK",
 "data":{
  "activityDate":"2026-06-01",
  "timezone":"Asia/Jakarta",
  "claimableTotal":1800,
  "daily":{
   "claim":{
    "type":"daily",
    "periodStart":"2026-05-31",
    "periodEnd":"2026-06-01",
    "validBet":100000,
    "betAmount":100000,
    "winAmount":80000,
    "lossAmount":20000,
    "baseAmount":100000,
    "rateBps":80,
    "reward":800,
    "status":"claimable",
    "availableAt":"2026-06-01T00:00:00+07:00",
    "expiresAt":"2026-06-02T00:00:00+07:00"
   },
   "preview":{
    "type":"daily",
    "periodStart":"2026-06-01",
    "periodEnd":"2026-06-02",
    "validBet":150000,
    "betAmount":200000,
    "winAmount":250000,
    "lossAmount":0,
    "baseAmount":150000,
    "rateBps":80,
    "reward":1200,
    "status":"preview",
    "availableAt":"2026-06-02T00:00:00+07:00",
    "expiresAt":"2026-06-03T00:00:00+07:00"
   }
  },
  "weekly":{
   "claim":{"type":"weekly","periodStart":"2026-05-25","periodEnd":"2026-06-01","validBet":300000,"betAmount":300000,"winAmount":80000,"lossAmount":220000,"baseAmount":300000,"rateBps":10,"reward":300,"status":"claimable","availableAt":"2026-06-01T00:00:00+07:00","expiresAt":"2026-06-02T00:00:00+07:00"},
   "preview":{"type":"weekly","periodStart":"2026-06-01","periodEnd":"2026-06-08","validBet":150000,"betAmount":200000,"winAmount":250000,"lossAmount":0,"baseAmount":150000,"rateBps":10,"reward":150,"status":"preview","availableAt":"2026-06-08T00:00:00+07:00","expiresAt":"2026-06-09T00:00:00+07:00"}
  },
  "monthly":{
   "claim":{"type":"monthly","periodStart":"2026-05-01","periodEnd":"2026-06-01","validBet":700000,"betAmount":700000,"winAmount":80000,"lossAmount":620000,"baseAmount":700000,"rateBps":10,"reward":700,"status":"claimable","availableAt":"2026-06-01T00:00:00+07:00","expiresAt":"2026-06-02T00:00:00+07:00"},
   "preview":{"type":"monthly","periodStart":"2026-06-01","periodEnd":"2026-07-01","validBet":150000,"betAmount":200000,"winAmount":250000,"lossAmount":0,"baseAmount":150000,"rateBps":10,"reward":150,"status":"preview","availableAt":"2026-07-01T00:00:00+07:00","expiresAt":"2026-07-02T00:00:00+07:00"}
  }
 }
}
```

claim显示上一完整周期，preview显示当前周期实时累计。preview.reward是预计奖励，会随当天/本周/本月统计变化，不能提前领取。

| status | 客户端含义 |
| --- | --- |
| claimable | 当前可领，计入claimableTotal |
| claimed | 已领，显示原奖励快照，不计入总额 |
| expired | 上个周期的领取窗口已结束，不能补领 |
| no_reward | 当前窗口内金额为0，无奖励 |
| preview | 当前周期预计奖励，尚未到领取时间 |

查询周、月信息时，即使不是周一/1号仍返回上一完整周期，未领取时标记expired；preview持续展示本周、本月。已领取周期一直返回claimed，直到切换至新的上一周期。

## 2. 一次领取全部反水

`POST /api/activity/rebate/claim`

```json
{"uid":123,"sid":"YOUR_SID","activityDate":"2026-06-01"}
```

activityDate必须原样使用info返回的日期，不使用设备日期。服务端自行选择可领的daily、weekly、monthly；不接收客户端指定类型、金额、比例或统计周期。

```json
{
 "code":"OK",
 "data":{
  "claimId":"ret_SERVER_ID",
  "activityDate":"2026-06-01",
  "totalReward":1800,
  "coins":1800,
  "items":[
   {"type":"daily","periodStart":"2026-05-31","periodEnd":"2026-06-01","validBet":100000,"betAmount":100000,"winAmount":80000,"lossAmount":20000,"baseAmount":100000,"rateBps":80,"reward":800,"status":"claimed","availableAt":"2026-06-01T00:00:00+07:00","expiresAt":"2026-06-02T00:00:00+07:00"},
   {"type":"monthly","periodStart":"2026-05-01","periodEnd":"2026-06-01","validBet":700000,"betAmount":700000,"winAmount":80000,"lossAmount":620000,"baseAmount":700000,"rateBps":10,"reward":700,"status":"claimed","availableAt":"2026-06-01T00:00:00+07:00","expiresAt":"2026-06-02T00:00:00+07:00"},
   {"type":"weekly","periodStart":"2026-05-25","periodEnd":"2026-06-01","validBet":300000,"betAmount":300000,"winAmount":80000,"lossAmount":220000,"baseAmount":300000,"rateBps":10,"reward":300,"status":"claimed","availableAt":"2026-06-01T00:00:00+07:00","expiresAt":"2026-06-02T00:00:00+07:00"}
  ]
 }
}
```

items只包含本次实际领取的明细，按type字典序排列；按type取值，不依赖数组位置。totalReward是这些明细合计；coins是本次结算后的余额快照。当前余额从用户信息获取。

整个批次的明细、source流水、钱包变动在同一个事务提交。任意一笔失败全部回滚。一次领取不包含Loser Return。

## 3. Loser Return 信息

`GET /api/activity/loserreturn/info?uid=123&sid=YOUR_SID`

结构为activityDate、timezone、claimableTotal、daily；daily也包含claim和preview，字段与反水一致，type固定loser_return。

- daily.claim：昨天实际投注betAmount、昨天派彩winAmount、净亏损lossAmount、baseAmount=lossAmount、rateBps=1000和reward。
- daily.preview：今天投注/派彩、当前净亏损和预计明天奖励。今天后续中奖可能使预估奖励减少至0。
- 即使有效流水和实际投注不同，净亏损也始终使用实际投注。所有游戏合并后再计算净亏损，盈利游戏与亏损游戏会相抵。

## 4. 单独领取 Loser Return

`POST /api/activity/loserreturn/claim`

```json
{"uid":123,"sid":"YOUR_SID","activityDate":"2026-06-01"}
```

返回ReturnClaimReply，与反水领取结构相同，但items只有一项loser_return。例如昨天投注100000、派彩80000，返还2000分。该批次与反水批次相互独立，可各自领取一次。

## 重试与过期

按(uid,奖励组,领取日期)保存批次，按(uid,奖励类型,统计周期开始日)保存唯一明细。重复请求（含并发请求、重启后重试）返回原批次，不重复加币。已存在的旧日期批次即使跨天重试，也返回原结果；旧日期没有批次则返回日期过期，不会误领新日期奖励。

当前批次成功后即固定，迟到事件不会让同一天的同一奖励组再领取一次；如果没有可领金额，返回错误且不创建批次，统计更新后可以再查再领。

| HTTP | code | 说明 |
| --- | --- | --- |
| 400 | 10010001 | 参数/日期格式无效 |
| 401 | 10010002 | 会话无效或过期 |
| 409 | 10010014 | 领取日期过期，请刷新info |
| 400 | 10010015 | 当前没有可领取的奖励 |
| 400 | 10010009 | 批次奖励或余额超出整数范围，未入账 |
| 500 | 10010005 | 数据库异常，事务回滚 |

## 数据与source

不遍历机台source，基于lobby_activity_daily按(uid,business_date)索引查询最多31天汇总。新增bet_amount、win_amount；valid_bet保留给签到及反水。旧game_bet事件兼容为实际投注=有效流水，并在迁移时回填bet_amount。

可信服务内部ActivityModel.RecordEvent预留：

- game_bet：Amount为实际投注，ValidBetAmount可选，省略时等于实际投注；允许0–Amount。GameID必填。
- game_win：Amount为实际游戏派彩，GameID必填；包括免费局的实际派彩，不能把充值或活动赠送当作game_win。0金额无需单独发事件。
- 每个事件使用唯一eventId，相同业务重试保持原字段不变；重复不累计，内容不同报冲突。
- 游戏最终结算应在同一个可信结算事务内记录投注和全部派彩。未来适配器可将该事务tx传给ActivityModel，避免投注已记录、派彩未完成时暴露中间净亏损。
- 归属日期按可信occurredAt和统一活动时区计算。真实游戏尚未接入，不提供客户端伪造投注/派彩的入口，因此当前真实数据的这些奖励为0。

金币source在script/coin_sources.py维护，make source生成：日act_002、周act_003、月act_004、Loser Return act_005。每项奖励各记一条流水，共用所属批次的order_id。

## 验证

`LOBBY_INTEGRATION_DATABASE_URL=... make test` 包括周一且为1号时的三份合领、净亏损与盈利、实时预估、过期、不重复领取、溢出回滚、任意一笔流水失败全批次回滚及跨日重试测试。make lint检查代码。

## 大厅平台展示

反水info增加platforms：每项包含name、dailyRateBps、weeklyRateBps、monthlyRateBps。平台名由games.json中开放游戏的provider去重排序返回，不返回游戏名。当前所有平台采用同一套全局比例，接口不会改变原有结算基数及算法。客户端平台卡片显示日、周、月比例之和，规则中分别展示三个周期比例；各周期独立结算。
