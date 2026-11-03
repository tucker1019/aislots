# 无限层级代理

复用 `lobby_invite_relations`，注册时绑定且不能换上级。`lobby_agent_paths` 保存祖先、成员、距离、直属分支和生效时间；历史绑定关系迁移后沿用，期限只属于邀请活动，不限制代理收益。账号正式绑定不会改变关系。自己投注不产生自己的代理佣金。

## 日结规则

沿用签到的活动时区，按自然日 `[00:00,次日00:00)`。每个厂商独立配置档位、累计所有层级下级有效投注（不含本人）并定档，整档适用于当天全部流水，不是累进。有效投注来自可信 `game_bet` 事件，采用 `valid_bet_amount`，历史缺失时使用 `amount`；不扫描source或接受客户端上报。

代理佣金＝Σ（直属成员本人有效投注 × 自己比例＋该直属成员团队有效投注 ×（自己比例－直属成员比例））。深层成员的业绩会抬高上级档位；同档的差额为零。

配置 `etc/agent.json`，环境变量 `LOBBY_AGENT_CONFIG` 可覆盖。threshold为整数分，rate为“每10000金额单位返多少相同金额单位”，例如rate100=1%。默认档位与用户截图一致：1/10000/30000/100000/300000/1000000/3000000/10000000/30000000/50000000元，对应每万30/40/50/60/70/80/100/150/200/300。当前只有AG。新厂商需在games和agent两处配置一致的厂商标识；同厂商所有游戏合计。

按原示例，A团队331万、B1团队13万、B3团队300万：A档100/万、B1档60/万、B3档100/万。A直属18万×100/万=1800；其余13万×40/万=520；C3差额为0。A合计**2320**，B1为780，B3为30000（单位元）。原95/万示例中的A仍为2165。

每个日、厂商保存规则与游戏映射快照。首次启用时，已有绑定后的历史事件按当前配置补算；已保存的日规则不因后续改配置而重定价。若需要历史曾经使用过的其他比例，应先明确历史配置再启用。

佣金按每日、厂商汇总后向下取整到分。成员明细用累计取整分配零头，明细之和严格等于日佣金；不能逐成员独立截断后再相加。周月查询只累加每日结果，不重新定档。

## 异步与持久化

数据库触发器在可信投注/派彩事务中追加持久化待处理事件，不遍历祖先、不执行团队汇总。后台约5秒处理一次，首次按日期建立基线，此后只增量消费队列内事件更新成员业绩和祖先贡献，再重算该日厂商档位及佣金；不反复扫描当天所有原始投注，页面读取汇总。队列按事件独立记录，汇总时不锁定新事件入队。所有日期计算及领取共用事务级结算锁，重复事件不会重复累计。

当天为preview；次日后台将上一日标记settled，未登录也会处理，重启继续补齐。待领永久累计，手动一次领取全部已结算未领金额。余额、日佣金领取标记、领取回执与`agt_001`source账变同一事务提交。同(uid,requestId)返回原回执，新奖励需要新请求号。记录展示领取批次，不是每天的预估记录。

已领取日期若异常补入历史事件，不会静默重写已付佣金或补发错误差额；保留待处理记录并输出`agent historical event after payout`错误，需人工核对。正常游戏结算按大厅当前服务端时间记账，不回写过去时间。应监测队列积压、最早业务日期、worker错误和日结延迟。该情况不阻断其他日期继续处理。

## 接口

以下均为POST JSON，需要当前登录uid/sid。成功封装`{code:"OK",data:...}`，金额为数字整数分，不能传金额或上报流水。响应提供X-Trace-Id。

| 路径前缀 `/api/agent/` | 用途 |
| --- | --- |
| `info` | 今日佣金预估、待领、团队人数、今日新增和邀请链接 |
| `team` | 指定成员的直属下级；可逐层下钻 |
| `performance` | 各厂商业绩与对当前代理的佣金贡献 |
| `performance/details` | 各实际投注成员贡献的有效投注及差额佣金 |
| `report` | 团队人数/新增、投注、首存、存款汇总 |
| `report/details` | 团队、投注、首存、存款明细 |
| `rates` | 各厂商现行档位配置 |
| `records` | 当前用户领取记录，按领取时间倒序 |
| `claim` | 合领全部已结算未领佣金 |

通用查询：

```json
{"uid":10000001,"sid":"会话","targetUid":0,"period":"today","provider":"AG","scope":"all","search":"","page":1,"kind":"bets"}
```

- targetUid为0表示自己；其他值必须在当前用户下级树内。所有查询由服务端检查权限，不能查上级、同级或外部用户。
- period为today/yesterday/this_week/last_week/this_month/last_month，周一为每周开始。
- provider为空表示全部，否则必须配置过。不同厂商的档位和佣金不混算。
- scope为all/direct/other；直属depth=1，其他depth>1。
- team中的search精确匹配当前成员下级树内账号或UID，未搜索时只列直属下级；report中的search定位当前下级树中的代理，查询他的团队。
- page从1开始，每页20条，hasMore用于下一页。rates及厂商汇总返回完整配置/厂商。
- report/details的kind为team/bets/first-deposit/deposit/withdrawal。withdrawal返回成功取款明细，按结算时间统计取款本金，排除待处理、失败、退款订单；与充值一样受绑定时间和直属/其他范围限制。

统一查询响应包含summary、items、hasMore、from/to、timezone、status、updatedAt、providers、account、inviteUrl。summary包括teamCount/directCount/otherCount/newCount/directNew/otherNew、validBet/commission/directCommission/otherCommission/claimable、betCount/bettorCount/profit、firstDepositCount/firstDepositAmount/depositCount/depositAmount/withdrawalCount/withdrawalAmount。不存在的数据为0，网络错误不能用0替代。

items按接口使用字段：

| 类型 | 字段 |
| --- | --- |
| 团队 | uid/account/registeredAt/depth/children（直属下级数） |
| 厂商业绩 | provider/validBet/commission |
| 成员贡献 | uid/account/depth/validBet/commission（给查询代理的贡献，不是成员自己收入） |
| 团队流水 | uid/account/registeredAt/depth/validBet（本人）/teamBet（不含本人） |
| 投注详情 | uid/account/depth/validBet/profit |
| 首存详情 | uid/account/depth/paymentType/amount |
| 存款详情 | uid/account/depth/amount（周期内成功本金合计） |
| 比例 | provider/threshold/perTenThousand |
| 领取记录 | claimId/amount/createdAt |

首存指用户历史第一笔成功充值，使用成功时间归属查询周期，同时间按稳定订单号判定；pending不算，金额只计本金。存款人数和投注人数在周期内去重。注单数来自付费game_bet事件，消除和免费不重复计数。盈亏是玩家派彩减实际投注。代理报表不包含查询代理本人。

领取：`{uid,sid,requestId}`，requestId长度1–128且无首尾空格/控制字符。返回`{claimId,amount,coins,createdAt}`；无可领返回HTTP400/code10010015。鉴权失败401；越权、无效筛选参数400。领取后客户端重新查询钱包，不能用重试回执中的历史余额覆盖当前余额。
