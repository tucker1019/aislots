# Go 按游戏模块整理并接入 AG4 — Implementation Plan

> **For agentic workers:** 使用 superpowers:executing-plans 逐项执行；用户另行要求并行时再考虑子代理。
> **当前状态：Task 1～6 已完成，本地 Go 模块重构和 AG4 接入均已通过验证；未适配 Cocos、未远程部署、未提交/推送。**

**Goal:** 一套 Go 服务容纳多个规则不同的游戏；公共层统一资金与订单，每个游戏独立负责开奖流程，先保住 AG1～AG3，再接入 AG4。

**Architecture:** 提取不依赖 Ways 的公共运行契约，保留已有 Catalog/Factory 和版本路由基础。AG1～AG3 以适配器复用现有 Ways 实现；AG4 独立实现普通/重转流程，通用连线验奖可供后续游戏复用。游戏模块输出可持久化的展示帧及明确派奖计划，公共层负责事务、幂等与推进，不推断特殊玩法。

**Tech Stack:** 现有 Go 1.25、PostgreSQL/pgx、HTTP、JSON 文件及不可变骨架库；不新增服务、不新增数据库、不引入 Redis，不改 Cocos 客户端。

**Spec:** 本会话已确认的分游戏开发方案；数值口径见 `game_configs/AG4/README.md`、`slot_math/README.md`。本文件是换电脑后的接续入口，路径均相对仓库根目录。

## 一、改造前调用链（问题基线，当前实现见第七节）

- `slots_service/internal/bootstrap/factory.go`、`catalog.go`：已有 ruleType → Factory → Spinner 及游戏/引擎版本路由，但目前只注册 Ways。
- `slots_service/internal/application/bet/types.go`：公共 Spinner、订单和状态仍引用 `engine.State/SpinRequest/SpinResult`。
- `slots_service/internal/application/play/types.go`、`service.go`：当前客户端实际使用逐帧 spin，流程依赖 Ways Steps/Free；不是只改整局 bet 接口就能上线。
- `slots_service/internal/application/play/decorations.go`：AG1/2/3 底部展示符号与特殊列判断，目前散落在公共流程。
- `slots_service/internal/engine/{types,spin,fill,board,probability}.go`：现有实现是 Ways 家族，不是所有游戏的通用模型。
- `slots_service/internal/infrastructure/postgres/{store,auto_round,history,share,rank_replay}.go` 及同目录测试：持久化、实际自动/逐轮开奖、回放和分享链路。
- `slots_service/internal/infrastructure/gamedata/{config,library}.go`：现有库格式只支持 `winning-skeleton-v1`。
- `slots_service/docs/client-api.md`：当前客户端协议基准。`docs/architecture.md` 有历史说明，须以源码及实际逐轮协议为准。
- `slot_math/src/domain/{paylines,fortuneTiger,tigerSkeleton,model}.ts`：AG4 验奖、骨架及双表数学参考。

## 二、已经定下来的边界

### 公共平台负责

登录与可信身份、投注档位、余额接口、扣款/派奖/退款、请求幂等、订单锁、游戏版本锁定、存档、请求回执、帧游标和历史/分享凭据。复用现有金额单位与事务规则；不让游戏模块直接访问钱包或发 SQL。

### 通用规则组件负责

Ways、连线等纯验奖算法，以及精确金额/权重抽样等可复用计算。通用连线验奖只计算组合与奖项，不内置 AG4 的 ×10 或重转。

### 每个游戏模块负责

普通/奖励模式选择、使用哪个表、骨架解码与填充、空奖生成、特殊玩法状态机、最终验奖、展示步骤、明确的派奖时机和自己的状态/回放数据格式。

- 不把“每个游戏必须两个表、两个中奖率”写进公共契约；这只是当前 AG4 的方案。
- 不把“重转/免费/×10”写成公共引擎的一串开关。
- 不复制四套钱包、登录和订单服务。
- 不在公共业务中继续添加 `if gameID == AG4`；允许在集中注册表显式注册游戏模块。
- AG1～AG3 共享 Ways 算法，但有各自的模块与展示适配器，不复制整个算法实现。

建议目录（分步落地，先适配，最后再搬旧文件）：

```text
slots_service/internal/
  domain/game/          与具体玩法无关的运行契约、结果及版本封套
  games/
    registry.go         gameID + ruleType 的模块注册/解析
    legacyways/         旧 Ways → 新公共契约的兼容适配
    ag1/                AG1 模块与旧协议/展示适配
    ag2/                AG2 模块与旧协议/展示适配
    ag3/                AG3 模块与旧协议/展示适配
    ag4/                AG4 开奖、补盘、空奖、重转、×10、帧适配
  rules/paylines/       纯连线验奖
  engine/               第一阶段保留现有 Ways 实现；稳定后再迁目录
  application/play/     公共请求推进、幂等与帧结算
  infrastructure/      公共存储/平台接口，库格式解码交给对应规则
```

## 三、AG4 已确认的规则与数据

### 数值

- `config.json.ruleType = paylines_v1`；当前 AG4 的流程由 AG4 模块选择，不把所有连线游戏绑定为重转游戏。
- 普通表 `base.json`，重转表 `free.json`；文件倍率是每线原始倍率，除以 5 得到总投注倍率。
- 普通中奖率、重转中奖率和重转触发概率都从 config.json 读取，禁止 Go 硬编码。
- 先决定普通/重转，再决定该模式中奖/未中奖；中奖按对应正倍率权重抽取。重转替代普通结果。
- 总 RTP = (1−触发率)×普通中奖率×普通表均值/线数 + 触发率×重转中奖率×重转表均值/线数。
- 当前快照：普通中奖率27%、重转中奖率95%、重转触发率1.9%、总 RTP 约96.574522171%。**这是接续快照，执行时读最新文件，不覆盖用户后续调整。**
- 普通135档，420/430已移除；重转26档均可达。两表调整已保持原加权均值，不再因接 Go 改 RTP。

### 骨架与空奖

- 格式 `payline-skeleton-v1`；位置为按列、从上到下的 **0基位置**。配置中奖组合为 **1基格子 ID**，客户端符号 ID 为1～7，三者不得混用。
- 普通骨架 `{target:null, stages:[[位置,符号,...]]}`，只固定中奖元素，其他位置由 Go 填充。
- 补普通骨架后必须重新验奖，最终倍率必须等于抽中倍率；不能意外新增奖线、全屏 ×10 或更改固定元素。
- 重转骨架保存普通目标符号和每步新增位置；已有元素锁定，非目标位置允许真实空白，不把空位补满。
- 重转从空盘开始，有新增继续，无新增或填满结束；无新增结束阶段保留。只对最终盘面派彩一次。
- 九格同符号时 ×10 是 AG4 的验奖结果，已含在骨架最终倍率，禁止抽表后再乘一次。
- **0 倍率实时生成，不能读0桶。** 用户最后决定旧库0桶先保留；不要擅自清理它们。加载时忽略0桶作为开奖来源，不让0进入正倍率抽样。
- 普通空奖实时生成完整不中奖盘面；重转空奖实时生成合法锁定/结束序列，最终确实零奖，不能误中奖。重转0奖不等于永远返回空盘。
- 填充/构造次数有限、可测试。正奖失败不能降到邻近倍率或偷偷改成空奖；先按既定失败/退款规则处理。若配置根本不允许空奖且中奖率<100%，启动时拒绝配置。

### 可用候选数据（启动前重新校验）

- 配置：`game_configs/AG4/{config,base,free,paylines}.json`。
- 普通完整库：`game_libraries/AG4/base/2026-11-13T10-26-51-634Z-2195d532/`，正倍率135/135；7049条含1条旧0骨架。`supplement.json`记录定向新增1512条。
- 重转库：`game_libraries/AG4/free/2026-11-13T10-00-15-938Z-1a05b394/`，对当前表正倍率26/26；2700条包含旧0桶。
- 重转旧 manifest 保存的是调整前表/全局版本，**不能直接当作当前发布包**。必须用最新表重验骨架并生成新的不可变发布目录/manifest，不修改旧 manifest 的版本号冒充校验。
- 以上都是候选，不代表服务端已启用。当前 Go 还不支持 AG4。

## 四、执行任务与验收门槛

每一任务：先写能暴露对应问题的测试，确认失败，再实现，最后运行相关测试；任务完成后更新本文件复选框及接续记录。未经后续授权不提交、不推送、不发布远程。

### Task 1：建立基线与迁移样本

Files: 现有 AG1/2/3 的 bootstrap、engine、play、postgres 测试；新增 `slots_service/internal/games/legacyways/compatibility_test.go`。

- [x] 记录工作区已有修改；不要回滚 slot_math、AG4 数据及后台运营统计的未提交改动。
- [x] 在 slots_service 运行 `go test ./...`、`go test -race ./...`、`go vet ./...`，如有历史失败记录具体名称。
- [x] 使用固定随机源保存普通、连续消除、免费/追加、金底、底部格子等代表性结果；准备旧数据库 JSON/回放样本。不要读取或修改真实用户资金。
- [x] 明确实际使用的逐帧服务、自动整局入口、平台结算路径，避免只迁移某一个入口。

验收：已有行为有可重复对比样本，旧版本回放/恢复有测试依据。

### Task 2：公共契约与 Ways 兼容适配

Create: `internal/domain/game/{runtime,state,result}.go`、`internal/games/registry.go`、`internal/games/legacyways/{runtime,codec}.go`。
Modify: `application/bet/types.go`、bootstrap `factory.go/catalog.go`；对应 mock/内存实现。

接口约束：`Runtime` 提供 `Type()/Version()`、`Draw(ctx, Request) (Result,error)` 和 `ValidateStoredResult(Result) error`。Request含可信投注最小单位及状态封套；Result含总扣款/派彩、下一状态、明确的帧结算计划。

状态封套包含规则类型、引擎版本、状态 schemaVersion 和游戏专属 payload；公共层不理解 FreeSession。Frame包含金额/边界等公共字段及由模块校验的专属 payload。不要把任意 map[string]any 当成无校验状态。

- [x] 契约不暴露 Ways 的 FreeSession、Removed、CascadeFactors 等强制字段。
- [x] 旧 Ways 适配器保持数据、随机顺序和派奖金额不变；不在这一阶段搬完 engine 所有文件。
- [x] 旧 JSON 无封套时由明确的旧版本 codec读取；未完成旧订单按原版本恢复，不用当前版本重算。
- [x] 未知模块/规则/版本拒绝加载，不能静默回退 Ways。

验收：AG1～AG3兼容样本一致；变更无须重写钱包与订单状态机。

### Task 3：将逐帧与展示分支移到游戏模块

Create: `games/ag1/`、`games/ag2/`、`games/ag3/` 的模块注册与 frame presenter。
Modify: `application/play/{types,service,decorations}.go`、`infrastructure/postgres/{store,auto_round,history,share,rank_replay}.go` 及必要 HTTP codec。

- [x] 由模块提供帧计划和客户端展示适配；公共 play 不再自行解释 Steps/Free 决定奖励流程。
- [x] AG1～AG3现有逐帧派彩保持原样；不为了 AG4 改成所有游戏统一最终派彩。
- [x] AG1/2/3顶部/底部格子、AG2免费金底等展示归相应模块；保持实玩/state/回放一致。
- [x] 钱包操作、帧游标、回执、累计派彩和状态提交仍原子执行。请求重试、重连不再次扣款或派彩。
- [x] 旧 HTTP字段保持兼容；新游戏专属字段在模块 DTO 内定义，不给所有游戏增加强制重转字段。

验收：三款游戏普通/免费流程、自动旋转、重连、历史、公开回放及分享全部回归通过。

**里程碑 A：完成 Task 1～3，先停在可回归状态，再接 AG4。**

### Task 4：AG4 规则与库加载

Create: `internal/rules/paylines/{config,evaluate}.go`、`games/ag4/{config,library,rules}.go` 及测试。

- [x] 从当前 TS 导出固定验奖/骨架样例，与 Go 同样例比较：混合Wild、全Wild、单线、多线、全屏同符号、混合三横行不乘10。
- [x] 读取普通/重转表及其独立中奖率，不调用 Ways 免费局数/追加模型。
- [x] 支持 payline-skeleton-v1，并严格校验位置、符号、目标符号、锁定、结束条件与桶倍率。
- [x] 忽略历史0桶；检查所有正权重倍率都有合法骨架；缺失、错桶、损坏哈希或配置不匹配拒绝作为 current。
- [x] 按数值工具同样口径校验文件倍率/5与金额单位，使用整数/精确有理数计算，最终取整一次。

验收：普通135/135、重转26/26通过 Go 的独立校验，不只相信 manifest 的覆盖字段。

### Task 5：AG4 补盘、实时空奖及重转状态机

Create: `games/ag4/{draw,fill,zero,respin,frames,state}.go` 及同名测试。

- [x] `Draw`按触发率选模式，按本模式中奖率决定0/正奖；正奖抽表再取同倍率骨架。
- [x] 普通填充不得改动固定元素；补完重新验奖，精确匹配原倍率。
- [x] 普通0和重转0均实时生成、验奖为0；测试库访问器确保0路径没有读取骨架库。
- [x] 重转锁定不可变，每步新增合法；无新增/填满结束，不出现无限循环。
- [x] AG4一次付费只扣一次，中间重转帧派彩为0，最终派彩一次；所有帧派彩和等于总派彩。
- [x] 固定随机源验证边界：触发率0/1、中奖率0/1、空位概率边界、最大倍率、余额不足、填充超限。

验收：抽取倍率与实际盘面倍率逐局一致；频率抽样只做统计验证，不用随机生成频率改写 RTP。

### Task 6：AG4 接入逐帧、恢复、回放与测试发布包

Modify: `bootstrap/factory.go` 和模块注册表；`configs/{server.test,server.lobby,bets.test}.json` 的本地测试项；新增 `postgres/ag4_test.go`、HTTP AG4测试；更新 `docs/client-api.md`、`docs/architecture.md`。

- [x] 以新不可变测试发布目录打包当前配置和两套已验证骨架，写规则/模块/状态版本及哈希；旧版本保留。
- [x] 注册 AG4，投注方案单独配置，线数5；不复用 AG1～AG3的20线或免费参数。
- [x] 验证 Start/spin、state、重复请求、刷新恢复、中途退出后继续、自动模式、历史回放、排行榜回放及分享凭据。
- [x] 重启后从已保存的结果/帧计划继续，不重新随机补盘；新旧配置同时存在时按订单锁定版本恢复。
- [x] 完整跑 `make check`、`make build`；在明确的本地测试库设置 `AISLOTS_TEST_DATABASE_URL` 后跑 `make integration`，确认实际执行而非跳过。
- [x] 输出本地联调入口和 AG4协议样例；Cocos客户端改造、远程部署留待单独指令。

**里程碑 B：Go本地AG4可运行、可恢复、可回放；不自动发布远程。**

## 五、重点检查

1. 历史订单/回放恢复：新契约不能破坏已存 Ways JSON；unknown schema不能瞎解析。
2. 中途失败：扣款、派奖与请求回执不重复；旧局不能用新库重新开奖。
3. 特殊玩法差异：AG4最终一次派奖；AG1～AG3保留既有逐帧行为。
4. 稀有倍率与空奖：正奖不降档；0实时构造、不查库；填充和无新增终止都有限界。
5. 配置同时编辑：发布快照一致、哈希/覆盖独立验证，不能使用当前可变工作目录恢复历史局。

## 六、换电脑接续

1. 同步本次服务端、文档和测试快照。当前改造尚未提交/推送；工作区其他大厅修改须保留。
2. 使用 Go 1.25 和明确的本地测试 PostgreSQL，不依赖本机临时文件和进程。
3. Task 1～6 已完成，不要重复实现。AG4 Cocos 和远程发布留待后续任务；提交/推送遵循后续明确指令。
4. 在 slots_service 设置本地 `AISLOTS_DATABASE_URL` 后运行 `go run ./cmd/slots-server -config configs/server.test.json`。协议样例见 `slots_service/docs/client-api.md`。
5. 检查命令：`make check`、`make build`；设置仅指向本地测试库的 `AISLOTS_TEST_DATABASE_URL` 后执行 `make integration`。测试创建/删除隔离 schema，不接触真实钱包。

## 七、2026-11-13 完成记录

里程碑 A、B 均已完成。公共运行接口与显式帧计划落地，AG1～3 共用原 Ways 引擎，AG4 独立实现连线/锁定重转。公共 play 不再解释 FreeSession/Steps 或判断游戏 ID。原 engine 目录暂保留。

### 主要文件

- `internal/domain/game/runtime.go`：中立 Runtime、State、Result、帧计划及资金边界校验。
- `internal/games/registry.go`、`bootstrap/factory.go`：显式注册游戏、规则及存档格式。未知 schema/规则拒绝，其他连线游戏不自动继承 AG4。
- `internal/games/legacyways/`、`games/ag1|ag2|ag3/runtime.go`：原算法适配、累计取整、各游戏展示。底部数据按旋转生成、逐帧保存并透传 state/回放。
- application/bet、application/play、memory/postgres：使用公共封套，保留旧 Ways HTTP DTO、StepAmounts 和新旧历史格式。JSONB 格式差异通过类型比较兼容，整数不经过 float64。
- `engine/stored_result.go`：锁定版本验证历史盘面及奖金，不重新开奖。已完成 Ways 状态可迁移至新付费版本，进行中的局锁定原版本。
- `internal/rules/paylines/`：纯连线验奖、Wild 每组合最高奖及精确有理数计算，不含 AG4 特殊机制。
- `internal/games/ag4/`：配置、精确抽样、骨架校验、一次受约束补盘、实时零奖、锁定重转、最终一次派奖、展示和存档验证。
- `cmd/ag4-publish/`：校验后输出不可变发布。`testdata/deployments/2026-11-13-ag4-modules/AG4` 含四份配置、两份库及清单；独立覆盖135/135、26/26。文件保留旧零桶，运行时不读库生成零奖。
- `configs/server.test.json`、`server.lobby.json`、`bets.test.json`：本地 AG4 快照及五线方案。HTTP Frame 可选 gameData，历史/排行榜/分享保留已结算展示。

### 验证结果

- AG1～3 各1500局固定种子42，对比原引擎的盘面、奖金、免费状态、金底及随机消耗，共4500局；旧 JSON 帧计划一致。
- `tools/export_ag4_parity.mjs` 从实际 TypeScript 导出 `testdata/ag4-parity.json`，Go 对照普通/Wild/全屏及有效、无效骨架。
- AG4 全部正权重倍率、普通/重转实时零奖、概率0/1、锁定、哈希、不可变快照、一次补全、概率边界和金额溢出有测试覆盖。
- 实际 PostgreSQL 集成测试覆盖余额不足不开奖、扣款一次、中途重启、重复回执、版本锁定、最终派奖、自动轮、历史金额、排行榜所有权及公开分享。实际 HTTP 使用 bet/betLevel。
- `make check`（全量测试、竞态检测、vet）、`make build`、明确设置本地库后的 `make integration` 均通过，数据库测试实际执行而非跳过。

本轮未改动原数值配置和候选库，未改 Cocos、未远程部署、未提交/推送。AG4 Cocos 展示及发布留待后续任务。

## 八、2026-11-13 一次生成调整

用户确认普通空奖、重转空奖和普通中奖均不得依赖整盘重试：

- 普通空奖先填前两列并避免同线双Wild，第三列排除会成线的图标；不再执行生成后的向上复制。
- 普通中奖固定骨架不动，空位仅补普通图标，逐格排除额外中奖。加载库拒绝未完成线的双Wild，配置要求正权重普通图标数大于单格最大线数，保证候选非空。
- 重转空奖仅在填入不会中奖的位置按概率填入；有新增继续，无新增结束，最多六轮新增加一轮结束。概率为1也必然可结束。
- 重转中奖维持按骨架恢复原步骤；最终一次派奖规则不变。
- AG4 不再使用 MaxFillAttempts；运行指纹加入 single-pass-v1。原数值和库文件不修改，未发布新远程版本。

专项测试逐条验证7048条普通正奖骨架，固定元素、中奖明细、倍率不变；固定零字节随机源下每个空位只抽一次。覆盖普通空奖前缀/Wild排除、重转填入概率0/0.2/1、不读零桶、锁定和终止，以及随机源错误透传。本轮 `make check`（全量普通/竞态测试与 vet）、`make build` 均通过；设置明确的本地测试数据库后 `make integration` 实际执行并通过（105.971s），未跳过数据库检查。
