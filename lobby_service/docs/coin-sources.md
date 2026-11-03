# 金币 source 注册表

由 `script/coin_sources.py` 生成。新增类型只修改脚本中的 SOURCES，执行 `make source`。已有值永久保留，不能修改或复用。

| 英文枚举 | 流水存储值 | 含义 |
| --- | --- | --- |
| `SourceWithdrawalDebit` | `wdr_001` | 取款申请扣除本金 |
| `SourceWithdrawalRefund` | `wdr_002` | 取款退回返还本金 |
| `SourceWithdrawalBonus` | `wdr_003` | 取款通过赠送加币 |
| `SourceAgentCommission` | `agt_001` | 代理日结佣金领取 |
| `SourceInviteReward` | `act_007` | 邀请好友奖励加币 |
| `SourceGameBet` | `game_001` | 游戏投注扣币 |
| `SourceGameWin` | `game_002` | 游戏逐轮派彩 |
| `SourceNewbieRecharge` | `act_006` | 新手累计充值奖励 |
| `SourceVIPUpgrade` | `vip_001` | VIP升级礼金 |
| `SourceVIPWeekly` | `vip_002` | VIP周工资 |
| `SourceVIPMonthly` | `vip_003` | VIP月工资 |
| `SourceRebateDaily` | `act_002` | 日反水奖励加币 |
| `SourceRebateWeekly` | `act_003` | 周反水奖励加币 |
| `SourceRebateMonthly` | `act_004` | 月反水奖励加币 |
| `SourceLoserReturn` | `act_005` | 亏损返还奖励加币 |
| `SourceCheckinReward` | `act_001` | 签到奖励加币 |
| `SourceRechargeCredit` | `rch_001` | 充值本金加币 |
| `SourceRechargeBonus` | `rch_002` | 充值赠送加币 |
| `SourceRechargeFee` | `rch_003` | 充值手续费减币 |
