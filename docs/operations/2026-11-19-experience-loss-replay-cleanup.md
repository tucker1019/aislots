# 体验账号直接无奖回放优化与测试库清理

## 确认范围

- 保持原开奖、抽样、盘面生成、结算及统计流程。
- 仅体验账号首次付费基础局：派彩为 0、单帧直接完成、没有免费／重转或待执行状态时，直接跳过原始开奖结果及展示帧的写入。
- 中奖、免费链（包括总派彩为 0）、多步骤和普通账号保留原路径。
- 保留投注摘要、必要运行状态、最小幂等回执、下一请求号、自动任务以及金币结算和统计记录。
- 本次不实现排行榜前 100 或 50 倍条件，不让游戏层查询大厅账号库或排行榜。

## 代码位置

- 大厅体验调度：`lobby_service/app/apis/lobby/api/internal/server/experience_pool.go`，可信 internal auto-round 命令带 `skipZeroWinReplay=true`。
- 游戏：`slots_service/internal/application/play/service.go`，在原引擎完成开奖及验证后决定是否写入回放；`spin.go`、`postgres/receipt.go` 保存最小幂等回执。
- 查询：`postgres/history.go` 对省略的回放明确返回不存在；统计仍按一局计算，缺少紧邻前局展示时不借用更早盘面。
- 维护：`slots_service/cmd/storage-maintenance`、`postgres/experience_loss_cleanup.go`，使用从大厅导出的体验 UID 快照，只连接游戏数据库。
- 操作参数与发布兼容规则见 [存储优化说明](../../slots_service/docs/storage-optimization.md)。

## 历史清理保护

对指定 appname/appkey 和体验 UID 核对已完成零派彩票据、基础局最终帧、spinIndex=0/stepIndex=1，且无其他帧或旋转。完整旧回执用于核对，v1 引用回执读取源帧。精确跳过尚未 checkpoint 的自动局 betId/原请求号、待确认结算及锁定中的记录。

每批先同步保存 gzip JSONL，包含原 ticket、receipt、frames、spins 完整行；备份失败时该批回滚。随后精简回执，删除 `spin_steps` 和 `game_spins`，标记票据 `ReplayOmitted=true`。不删除金币账变、投注摘要、大厅记录、自动任务或统计队列。

维护使用有限物理页窗口减少随机 I/O，各窗口仍使用业务主键和行锁核对与修改。支持 1–4 个工作连接，窗口不重叠，默认 1。不会跨事务保存 CTID 作为删除依据。重复运行忽略已标记数据，中断保留已提交批次。

备份可能包含已写备份但最终未提交的批次，不能以备份条数推断删除数量。恢复前应按业务主键核对，不能覆盖钱包或统计。

## 验证

- 游戏服务 `go test ./...` 通过，包含本地隔离 PostgreSQL schema 集成测试。
- PostgreSQL 全套竞态回归通过；最终并行清理／精确活跃请求保护新增用例的 `go test -race ... -run TestExperienceLoss` 通过。
- 大厅体验调度相关 `TestExperience` 用例通过。
- 覆盖无奖跳写、普通账号保留、中奖／零派彩免费链保留、提交后 checkpoint 丢失、跨重启重试、大厅扣币响应丢失恢复、旧／新回执清理、预检不写业务数据、重复清理、跨空窗口扫描、并行备份、备份完整可读、备份失败和钱包不变。

## 测试环境执行记录

目标为远程 `/opt/aislots-test` 的游戏数据库。本次仅运行独立维护工具，没有发布或替换游戏／大厅业务二进制。

- 先预检及执行 10 批，实际清理 3,330 局，服务健康。
- 后续按批核对性能、逐步减少重复读取并改为有限并行窗口；切换前中断独立维护容器，未提交批次回滚，已提交批次保留。
- 最终体验 UID 快照、清理截止时间及日志保存在服务器 `/tmp/aislots-experience-*-20261119*`；压缩备份位于 `/opt/aislots-test/backups/experience-loss-replays-20261119/`，权限受限。
- 最终体验 UID 快照包含 **11,345 个账号**，历史复核截止时间为 **2026-11-19 12:21:59（Asia/Singapore，UTC 04:21:59）**。
- 清理完成后，数据库中 `ReplayOmitted=true` 的体验票据准确计数为 **2,411,958 局**，与各批提交日志及首轮 3,330 局的累计数一致。
- 对该快照和截止时间重新扫描完整请求回执，`raw_loss_candidates_before_cutoff=0`，按票据、展示帧、续局及待结算条件再次核对的 `eligible_remaining_before_cutoff=0`。
- 每局删除对应 `spin_steps`、`game_spins` 回放记录，并保留最小幂等回执及投注票据摘要；金币结算、统计和普通／中奖／免费链记录按原规则保留。
- 原始记录的 gzip JSONL 备份位于 `/opt/aislots-test/backups/experience-loss-replays-20261119/`，合计约 **1.2 GiB**；全部 gzip 文件完整性检查通过。
- 最终复核事务成功提交，游戏数据库文件总量约 **29 GB**，服务器根盘剩余约 **8.2 GB**。数据库已发生自动清理，删除释放的页可供后续复用，文件总量不等同于有效业务数据量。
- 游戏、大厅、后台、数值服务及两个数据库健康检查正常。执行与复核日志保留在服务器 `/tmp/aislots-experience-loss-cleanup*-20261119.log`，本地只读复核输出为 `/tmp/aislots-loss-final-verification.log`。

清理完成时，远程旧业务版本仍会保存新增体验无奖回放，此次清理只覆盖明确的历史快照。后续已按用户要求发布 `20261119-storage-67207915db`，新写入规则于 **2026-11-19 14:15:11（Asia/Singapore）** 完成切换与健康检查。发布后抽样 174 局，其中 127 局直接无奖未写结果／帧，47 局中奖回放保留，全部统计已投递；详见 [发布记录](../../deploy/test/DEPLOYMENT.md)。快照截止至发布切换间产生的数据不在上述清理计数内。

DELETE/UPDATE 主要让数据库空间可复用，不能以文件大小未缩小判断清理失败；本次不执行 VACUUM FULL。
