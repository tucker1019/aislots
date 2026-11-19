# 测试环境数据库容量分析

检查时间：2026-11-19 10:26–10:31（Asia/Singapore）。

## 结论

主要原因是：**体验账号累计自动游戏约 342 万局，每局产生多种持久化记录，部分 JSON 重复保存，完成后的历史长期留存，复合文本索引进一步放大容量。**

账号资料本身很小。远程共 11,300 个体验账号、60 个普通账号，用户表连索引只有约 1.24 MiB；不能用“只有一万用户”来推断流水规模。

此前停写并清理的旧 `outbox_events` 目前为 **0 条、32 KiB**，清理仍然有效。现在占空间的是其他游戏及大厅业务表。

本次仅查询远程结构、统计信息、抽样数据并核对代码；没有删除数据、变更配置或发布服务。

## 1. 当前容量

下表使用 GiB（1 GiB = 1,073,741,824 字节），避免 PostgreSQL 显示单位及十进制 GB 混用。

| 数据库 | 数据库总大小 | 用户表数据（含 TOAST） | 用户表索引 | 索引占用户表总空间 |
|---|---:|---:|---:|---:|
| 游戏 `aislots` | 27.85 GiB | 22.48 GiB | 5.37 GiB | 19.29% |
| 大厅 `aislots_lobby` | 6.83 GiB | 2.96 GiB | 3.86 GiB | 56.60% |
| 合计 | **34.68 GiB** | 25.44 GiB | 9.24 GiB | — |

数据库总大小分别为 29,900,986,047 和 7,338,227,391 字节；表与索引合计略低于数据库大小，另有系统对象等开销。各查询时刻略有不同，业务仍在写入。

服务器根文件系统约 59G，已用 47G、可用 11G、使用率 82%。游戏库 WAL 文件约 1 GiB，大厅库约 112 MiB，WAL 不是此次容量的主要来源，也不能手工删除。

## 2. 大表及其结构

### 游戏库

行数为 PostgreSQL `n_live_tup` 估计值，不是全表精确计数。

| 表 | 估计有效行数 | 数据和索引合计 | 核心结构与用途 |
|---|---:|---:|---|
| `spin_request_receipts` | 521.9 万 | **7.94 GiB** | 主键 `(scope, game_id, request_id)`；`data jsonb` 保存请求回执，包括完整 Frame，支持幂等重试及恢复 |
| `spin_steps` | 521.4 万 | **7.79 GiB** | 主键 `(bet_id, spin_index, step_index)`；`response jsonb` 保存逐帧响应，用于播放、恢复、回放 |
| `game_spins` | 343.5 万 | **4.62 GiB** | 主键 `(bet_id, spin_index)`；`data jsonb` 保存运行结果，包括 Frames、Payload、NextState |
| `bet_tickets` | 342.7 万 | **3.40 GiB** | `id` 主键，玩家/状态字段及 `data jsonb`；投注票据与历史入口 |
| `bet_orders` | 335.0 万 | **2.11 GiB** | `bet_id` 主键并引用票据；状态及 `data jsonb` |
| `game_auto_rounds` | 342.4 万 | **1.11 GiB** | 玩家、游戏、请求号组成主键；保存金额、令牌、bet_id、done 等自动局任务状态 |
| `game_statistics_outbox` | 342.7 万 | **0.86 GiB** | 自增主键、唯一 bet_id、玩家局序号、投注/派彩、`delivered_at`；可靠投递整局统计 |

前五张表占游戏库用户表空间 **92.86%**。

关系上，`game_spins.bet_id` 和 `bet_orders.bet_id` 引用 `bet_tickets.id`；`spin_steps.(bet_id, spin_index)` 引用 `game_spins`。因此历史清理需要按关系及业务状态处理。

### 大厅库

| 表 | 估计有效行数 | 数据和索引合计 | 核心结构与用途 |
|---|---:|---:|---|
| `lobby_game_settlements` | 409.5 万 | **2.14 GiB** | request_id、uid、game_id、bet_id、debit、credit、status、coins、account_type；逐轮钱包结算及请求幂等 |
| `lobby_coin_ledger` | 516.3 万 | **1.90 GiB** | uid、order_id、source、delta、余额前后值、account_type；金币账本 |
| `lobby_experience_events` | 514.6 万 | **1.52 GiB** | event_id、uid、事件类型、游戏、金额、时间；体验账号事件留痕 |
| `lobby_game_completions` | 342.8 万 | **1.14 GiB** | game_id、bet_id、uid、sequence、投注/派彩、时间及平台订单号；整局完成事实、统计重建及排行榜回放定位 |
| `lobby_game_streak_days` | 72.0 万 | 0.09 GiB | 游戏、玩家、连续段、日期、胜场；跨日连胜统计 |

两库的记录不能直接互相替代：游戏库保存游戏过程，大厅库保存钱包及统计事实；但可以审查重复内容和留存范围。

## 3. 为什么一局会产生这么多记录

下面是逻辑写入关系，并非所有箭头都表示数据库外键，也不表示一局固定只写一条。

```text
体验账号自动任务
  └─ game_auto_rounds：持久化任务，断线/重启可继续
      └─ bet_tickets：投注票据
          ├─ bet_orders：当前代码另存同一份票据 JSON
          ├─ game_spins：游戏运行结果
          ├─ spin_steps：逐帧显示响应
          ├─ spin_request_receipts：各请求的幂等回执，内含 Frame
          └─ 整局完成 → game_statistics_outbox
                           └─ 大厅 lobby_game_completions
                              └─ RTP、连胜、排行榜等聚合

各轮资金结算 → lobby_game_settlements
              ├─ lobby_coin_ledger
              └─ lobby_experience_events（体验账号分支）
```

消除和免费游戏会让一局产生多个步骤、多个请求回执及相关结算。**342 万付费局不等于 342 万条数据库记录。**

## 4. 主要来源：体验账号持续自动运行

精确聚合查询结果：

- 体验账号 11,300 个，普通账号分类 60 个；普通账号数不代表活跃真人数。
- 体验账号累计付费局数 **3,424,606**。
- 体验账号中 `stopped=false` 的仍有 **137 个**，不代表它们每一刻都正在发请求。
- 当前发布配置 v13 启用了体验池：创建间隔 100–200 秒，游戏间隔 10–30 秒；每完成 80 局，以 15% 概率停止，另有资金等停止条件。不是每个账号打满 80 局必停。

页抽样进一步核对了流水来源：

| 抽样对象 | 体验账号记录 | 普通账号记录 |
|---|---:|---:|
| 大厅结算 | 7,317 | 3 |
| 金币账本 | 9,300 | 6 |
| 整局完成事实 | 6,044 | 0 |

抽样绝大多数来自体验账号，与累计局数相符。这里采用 `TABLESAMPLE SYSTEM` 页抽样，不能把样本比例当成整库精确比例。

## 5. 已证实的重复保存和历史留存

### 5.1 票据 JSON 保存两份

`SaveTicket` 将票据序列化一次，写入 `bet_tickets`；状态为 active/complete 时，再将相同字节写入 `bet_orders`。

抽样配对 **788 条，788 条 JSON 完全相同**。当前代码检索只发现 `bet_orders` 的迁移和写入，没有发现业务读取路径。它是优先审查的冗余候选，目前占 **2.11 GiB**；移除仍需确认外部脚本、旧版本和其他读者，不能据此立即删表。

### 5.2 回执再次保存完整盘面

`spin_request_receipts.data.Frame` 与 `spin_steps.response` 抽样配对 1,000 条，排除 `requestId`、`nextRequestId`、`next` 后，**1,000 条完全一致**。

这证明存在较大内容重复。但回执承担旧请求重试和 `LastSpinReceipt` 恢复功能；不能简单删掉。可以设计为引用不可变盘面，单独保留原始响应的余额、请求号等差异字段。需要保证重试仍返回当时结果，不能用当前余额重建旧回执。

`game_spins` 还保存运行状态和结果计划，与逐帧响应的职责不同；能否进一步裁剪，需要逐游戏验证恢复、免费链和回放用途。

### 5.3 已完成记录仍长期保留

- 自动局抽样 6,237 条全部 `done=true`。
- 统计 Outbox 抽样 6,038 条全部已有 `delivered_at`。
- 样本覆盖 11 月 5 日至 19 日，代码中相应完成/投递路径未发现历史清理机制。

说明不少已完成记录仍保留，但样本不能证明全表都已完成。这两张表合计约 **1.97 GiB**。其中 `game_statistics_outbox` 是当前有效投递链路，必须保留未送记录；它与已清空的旧 `outbox_events` 不同。

完成后清理也必须设计重试期限、重复请求识别、序号检查点或精简墓碑，避免历史重试重新执行或统计重复投递。

## 6. 索引放大了容量

大厅库索引占用户表空间 **56.60%**，比表数据本身还大。游戏库部分索引也接近或超过 1 GiB：

| 索引 | PostgreSQL 显示大小 | 主要原因/作用 |
|---|---:|---|
| `bet_tickets_history` | 1178 MB | 玩家、游戏、国家、币种、时间、ID 等多个字段，部分从 JSON 提取 |
| `spin_receipts_next_token` | 1168 MB | scope、game_id、下一请求号，供恢复查询 |
| `spin_request_receipts_pkey` | 1118 MB | scope、game_id、request_id 的唯一键 |
| `lobby_experience_events_pkey` | 736 MB | 长文本事件号；样本平均事件号约 83 字节 |

回执样本平均 scope 约 103 字节，同一玩家的 scope 会在数百万条记录及索引中重复出现。后续可评估更紧凑的身份键、命令号和类型化查询字段。

部分索引 `idx_scan` 较低或为 0，只能作为审查线索；主键、唯一索引即使少被查询，也承担幂等和约束，不能因扫描少而直接删除。

## 7. 尚不能归因于“数据库垃圾没回收”

游戏库统计约 161 万 dead tuples，大厅约 4,799；自动 VACUUM 有运行记录。`n_dead_tup` 是估计行数，不能直接换算成可回收字节，也不足以证明膨胀是主因。

当前主要证据指向有效历史记录、多份持久化和索引；如果要量化膨胀，还需进一步检查页利用率及索引结构。

普通 `VACUUM` 主要让空间供数据库复用，并不保证数据文件缩小；`VACUUM FULL` 会重写并锁表，需要额外空间。当前剩余约 11G，不能直接对最大的表盲目执行重写。

## 8. 建议处理顺序

1. **控制新增量。** 为测试环境体验池明确并发账号、每日局数、运行时段和停止上限。单纯清理历史无法解决持续增长；本次没有改动体验配置。
2. **优先审查 `bet_orders` 冗余写入。** 验证所有读者后，再制定停写、兼容和历史迁移方案。2.11 GiB 是该表当前物理体量，不是无条件可回收承诺。
3. **精简回执内容。** 共享不可变 Frame，保留请求级响应差异、幂等依据和恢复入口。回执总量 7.94 GiB 包括必要数据与索引，不能全部视为冗余。
4. **制定完成任务及已投递事件的留存政策。** 先明确最迟重试和恢复期限，再归档完成记录；未完成任务、未送事件和序号状态继续保留。
5. **给体验数据独立的留存规则。** 不直接套用真实资金流水的永久留存策略，同时保留所需 RTP、排行榜和回放依据。可以评估时间分区或冷热归档，但分区涉及唯一约束、外键及查询改造。
6. **最后优化索引和实测膨胀。** 先比较实际查询与约束用途，再调整宽索引；监控各表每日增量、体验局数、未完成任务和最老未投递事件。

历史清理必须处理两个现有依赖：`lobby_game_settlements` 的删除触发器会扣减后台累计投注/派彩；统计重建目前依赖留存的 `lobby_game_completions`。直接删除旧流水可能改变累计报表或使历史榜单无法重建，应先设计归档口径及检查点。

## 9. 代码依据和检查方法

- [游戏基础表及外键](../../slots_service/internal/infrastructure/postgres/migrations/001_gameplay.sql)
- [票据双写、游戏结果、帧与请求回执](../../slots_service/internal/infrastructure/postgres/store.go)
- [有效统计 Outbox 投递](../../slots_service/internal/infrastructure/postgres/statistics.go)
- [自动局任务存储](../../slots_service/internal/infrastructure/postgres/auto_round.go)
- [请求恢复与幂等调用](../../slots_service/internal/application/play/spin.go)
- [体验账号调度和停止策略](../../lobby_service/app/apis/lobby/api/internal/server/experience_pool.go)
- [体验事件与普通活动事件分流](../../lobby_service/app/apis/lobby/api/internal/repository/model/activity_model.go)
- [后台累计统计触发器](../../lobby_service/deploy/migration/028_admin_overview_totals.sql)
- [RTP、排行榜及重建依赖](../../lobby_service/docs/game-statistics.md)

远程查询使用只读事务、8–12 秒语句超时；容量来自 `pg_database_size`、`pg_table_size`、`pg_indexes_size` 和 `pg_total_relation_size`，行数估计及维护信息来自 `pg_stat_user_tables`，结构来自系统目录。大表内容采用约 0.2% 页抽样和限量配对，避免对所有 JSON 做全量扫描。

代码核对基于本地提交 `fc42574`；本地落后已获取的 `origin/main`，但本次相关存储、应用流程和体验调度路径与该远端引用无差异。这不能替代核验远程运行二进制的构建来源；远程表结构、容量和已发布配置为本次直接查询结果。

后续的体验账号直接无奖回放优化及历史清理记录见[实施与清理记录](2026-11-19-experience-loss-replay-cleanup.md)。上文容量为最初只读调查时的快照，不代表清理后的文件大小。
