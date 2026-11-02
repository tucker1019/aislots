# 新手累计充值活动

基础地址http://127.0.0.1:8081，接口均需uid/sid；金额为JSON数字、整数分，前端展示/100。响应header包含X-Trace-Id。

## 规则和配置

配置[etc/newbie-recharge.json](../etc/newbie-recharge.json)，可通过LOBBY_NEWBIE_RECHARGE_CONFIG覆盖路径，修改后重启生效。示例暂配：注册起3天（72小时）内累计充值100、500、1000元，分别额外奖励10、50、100元。

```json
{
 "version":"newbie-recharge-v1",
 "durationDays":3,
 "expireUnclaimed":false,
 "tiers":[
  {"id":"recharge_100","requiredRecharge":10000,"reward":1000},
  {"id":"recharge_500","requiredRecharge":50000,"reward":5000},
  {"id":"recharge_1000","requiredRecharge":100000,"reward":10000}
 ]
}
```

- 活动从注册时刻开始，不从首次访问活动页面开始；3天为连续72小时，不按自然日。
- 多次成功充值累计，充值方式/订单档位不限。例如10次充值10元同样达到累计100元。
- 只计算活动窗口内成功的订单本金amount。付款中、失败不算；赠送不算充值，手续费也不从活动累计本金中扣除。
- 统计成功时间在[startsAt,endsAt)的订单，恰好在endsAt成功的订单不计入；活动内创建、到期后成功也不计入。
- 各档奖励独立叠加，达到500元可累计领取10+50=60元，不只领最高档。
- 每档仅领取一次；先领低档，不扣充值累计，后续还能达到高档。领取接口一次领取全部已达标未领取档位。
- 手动领取，达标不自动加币。活动奖励与充值订单本身配置的赠送分别入账。
- 默认expireUnclaimed=false：活动到期停止累计，已在期内达标的奖励仍可领取；未达标档位过期。设true则到期未领取的达标档位也作废。
- 新账号在注册事务中固定期限、档位及到期领取规则。改配置影响后续参与账号，不改变已有参与账号的快照；改规则建议更新version。
- 功能上线前已有账号仅在仍处于注册后有效期时可以参与；首次参与时已经过期的账号不追溯发历史奖励。

配置要求：durationDays为1–3650整数，version非空，至少一个档位；id唯一，门槛按升序且大于0，奖励大于0，全部奖励之和不能超出整数范围。

## 查询活动和进度

`GET /api/activity/newbie-recharge/info?uid=123&sid=YOUR_SID`

例如累计成功充值500元、尚未领取：

```json
{
 "code":"OK",
 "data":{
  "startsAt":"2026-11-03T10:00:00Z",
  "endsAt":"2026-11-06T10:00:00Z",
  "durationDays":3,
  "status":"active",
  "rechargeAmount":50000,
  "claimableTotal":6000,
  "configVersion":"newbie-recharge-v1",
  "expireUnclaimed":false,
  "remainingSeconds":172800,
  "items":[
   {"id":"recharge_100","requiredRecharge":10000,"reward":1000,"progress":10000,"remaining":0,"status":"claimable"},
   {"id":"recharge_500","requiredRecharge":50000,"reward":5000,"progress":50000,"remaining":0,"status":"claimable"},
   {"id":"recharge_1000","requiredRecharge":100000,"reward":10000,"progress":50000,"remaining":50000,"status":"locked"}
  ]
 }
}
```

前端按progress/requiredRecharge展示进度条，remaining是还差多少充值；progress封顶在本档门槛，rechargeAmount保存活动内完整累计。claimableTotal是所有可领取档位合计。remainingSeconds用于倒计时，最低0；startsAt、endsAt为UTC RFC3339。

活动status：active=累计期内；ended=累计期结束（仍可能有可领奖励）；ineligible=首次参与时已经超过新手有效期。

档位status：locked=尚未达标；claimable=可领取；claimed=已领取；expired=未达标过期/不符合参与资格，或配置要求到期未领作废。

倒计时到0后重新查询，不要仅因活动ended就隐藏领取按钮；应以各档status和claimableTotal判断。

## 一次领取全部可领奖励

`POST /api/activity/newbie-recharge/claim`

```json
{"uid":123,"sid":"YOUR_SID","requestId":"client-unique-claim-id"}
```

uid/sid也可在公共查询参数中，两处同时传必须一致。requestId由客户端生成，每次新的领取意图使用新编号；断网重试复用原编号，1–128字节，无控制字符或首尾空白。客户端不能传金额或指定领取档位。

```json
{
 "code":"OK",
 "data":{
  "claimId":"nrc_SERVER_ID",
  "totalReward":6000,
  "coins":57000,
  "items":[
   {"id":"recharge_100","requiredRecharge":10000,"reward":1000,"progress":10000,"remaining":0,"status":"claimed"},
   {"id":"recharge_500","requiredRecharge":50000,"reward":5000,"progress":50000,"remaining":0,"status":"claimed"}
  ]
 }
}
```

items只包含本次实际领取的档位。coins是本批次结算后的余额快照，当前余额从用户信息查询。例中充值500元按充值配置赠送2%后钱包510元，再加本活动60元，合计570元。

按(uid,requestId)幂等，重复请求返回原批次（即使后面又达成新档位或活动已经结束）。领取新达标档位必须换新requestId；已领取档位即使用新编号也不能重复领取。并发请求、批次、档位状态、钱包余额和source流水均通过同一事务及钱包行锁保护，任意一步失败全部回滚。

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | 10010001 | 参数/请求号无效 |
| 401 | 10010002 | 会话无效 |
| 400 | 10010018 | 当前无可领取的新手充值奖励 |
| 400 | 10010009 | 余额超出整数范围，未入账 |
| 500 | 10010005 | 数据库异常，事务回滚 |

## 数据与source

使用成功充值订单和精确成功时间统计，不扫描金币source，也不依赖客户端上报。独立索引(uid,成功时间)支持窗口累计；legacy订单无settledAt时兼容createdAt作为原即时成功时间。

lobby_newbie_recharges保存参与时间和规则快照，lobby_newbie_recharge_tiers保存每档门槛、奖励和领取归属，lobby_newbie_claim_batches保存幂等领取批次。source由script/coin_sources.py统一维护：SourceNewbieRecharge=act_006。合领一批记一条总额流水，逐档明细通过batch_id关联。

测试包括付款中不计、重复订单、门槛累计不消耗、逐档领取、多个档位合领、并发领取不重复加币、截止时间边界、到期规则、老用户不可追溯参与、配置快照及入账失败回滚。
