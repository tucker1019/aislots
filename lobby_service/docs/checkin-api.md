# 循环签到（MVP）

基础地址 `http://127.0.0.1:8081`，所有接口必须携带uid、sid。公共原子参数可照常附带；加解密仍走透传预留函数。金额全部为JSON数字、整数分，展示时/100。响应header包含X-Trace-Id。

## 规则与配置

配置文件 [etc/checkin.json](../etc/checkin.json)，环境变量 `LOBBY_CHECKIN_CONFIG` 可指定路径，修改后重启生效。

```json
{
  "version":"checkin-v1",
  "timezone":"Asia/Jakarta",
  "days":[
    {"requiredBet":10000,"requiredRecharge":1000,"reward":100},
    {"requiredBet":20000,"requiredRecharge":2000,"reward":200}
  ]
}
```

上例为2天循环：第1天需要当天有效投注100元、成功充值10元，领取1元；第2天需投注200元、成功充值20元，领取2元。生产示例配置暂设7天，数值均可调整，不代表最终运营规则。

- 每天只看该活动时区当天的数据，时区默认印尼雅加达Asia/Jakarta（UTC+7），每天零点重置。
- 两个条件必须同时满足；任意条件为0表示不限制，奖励必须大于0。支持1–366天。
- 首次为第1天。昨天领取，今天推进一天；领完最后一天后，次日回到第1天。
- 昨天未领取，今天重置第1天；即使昨天达标但没有领取，也算断签。
- 每天最多一次，不能补签，不能同一天连续领取多天。
- 充值按成功订单本金amount累计，手续费和赠送不改变充值门槛统计；付款中和失败不计。按成功结算时间归属日期，跨天支付计入成功当天。
- 同一天充值/投注在领取后仍继续统计，但不会再发第二次奖励，也不结转次日。
- 配置version用于规则版本隔离。改规则时更新version，下一未领取日从第1天开始；当日已领取结果保留原快照。修改天数/金额也应同步更新version。
- 活动时区是整个每日统计的统一口径，上线后应保持固定；更换时区需要单独迁移日期数据，不应直接改配置。

## 获取签到信息

`GET /api/activity/checkin/info?uid=123&sid=YOUR_SID`

```json
{
  "code":"OK",
  "data":{
    "activityDate":"2026-11-03",
    "timezone":"Asia/Jakarta",
    "nextResetAt":"2026-11-04T00:00:00+07:00",
    "currentDay":1,
    "claimed":false,
    "canClaim":false,
    "validBet":5000,
    "rechargeAmount":1000,
    "days":[
      {"day":1,"requiredBet":10000,"requiredRecharge":1000,"reward":100},
      {"day":2,"requiredBet":20000,"requiredRecharge":2000,"reward":200}
    ],
    "current":{"day":1,"requiredBet":10000,"requiredRecharge":1000,"reward":100}
  }
}
```

`currentDay`：今天可领或已经领取的是第几天。领取后当天不跳到下一天，明天再推进。`claimed`优先于进度展示；`canClaim`由服务端判断，客户端不能提交金额或领取天数。`current`是今天实际规则，已领取时保持原快照；`days`是当前配置的全部周期规则。

## 领取签到奖励

`POST /api/activity/checkin/claim`

```json
{"uid":123,"sid":"YOUR_SID","activityDate":"2026-11-03"}
```

activityDate必须使用info返回的日期，不要用设备本地日期。uid/sid也可放公共查询参数，两处都传必须一致。

```json
{"code":"OK","data":{"claimId":"chk_SERVER_ID","activityDate":"2026-11-03","day":1,"reward":100,"coins":1080}}
```

coins是本次奖励结算后的余额快照，当前余额请通过用户信息查询。重复请求返回同一领取记录，不重复加币；跨天重试原日期，已有记录返回原结果，未领过的旧日期返回日期过期。

领取记录、余额和source流水在一个事务内提交，并发请求通过钱包锁及(uid,日期)唯一约束防重。记录持久化，服务重启不影响连签判定；无需每天执行重置任务。

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | 10010001 | 参数或日期格式无效 |
| 401 | 10010002 | 会话无效 |
| 400 | 10010011 | 今日流水或充值未达标 |
| 409 | 10010012 | 日期过期，请刷新info |
| 400 | 10010009 | 奖励会导致余额溢出，未入账 |
| 500 | 10010005 | 数据库异常，事务回滚 |

## 流水统计预留

不按source扫描投注，不把普通减币当投注。source只表示金币变动来源，签到奖励使用 `SourceCheckinReward = "act_001"`，由script/coin_sources.py统一维护。

独立的业务事件表 `lobby_activity_events` 保存：eventId、uid、eventType、gameId、amount、occurredAt、businessDate。每日统计表 `lobby_activity_daily` 按(uid,businessDate)主键保存validBet、betAmount、winAmount和rechargeAmount，签到直接读取一行统计，与机台数量无关。

预留服务内部 `ActivityModel.RecordEvent(ctx, event)`：

- eventType=game_bet：amount是实际投注金额，validBetAmount是可选的有效流水，省略则等于amount；gameId区分AG1、AG2等机台。
- eventType=recharge_success：amount是成功充值本金，目前已由充值结算事务内部调用。
- eventId使用带提供方/游戏命名空间的唯一业务编号，例如`provider:AG1:bet:ORDER_ID`，同一事件重试必须保持所有原字段一致。
- occurredAt由可信结算方确定，按活动时区归属日；迟到事件仍属于发生当天，不自动补领过期奖励。
- 同一eventId重复不会累计；内容不一致报10010013。事件与每日累计在同一事务提交。
- 后续游戏结算适配器应在结算事务内调用该预留方法，保证金币结算和活动流水一致；跨服务接入时再定义鉴权协议和可靠事件投递，不开放给客户端上报。

目前未接入真实游戏投注，因此默认有流水门槛时不会达标。测试可在专用配置中把requiredBet设0，不能让客户端伪造流水。统计从本版本启用后开始，历史充值尚未回填。

金币流水order_id现为通用业务单号，可关联充值订单或签到领取记录；由各业务事务保证一致性，唯一约束(order_id,source)仍保留。

游戏投注/派彩与日周月反水、净亏损返还的完整接入约定见[反水接口文档](returns-api.md)。
