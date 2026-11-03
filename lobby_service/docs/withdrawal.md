# 取款

金额单位为分，配置 `etc/withdrawal.json`，与充值配置独立。50 收3%手续费，100不收不送，200至1000赠送1%，2000至10000赠送3%。不提供10/20取款档位。

POST接口均带uid/sid：
- `/api/user/withdrawal/tiers`：档位与testMode。
- `/api/user/withdrawal/create`：tierId/channel/requestId，必须绑定收款账号姓名。requestId保持不变重试；订单保存绑定资料快照。
- `/api/user/withdrawal/info`：orderId，限本人。
- `/api/user/withdrawal/test-review`：orderId/decision(approve或return)，仅`LOBBY_WITHDRAWAL_TEST_MODE=true`开放。
- `/api/user/cash/orders`：from/to（RFC3339），kind(all/deposit/withdrawal)，cursor分页。

申请事务扣本金及写wdr_001流水；手续费只减少外部到账额，不另设手续费source。通过时直接发放赠送wdr_003；退回时返还本金wdr_002。订单只能进入一个最终状态，同一审核可幂等重试，相反审核冲突。资金流水、余额和订单状态原子提交。

个人报表取款以成功订单审核时间统计，赠送单列并计入净输赢。邀请资格新增活动期限内绑定取款账号要求，已生成邀请奖励保留。
