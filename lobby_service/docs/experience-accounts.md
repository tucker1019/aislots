# 平台体验账号（MVP）

大厅调度一名体验账号，游戏服自动执行整局，逐轮结算、真实订单和回放复用原流程。游戏服不知道账号分类，正常玩家逐轮 spin 接口不变。公开排行榜通过 experienceAccount 布尔字段显示“平台体验账号”标签。

## 开关与金额

默认配置 `etc/experience.json` 为关闭。`LOBBY_EXPERIENCE_CONFIG` 指向实际配置；每5秒重新读取，无需重启即可启停。可复制为被 Git 忽略的 `etc/experience.local.json`。

```json
{"enabled":true,"bet":10,"betLevel":1,"intervalSeconds":20,"initialCoins":10000000}
```

MVP 固定 AG1、一名账号。金额为分，实际投注 = bet × betLevel × 游戏配置线数，目前 10 × 1 × 20 = 200 分。每局全部结束后等待20秒再开始；不是每轮等待。初始资金只注入一次，来源 exp_001，非真实充值。余额不足暂停并保留原请求，不自动无限补币。后续改 initialCoins 不会追加余额。固定档位必须在游戏服合法列表内。

停止开新局时把 enabled 改为 false；已保存的请求仍继续到完成。停服时未完成命令保留，重新启动恢复。生产首次部署保持关闭，确认配置后启用。此版本不包含多账号、时间段和管理后台。

## 服务间调用

协议：`slots_service/protos/auto_round.proto`。POST `/internal/auto-round`，Bearer 使用现有大厅与游戏服共享服务凭据，不向浏览器暴露。

请求：requestId、uid、gameId、bet、betLevel、country、currency。游戏服按自己配置的平台身份构造玩家上下文。响应为 `{code:"OK",data:{status:"complete",requestId,betId}}`，无盘面和重复输赢结果。

大厅先持久化命令，再请求游戏服；超时或重启永远使用原 requestId 与原档位。游戏服持久化每轮 spin token，持有跨实例账号锁，完成免费/消除后返回回执。某轮已结算但保存任务进度失败时，按原 token 读取该轮幂等回执。服务实例关闭导致中断后，由大厅重试恢复；没有独立轮询接口或独立后台游戏任务。正常钱包扣币/派奖与完局通知仍使用已有接口。

一名用户同时只能有一笔自动任务；不能同时以浏览器操作同一个体验账号。当前档位验证依赖现有游戏配置，修改游戏下注规则之前应先停止并排空任务。

## 数据与统计

- `lobby_users.account_type` 为 real/experience，不允许修改，默认 real。体验账号无公共登录凭据。
- `lobby_experience_accounts` 单独管理UID、待执行请求、原始档位、下次执行时间、最近订单；数据库约束MVP仅一条。
- 钱包、金币流水、游戏结算、完局表仍走原流程；流水/结算/完局保存账号类型快照。
- 体验投注事件单独存 `lobby_experience_events`，不进入普通活动每日汇总、VIP、签到、反水、邀请、代理和取款流水要求；体验账号不初始化VIP状态。
- 体验资金 exp_001 配0倍流水要求。资金注入、账号及流水在同一事务；重启不重复注入。
- 公开排行榜包括真实产生的体验订单，客户端显示独立身份标签；RTP仅统计真实用户。
- 运营分类查询视图 `lobby_bet_statistics_by_account_type`，按 UTC 日期、游戏、账号类型聚合真实结算，可查询 real、experience，或对两类求和。金额单位分；paid_bets为付费局数，win_amount为全部已结算逐轮派彩。

```sql
SELECT * FROM lobby_bet_statistics_by_account_type WHERE account_type='real';
SELECT * FROM lobby_experience_accounts;
```

## 验证

新增测试覆盖整局免费流程、原请求重复调用、服务重建、已结算轮在checkpoint前中断、回放记录、体验事件与活动隔离、资金仅注入一次、账号类型不可修改、排行榜标记和真实RTP排除。
