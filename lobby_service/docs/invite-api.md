# 邀请好友

服务端配置`etc/invite.json`，可用`LOBBY_INVITE_CONFIG`覆盖。金额全部为分；默认注册后30日、成功存款5次、本金50000、实际投注500000、每位奖励20000，阶梯表10行。大厅基础地址`baseUrl`部署时应换成对外地址；客服链接配置为https://t.me/tucker881。

- `POST /api/user/account/visitor/login`可携带`inviteCode`，仅首次创建游客时参与绑定。用户、钱包、会话、邀请关系同一事务。无效邀请码不阻断游客创建；已有用户续期/登录不绑定，游客绑定正式账号保持同一UID和关系。一个invitee只能有一个inviter，不允许自己邀请自己。
- `POST /api/activity/invite/info`：uid/sid鉴权；返回inviteUrl、supportUrl、rules、invitedCount、qualifiedCount、pendingAmount、claimedAmount。邀请链接为服务端生成的专属随机邀请码，不是会话凭据。
- `POST /api/activity/invite/claim`：uid/sid/requestId，一次领取全部待领邀请奖励，返回claimId、totalReward、coins。相同requestId可重试并获得同一收据；不同请求不能重复领取同一奖励。

创建游客时保存活动门槛和奖励快照。资格判定区间为[registered_at,deadline)，成功充值以settled_at（历史缺失时created_at）归属，金额只计amount本金，排除赠送。投注取可信game_bet事件的amount而非有效投注值，只统计不晚于当前时间的数据。即使首次查询发生在期限之后，期限内全部达标仍可形成待领奖励；未增加领取失效期限。资格在活动查询/领取时幂等确认，不依赖客户端报数。

领取使用邀请人钱包行锁，奖励唯一键为inviteeUID；奖励状态、批次、余额、source流水必须原子提交。source为act_007（SourceInviteReward），个人报表单列inviteReward并计入净输赢；钱包明细支持invite类型。不实施同IP限制，不要求下载APP或绑定收款信息。

### 赚钱页宝箱与好友详情

- `POST /api/activity/invite/chests`：身份字段 `uid/sid` 与 `page`（从 1 开始）。每页固定 100 个宝箱，超过 100 个有效邀请可翻页。返回 `info`（邀请统计、规则、链接）、`items`（`slot/rewardId/amount/status`）、`page/hasMore`。
- `POST /api/activity/invite/chest/claim`：身份字段与 `rewardId/requestId`。只领取指定的一份邀请奖励；请求号重试返回原收据，不能用同一请求号领取另一个宝箱。余额、流水、领取标记原子提交。
- `POST /api/activity/invite/friends`：身份字段与 `page`。只返回自己的直属好友，每页 20 条，`hasMore` 表示下一页。账号、注册时间、累计存款本金、投注额和未达标原因均来自服务端。

宝箱只有 `locked/claimable/claimed`，没有“已过期”状态。每位好友的注册时间、期限和门槛以创建游客时保存的配置快照为准。当前默认 **注册后 30 日内**，统计区间为 `[registeredAt, deadline)`；恰好在截止时刻及之后的存款和投注不计入，期限内已达标的奖励仍可领取。未达标原因只包括 `deposit_count/deposit_amount/bet_amount`，页面按该好友的期限与门槛展示中文或英文。好友详情累计值也是该资格区间内的值，不是终身金额，不包括充值赠送。

宝箱序号在奖励生成时持久化，领取顺序不会改变其他宝箱的位置。没有自动轮询或切窗口刷新；进入页面、手动重试、手动领取后才读取最新数据。`/invite` 仍仅介绍规则、复制邀请链接和打开 Telegram 客服。
