# VIP（MVP）

独立大厅服务，基础地址http://127.0.0.1:8081。接口均需要有效uid、sid，支持公共查询参数，响应header包含X-Trace-Id。金额统一是JSON数字、整数分，展示时除100。

## 配置来源与单位

[etc/vip.json](../etc/vip.json)按本次截图录入VIP0–VIP30。截图金额为元，文件中全部乘100存为分，包括晋级/保级流水、充值门槛、礼金、工资及工资门槛。核对表见[VIP配置表（元）](vip-config.md)。

例如VIP1晋级需1元有效流水，配置upgradeBet=100；VIP2再需3000元，upgradeBet=300000。VIP2升级礼金3元、周工资2元、月工资3元，分别是300、200、300分。VIP24月工资按截图的2776元录入。

环境变量LOBBY_VIP_CONFIG可覆盖路径，修改后重启生效。等级必须从0连续到N，VIP0全部金额为0。0门槛表示不限制。生日礼金列按图保留为0，本版没有生日活动。version用于记录任务与奖励规则版本；新规则应更换version。不要直接删减已有用户达到过的等级。

## 升级和奖励

- 每一级是新增要求，不是终身累计阈值；有效流水和成功充值分别累计，两项均满足才升级。
- 升级扣除本级消耗，剩余结转，支持单次跨多级；0门槛不消耗该项进度。
- 例如配置VIP1需100、VIP2需1000，打105后VIP1，剩余5，升VIP2还差995（示例单位一致，与截图数值独立）。
- 当前等级可下降，历史最高等级只上升。每一级仅首次达到时产生一次奖励资格；重升不重复发奖。
- 首次达到时保存礼金金额快照。已获得但未领取的升级礼金不因降级、配置修改而消失，不过期。
- 升级接口一次领取所有待领升级礼金，明细逐级返回，共用一个批次入账；不自动发钱。

## 保级

- 正常状态下，连续整整30×24小时没有有效流水、没有成功充值，进入15×24小时保级任务。登录、领取奖励、中奖、免费局零有效流水不重置计时。
- 任务固定当时等级的保级流水/充值门槛、开始时间、截止时间及配置版本。任务开始后修改配置不改变该任务。
- 进入保级时，原有升级流水和充值进度立即清零。任务期间完整记录新增有效流水及成功充值，升级进度维持0，不能提前升级，也不会延长任务截止时间。
- 某一项提前达标、另一项未完成时，仍继续完整累计，包括提前超额部分；必须两项同时满足才能保级成功。
- 保级成功时，将整个保级期间累计的流水、充值全部计入当前等级升级进度，不扣除保级门槛；达到下一等级要求时可立即连续升级。之后恢复正常累计。
- 例如原有升级流水5000，进入保级先清零；任务要求流水1000，期间累计1500且充值也达标，成功后升级流水为1500，不是500，也不是6500。
- 成功后按最后活动时刻重新计30天；失败则降一级，两项升级进度和本次保级累计全部归零、不结转到低一级，历史奖励资格保留，从降级时刻重新计30天。
- 一直无活动时，每轮30天观察+15天任务继续降一级，最低VIP0。离线或服务停机不暂停倒计时，恢复后按持久时间点追赶。
- VIP0没有降级任务；保级两个门槛均为0时自动保级，无需执行15天任务。自动保级同样清零原升级进度；截图VIP1即为这种配置。
- 截止时刻不包含在任务有效期内：恰在截止时间收到的新活动，先执行到期降级，再累计该笔活动。
- 保级数据始终正常计入每日统计、工资、签到、反水；进入保级或降级不会删除这些业务统计。升级进度则仅在保级成功时接收本次完整累计。

## 工资：服务端结算，用户领取才加钱

活动时区与签到统一，默认Asia/Jakarta。周一00:00结算上周一至周日，月初1号00:00结算上个自然月。

- 档位按结算时刻有效VIP等级，检查该档位的上一周期有效流水与成功充值；两项都满足才有资格。
- 后台每秒处理到期状态，记录等级、工资金额、条件、实际进度快照。已经结算的记录不会因为后续升级、降级、补入统计或改配置而重新计算。
- 定时任务尚未执行时，VIP活动/查询会按相同时间顺序补处理到期结算，然后才处理新升级，避免用户请求时机改变工资档位。
- 若保级降级和工资在同一时刻到期，先处理到期降级，再结算工资。
- 周工资限周一当天领取，月工资限1号当天领取，窗口结束未领作废。两者独立领取。
- 结算不改钱包。领取时奖励记录、金币source、钱包余额一起事务提交。
- 当前周期preview用当前等级展示预计档位和累计进度，尚未结算；后续升降级会影响预估。preview.amount是当前档位工资，须结合门槛进度判断是否预计达标。

## 获取VIP信息

`GET /api/vip/info?uid=123&sid=YOUR_SID`

返回code=OK、data，字段如下：

| 字段 | 内容 |
| --- | --- |
| activityDate / timezone | 当前活动日期、统一时区 |
| idleDays / protectionDays | 30天观察期、15天任务期配置 |
| levels | 0–N完整配置，供客户端展示等级表及下一级要求 |
| state.level / highestLevel | 当前等级、历史最高等级 |
| state.upgradeBet / upgradeRecharge | 尚未消耗的升级进度；进入保级清零，保级中保持0 |
| state.status | normal或protecting |
| state.idleSince | 最近活动/降级后观察计时起点；自动保级时也会更新 |
| state.protectionStart / protectionEnd | 当前任务开始、截止；无任务为空字符串 |
| state.protectionBet / protectionRecharge | 当前保级完整累计，允许超过门槛；成功时全部转入升级进度 |
| state.protectionRequiredBet / protectionRequiredRecharge | 当前任务门槛快照 |
| upgradeRewards | 当前全部待领升级礼金，按等级升序 |
| upgradeClaimableTotal | 全部待领升级礼金合计 |
| weekly / monthly | 上一周期已结算工资记录及可领状态 |
| weeklyPreview / monthlyPreview | 本周期实时累计与工资档位预估 |

levels每项包含：level、upgradeBet、upgradeRecharge、keepBet、keepRecharge、upgradeReward、weeklyReward、monthlyReward、birthdayReward、weeklyBet、weeklyRecharge、monthlyBet、monthlyRecharge。

奖励项字段示例：

```json
{
 "rewardId":"vpr_SERVER_ID",
 "kind":"weekly",
 "level":2,
 "amount":200,
 "status":"claimable",
 "periodStart":"2026-05-25",
 "periodEnd":"2026-06-01",
 "availableAt":"2026-05-31T17:00:00Z",
 "expiresAt":"2026-06-01T17:00:00Z",
 "requiredBet":10000,
 "requiredRecharge":10000,
 "actualBet":300000,
 "actualRecharge":10000
}
```

日期区间包含开始、不包含结束；时间戳以UTC RFC3339返回，客户端按timezone显示。升级奖励的周期日期、expiresAt为空。预估记录无rewardId；上线前周期或用户加入前周期没有工资记录时返回no_reward。

| status | 含义 |
| --- | --- |
| claimable | 当前可领取 |
| claimed | 已领取，金额快照保留 |
| expired | 曾达标，但已过领取窗口 |
| ineligible | 上周期流水/充值不达标 |
| no_reward | 此等级金额为0或本周期无结算资格 |
| preview | 当前周期预估，不能提前领取 |

## 领取接口

- `POST /api/vip/upgrade/claim`：一次领取全部待领升级奖励。
- `POST /api/vip/weekly/claim`：领取当前窗口内已结算周工资。
- `POST /api/vip/monthly/claim`：领取当前窗口内已结算月工资。

三个接口请求结构相同：

```json
{"uid":123,"sid":"YOUR_SID","requestId":"vip-claim-unique-client-id","activityDate":"2026-06-01"}
```

requestId由客户端为一次领取意图生成，1–128字节，无首尾空白和控制字符。超时重试复用原requestId和原activityDate；下一次领取生成新requestId。不能提交金额、等级或目标余额。uid/sid也可通过公共查询参数传入，两处都传必须一致。

```json
{
 "code":"OK",
 "data":{
  "claimId":"vpc_SERVER_ID",
  "totalReward":900,
  "coins":100900,
  "items":[
   {"rewardId":"vpr_2","kind":"upgrade","level":2,"amount":300,"status":"claimed","periodStart":"","periodEnd":"","availableAt":"2026-05-31T10:00:00Z","expiresAt":"","requiredBet":0,"requiredRecharge":0,"actualBet":0,"actualRecharge":0},
   {"rewardId":"vpr_3","kind":"upgrade","level":3,"amount":600,"status":"claimed","periodStart":"","periodEnd":"","availableAt":"2026-05-31T10:00:00Z","expiresAt":"","requiredBet":0,"requiredRecharge":0,"actualBet":0,"actualRecharge":0}
  ]
 }
}
```

例中VIP2+VIP3待领礼金为3+6=9元。items升序展示每级礼金，totalReward合计；coins是该批次结算后的余额快照，当前余额从用户信息获取。

按(uid,kind,requestId)幂等。相同请求重试返回原批次，即使跨天也不误领新的奖励。新请求日期过期则拒绝，刷新info后使用新请求号操作。已领奖励即使用新requestId也不能重复领取。

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | 10010001 | 参数、请求号或日期格式无效 |
| 401 | 10010002 | 会话无效 |
| 409 | 10010014 | 新领取请求日期过期，请刷新 |
| 400 | 10010016 | 没有可领取VIP奖励，或工资条件不达标/已过期 |
| 400 | 10010009 | 余额/进度超出整数范围，事务回滚 |
| 500 | 10010005 | 数据库异常，事务回滚 |

## 可信事件与部署

VIP复用业务事件，不扫描游戏金币source。有效game_bet和成功recharge_success同时更新统计及VIP状态；game_win不增加VIP进度、不重置无活动时间。重复业务事件不会重复累计VIP。充值结算在同一事务处理，付款中和失败不累计。

VIP升降级时序使用服务端接收处理时间，历史迟到事件仍归属原日统计，但不会倒改已结算VIP等级/工资。未来机台结算接入须保证可靠、及时投递，不能让客户端上报流水。

现有账号启用时从VIP0初始化，不追溯旧事件发升级奖励。后台分批初始化，支持服务重启继续处理，真实机台流水仍待接入。新账号在创建事务内建立VIP状态。

source统一由script/coin_sources.py维护：升级vip_001、周工资vip_002、月工资vip_003。升级合领每批一条总额source流水，逐等级明细保存在lobby_vip_rewards；工资也是独立批次。奖励明细、批次、source、余额原子提交。
