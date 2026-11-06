# 大厅服务开发约定

按 `/Users/zhaoyao/.codex/skills/apps-skills/SKILL.md` 开发，按任务读取相关 references。

- 采用 HTTP 单体方案，入口 `app/apis/lobby/api`；handler → logic → repository/model，由 svc 注入依赖。
- Protocol First：修改 `protos/`，执行 `make build` 生成 pb 和 HTTP 路由。禁止手改生成文件。
- 数据库独立：PostgreSQL `aislots_lobby`、端口 55433、独立容器/卷，禁止读写机台数据库或引用机台模块。
- 数据访问用 GORM；先执行迁移、验证表存在，再 `make model` 从真实表生成模型，自定义操作写在 `*_model.go`。
- 错误码定义在 proto，公共日志和错误使用 pkg/xlog、pkg/xerr；不得记录密码、sid 或完整请求/URL查询串。
- 保留五个客户端指定路径、uid/sid 鉴权和默认60天滚动续期。加解密经 pkg/codec，MVP透传。
- `make build`、`make mock` 可复现生成；`make test`、`make lint`、`make format` 为开发检查。
- pkg 覆盖率至少90%，logic/manager至少80%。

适配说明：skill 示例中的 MySQL 改用现有独立 PostgreSQL，不改库、不清数据。尚无独立协议仓库，proto先跟随本模块版本管理；提供真实仓库后再提取为submodule。未引入skill示例未提供的内部框架源码，生成器及最小xlog/xerr在本模块实现。

- 金币source仅在 script/coin_sources.py 的 SOURCES 中维护；make source生成常量与文档，已有source值不可修改/复用。
- 充值档位在etc/recharge.json配置，赠送/手续费互斥；所有金币入账必须同时记录source流水和幂等业务订单。

- 签到配置etc/checkin.json；活动统计通过eventType及每日汇总，不扫描source。客户端禁止提交流水；未来游戏适配器通过可信业务事件记录，事件去重、奖励、余额及source必须有事务保证。活动时区上线后保持固定。

- 反水/亏损返还配置etc/returns.json，整数基点；统一签到时区。日周月反水一批次合领，loser_return单独批次，按领取日期幂等；明细、source、余额原子提交。game_bet区分实际投注和有效流水，game_win只记实际游戏派彩，客户端不得上报统计。

- VIP配置etc/vip.json全部为分，截图原单位元。VIP状态引擎挂接用户创建及可信事件/充值事务，禁止按请求次数累计。进入保级立即清零升级流水和充值进度；期间完整累计（不封顶），成功后全部转入升级进度并继续判断升级，失败降级后清零；工资按服务端时间顺序先结算快照，点击领取才加币，任务/奖励/批次跨重启持久化。VIP确定性时间测试使用隔离schema，禁止用未来时间推进真实账号。

- 新手累计充值配置etc/newbie-recharge.json：注册时固定期限/档位/到期规则，成功订单本金按精确时间窗口累计，多档奖励叠加且每档仅一次，requestId幂等合领。新功能启用前老账号若首次参与时已过新手期限，不追溯发奖。领取批次、档位、source、余额必须事务提交。

- 大厅UID由PostgreSQL identity从10000001开始生成；迁移/重启不得回退序列或重用已分配UID，已有账号及其关联记录保持原标识。

- 代理复用永久邀请关系、无限层级，各厂商每日独立定档；绑定后的可信有效投注经持久化事件队列后台汇总。佣金日厂商总额截分、成员明细累计分配零头；历史日规则快照固定，领取批次/source/余额原子提交，已付历史异常留队核对。

- 取款流水要求配置 etc/turnover.json：启用后加币按来源倍数增加、可信有效投注同步抵扣；派彩和取款退回本金豁免，0倍免要求，不追溯或预存历史流水。数据库触发器与钱包原事务提交，共用钱包行锁；新增来源须显式配置，旧明细倍数不重算，取款创建在锁内复核，旧请求回执优先恢复。

- 大厅后台为独立入口 `app/apis/lobby/api/admin`，默认127.0.0.1:8082；不得把后台路由注册进玩家监听器。后台协议独立descriptor及生成器，`make build`统一生成，禁止手改routes.gen.go/pb。
- 后台业务配置使用数据库草稿、发布版本、回滚与审计。etc仅首次缺失分区初始化；重启不得覆盖已发布内容。密钥/部署地址保留环境变量，活动时区和平台身份不能在线修改。
- 草稿CAS使用单调row.Version，客户端传max(publishedVersion,draftVersion)，不能仅比较可清零的draftVersion。发布事务跨分区序列化，运行时用一致快照读取版本和文档，旧请求保留旧依赖。
- 后台资金审核只接受原订单与请求标识，钱包行锁、订单状态、账变及审计同事务；取款approved只表示审核通过待付款，不能假装渠道已出款。
- 返水/亏损返还费率使用lobby_return_rate_rules历史周期规则；发布与回滚仅调度下个日/周/月边界，亏损按日，不能按当前Config.Returns重算已结束或进行中的周期。大厅比例展示使用实际preview周期费率（含0）。
