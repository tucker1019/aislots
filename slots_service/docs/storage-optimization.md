# 游戏持久化去重与历史维护

## 存储变化

- 投注权威记录仍是 `bet_tickets`，停止向 `bet_orders` 双写同一份 JSON。旧的待结算 journal 恢复时也会跳过订单写入。
- 新请求回执使用 `StorageVersion=1`，`Frame` 仅保留帧定位 `(betId, spinIndex, stepIndex)`、原始 requestId/nextRequestId、next 和当时余额；Amount、BuyMode 继续保留。盘面、bottomSymbols、gameData、中奖及免费局等内容从原有 `spin_steps.response` 读取。
- `SpinReceipt`、`LastSpinReceipt`、`SettledReceipt` 共用读取逻辑，兼容无版本号的旧完整回执。引用的帧丢失或不匹配时返回错误，不重新抽取盘面，也不使用当前余额代替历史余额。
- 大厅结算返回实际余额后，同时更新帧和回执；修改回执时保留存储版本及其他 JSON 字段，兼容旧持久化结算意图。
- 现有主键及下一请求号索引保持原路径，不在服务启动时重写历史表或重建大索引。既有迁移文件不修改。

对于保留回放的局，逐帧记录仍需保存，回放、恢复与 v1 回执共同依赖它。体验账号直接无奖局的例外见下文；裁剪时必须同时转为独立最小回执，不能留下引用已删除帧的 v1 回执。

## 发布顺序

1. 在独立环境完成真实 PostgreSQL 回归，保留可恢复的数据库备份或快照。
2. 使用维护窗口，停止所有旧版本游戏 API 和自动局写入进程，再统一启动支持新格式的版本。**不允许旧读者与新写者混跑**：旧版本不能还原精简回执。旧待结算 journal 可由新版本恢复。
3. 检查新请求、旧请求重试、断线恢复、免费链及回放，确认没有仍在写入 `bet_orders` 的旧进程或外部程序。
4. 显式运行下述维护工具。它不会随正常服务启动执行，也不会触碰大厅账本或统计表。

开始写入精简回执后，不能直接回退到只支持完整回执的旧二进制。回退需使用同样支持 v1 的版本，或者先另行完成回执展开迁移。

## 工具

工作目录 `slots_service`，通过 `AISLOTS_DATABASE_URL` 指定目标游戏库，勿把连接串打印到日志。工具不自动调用 Migrate。

```sh
go build -o /tmp/aislots-storage-maintenance ./cmd/storage-maintenance

# 默认只读，检查一批 1000 条旧回执。
/tmp/aislots-storage-maintenance -action compact-receipts

# 只读检查全部旧回执；逐批输出可精简和跳过的数量。
/tmp/aislots-storage-maintenance -action compact-receipts -max-batches 0

# 显式应用一批，核对业务后再扩大范围。
/tmp/aislots-storage-maintenance -action compact-receipts -apply

# 显式分批处理全部旧回执，每批独立提交。
/tmp/aislots-storage-maintenance -action compact-receipts -apply -batch-size 1000 -max-batches 0

# 验证订单全部已有相同的票据记录，只读。
/tmp/aislots-storage-maintenance -action remove-orders

# 维护窗口内，验证后删除冗余订单表，使用 DROP RESTRICT。
/tmp/aislots-storage-maintenance -action remove-orders -apply
```

### 回执压缩规则

- 使用原主键进行 keyset 分页，范围 1–10000 条/批；单语句超时 30 秒、锁等待上限 3 秒。
- 仅处理无存储版本或版本为 0 的完整回执；已为 v1 或 ReplayOmitted=true 的记录不会再次处理，也不计作异常 skipped。
- 比较旧回执 Frame 与对应 `spin_steps.response`。仅排除会单独保存的 `requestId`、`nextRequestId`、`next`、`balance`；其他 JSON 内容必须完全相同。源帧缺失或有未知差异的记录保留原样并计入 skipped。
- 保留原回执顶层其他字段；更新时再次核对完整原 JSON，若被其他进程修改，整批回滚报错。
- 中断后已提交批次保留，当前批次回滚；可以重新运行，继续处理剩余旧格式记录。重跑从主键起点扫描；未保存跨进程游标，已压缩区域仍有扫描成本。
- 输出的 `logical_json_before/after` 是可压缩记录的 JSON 序列化字节数，**不是物理磁盘回收量**。dry-run 的 compacted 为 0；eligible 表示能转换的数量。
- max-batches 是本次最多处理批数；设为 0 才会一直扫描到结尾。skipped 非零需单独排查，工具不强制丢弃不同内容。

### 订单表移除规则

- 只读及执行模式都会核对每条订单的 bet_id、status、data 是否与票据相同；仅允许票据额外具有内部 `ReplayOmitted=true` 标记这一种历史清理差异。其他任何缺失或差异都会中止。
- 执行模式会对订单表持有排他锁，设置锁等待上限 3 秒、单语句超时 60 秒。核对大表可能耗时，应放在维护窗口。
- 使用 `DROP TABLE bet_orders RESTRICT`，存在未知数据库依赖时会失败，不连带删除其他对象。表已不存在时可安全重复执行。
- 操作者仍需确认旧进程、外部查询和脚本已停止依赖该表；数据库自身无法识别外部代码依赖。
- 旧迁移仍包含建表定义。已迁移数据库通过迁移版本跳过该文件，不会在下次启动重建；新数据库会有一张不再写入的空表，可由同一工具移除。

## 空间回收

删除订单表在事务提交后可释放其文件。回执批量 UPDATE 会产生 WAL 和旧行版本；新数据更小，不代表文件立即缩小，执行期间还可能临时增加占用。

先监控磁盘余量与写入增量，并让 autovacuum 回收旧版本供后续写入复用。如果要把回执旧空间归还文件系统，需另行安排经过容量测算的重写维护；普通 VACUUM 不保证文件缩小。不要在剩余空间不足时直接执行 VACUUM FULL。

上述去重优化不删除已完成自动局、有效统计 Outbox、大厅结算或金币账本。游戏结果和逐帧记录的唯一裁剪例外见下方「体验账号直接无奖局」。

## 本地验证（2026-11-19）

- `go test ./...` 通过，包含维护工具编译。
- 配置本机 `AISLOTS_TEST_DATABASE_URL` 后，`go test -race -count=1 ./internal/infrastructure/postgres` 通过；每个数据库用例使用独立 schema，结束时清理。
- 覆盖并发重复请求、旧/新回执混合读取、重启恢复、免费链、底部格子和回放一致性、大厅实际余额覆盖、旧待结算意图恢复、压缩只读预检/分批执行/差异跳过，以及订单核对失败时不删除。
- AG3 真实盘面库回归改为读取当前配置的有效总投注，移除已不在投注列表内的固定值 200；未改变业务投注配置。

## 体验账号直接无奖局（2026-11-19）

本阶段只优化体验账号的直接无奖基础局。大厅体验调度在经过鉴权的 `/internal/auto-round` 请求中设置 `skipZeroWinReplay=true`；普通玩家 HTTP 接口不能指定该策略。游戏层不读取大厅账号库或排行榜。

开奖仍使用原引擎及原来的中奖率、倍率抽样、盘面生成、校验与逐步结算。只在首次付费步骤确认「总派彩为 0、单帧直接 complete、无待执行状态、无免费奖励」后，跳过 `game_spins` 和 `spin_steps` 写入。不是落库再删，也不先把整条免费链改成一次执行。中奖、免费、重转及多步骤局全部保留原存储路径；未带可信策略的账号也保持原路径。本阶段不增加排行榜前 100 或 50 倍条件。

仍保存票据摘要、必要运行状态、请求幂等回执、下一请求号、自动任务进度及结算/统计记录。无奖回执使用兼容旧读者的最小信封，包含 `ReplayOmitted=true`、投注金额、原始余额和请求标识，不含 board、bottomSymbols、gameData 或开奖结果。`state` 不把它伪装成展示帧；回放查询明确返回不存在，下注统计仍按一局计算。

### 历史无奖回放清理

先从大厅按 `account_type='experience'` 导出 UID 快照，每行一个 UID。工具仅连接游戏库，必须指定平台 appname/appkey，不根据昵称或 UID 范围猜测账号类型。

```sh
# 默认预检；不会修改业务数据。
/tmp/aislots-storage-maintenance -action clear-experience-losses \
  -experience-uids /secure/experience-uids -appname aislots-lobby -appkey web \
  -batch-size 1000 -max-batches 0

# 执行时必须有备份目录；每批先同步写入独立 gzip JSONL 备份再提交。
/tmp/aislots-storage-maintenance -action clear-experience-losses \
  -experience-uids /secure/experience-uids -appname aislots-lobby -appkey web \
  -backup-dir /secure/loss-backups -apply -batch-size 1000 -max-batches 0
```

- 以运行开始时间与当时的回执表页数作为历史上界，沿物理页顺序读取并在每批内锁定记录，后续全部使用业务主键核对与修改；正在运行的体验任务可能继续产生新记录，不承诺此次清理覆盖未来新增量。
- 核对票据与权威完整回执（v1 引用回执读取源帧）：整局已 complete、TotalWin=0、spinIndex=0/stepIndex=1、仅一个基础局步骤、没有免费或后续步骤。跳过未完成自动任务对应的确切 betId，或尚未保存 betId 时对应的原请求 token，另跳过待确认结算和被其他事务锁定的记录；同一账号正在玩新局不阻止清理已结束的旧局。
- 先将回执改成最小兼容信封，再删逐帧和原始结果，最后标记票据。兼容旧完整回执及 v1 引用回执；无奖回执保留原余额、请求号与下一请求号，重试不会重新开奖或扣币。
- 逐批备份保存原 ticket/receipt/frames/spins 完整行；备份使用快速 gzip，优先降低持锁时间，备份失败则该批回滚。备份目录权限应限制为操作者可读，不放在静态资源目录；备份保留期间也会占用磁盘。中断可能留下已备份但未提交的批次，恢复时需按主键核对，不以文件条数推断已删除局数。
- 清理不删除钱包、账变、投注摘要、自动任务、统计队列或大厅记录。已清理记录不会重复处理；跳锁的局可在下一次执行时处理。
- `batch-size` 在此操作中是近似行数目标，每批扫描 max(1,batch-size/4) 个数据库页；`-workers` 可指定 1–4 个独立连接，默认 1，各自处理不重叠页窗口，max-batches 是每个连接的批数上限，实际行数由行大小决定。物理位置不跨事务保存或用于删除，普通 VACUUM 不移动存活行；被并发更新移动或跳锁的旧记录可再次运行核对。
- `Candidates` 为本批通过初筛的体验账号回执，`Eligible` 为满足条件的局；执行模式下 receipts/frames/spins/tickets 为实际修改行数。
- 大量 DELETE/UPDATE 后普通 VACUUM 主要让空间可复用，不等于数据库文件立即缩小。另行测算空间与维护窗口后才能考虑重写压缩。

新增隔离数据库用例覆盖：普通账号无奖保留、体验账号无奖跳写、中奖与零派彩免费链保留、自动任务提交后检查点丢失、服务重启后重试、大厅已扣币但响应丢失恢复、旧/新回执历史清理、只读预检、重复执行、活跃任务保护及钱包不变。
