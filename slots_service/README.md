# slots_service

游戏机台服务，已接入 PostgreSQL、客户端逐轮开奖、大厅票据身份及统一钱包。保留独立测试钱包模式；大厅接入使用 `configs/server.lobby.json`，测试模式使用 `configs/server.test.json`。Go 1.25+，数据库驱动使用 pgx。

本轮联调的启动方式、接口与测试数据限制见 [客户端联调协议](docs/client-api.md)。

一次 `Engine.Spin` 对应一次旋转及其完整消除链；免费游戏通过后续调用继续，每次消耗一次免费次数。

## 工程结构与开发入口

采用模块化单体，服务入口在 `cmd/slots-server`。目录职责、未来 bet 接口和事务设计见 [架构说明](docs/architecture.md)。

```text
cmd/slots-server/                  启动进程、信号与优雅退出
configs/                          服务部署配置，独立于游戏数值配置
internal/
  domain/identity/                平台、应用、用户身份
  platform/                       向平台验证、减币、加币、查单的接口
  application/play/               当前客户端逐轮流程与测试结算
  application/login/              平台用户验证
  application/betlist/            游戏/国家/币种投注方案
  application/bet/                下注订单、平台结算及恢复
  engine/                         纯开奖计算、概率、补空、消除验证
  infrastructure/
    gamedata/                     游戏 JSON 和磁盘盘面库适配
    postgres/                     PostgreSQL 会话、订单、逐轮进度和测试流水
    memory/                       旧平台结算用例的测试适配器
    platform/                     平台适配器注册表
  transport/httpapi/              HTTP 路由和协议转换
  bootstrap/                      配置解析、依赖装配、游戏玩法工厂及版本目录
scripts/                          生成 TS/Go 对照样本的开发脚本
```

```sh
cd slots_service
make check
make build
make run
```

基础示例配置（server.example.json）的 `games` 为空，服务可以启动：`GET /healthz` 返回 200，`GET /readyz` 返回 503，表示尚未加载游戏。该基础配置没有启用业务路由；完整联调使用 server.test.json。

复制 `configs/server.example.json` 为 `configs/server.local.json`，填入配套游戏和盘面库后：

```sh
make run CONFIG=configs/server.local.json
```

`games` 中每一项示例（替换真实批次名）：

```json
{
  "configDir": "../../game_configs/AG1",
  "baseLibraryDir": "../../game_libraries/AG1/base/<batch>",
  "freeLibraryDir": "../../game_libraries/AG1/free/<batch>",
  "triggerSymbolCount": 3,
  "maxFillAttempts": 64,
  "current": true
}
```

`ruleType` 是必填的玩法规则实现标识，当前只注册 `ways_cascade_v1`（Ways 中奖 + 连续消除）。它选择对应的配置加载、结果生成/重放及验证实现，不由客户端提交。未来 `paylines_v1` 等类型需要注册自己的 Factory，尚未实现时启动会报错，绝不回退到现有消除引擎。该字段保存在 `game_configs/<gameId>/config.json` 顶层，由数值工具编辑和保存。服务端先读取它再选择 Factory，部署配置不再重复填写。历史盘面库格式保持不变。

路径相对于服务配置文件所在目录解析。一个游戏可加载多个版本，恰好一个标记为 `current`；逐轮开奖流程中新付费凭据使用当前版本，已申请凭据、正在进行的投注及免费链仍按原版本执行。发布新版本时须保留这些旧版本；在下一笔付费投注开始时切换版本，余额和累计状态保留。

## 当前调用流程

客户端登录（大厅票据或独立测试身份） → 获取投注列表与state中的服务端请求标识 → spin结算并返回当前轮及下次请求标识 → 后续消除、免费仍调用spin → complete。无需申请下注或提交消除游标；重连先静态恢复 state.lastFrame 中最后已结算的盘面、余额和累计赢分，再播放消除并请求下一未结算轮，原请求重试幂等返回原回执。

实际 HTTP 入口调用 `application/play.Service`，PostgreSQL 负责保存会话、凭据、完整旋转和当前已交付帧。返回帧不含完整未来链。固定测试用户仅第一次初始化 500000 分；登录、刷新、服务或数据库重启不重置余额。

`application/bet.Service` 是先前的一次性整局平台结算用例，当前客户端接口不使用它。`platform.Client`、login 验证用例和适配注册表保留为真实平台接入边界；大厅逐轮结算已通过持久化待结算计划接入当前帧状态机；网络调用在本地规划事务回滚并保存计划后执行，确认后提交原盘面。

业务接口支持独立测试配置或大厅接入配置；测试模式需 `testProfile.enabled=true`，大厅模式需共享服务密钥及大厅地址，两种身份模式不能混用。两者都需独立数据库及投注方案。详见 [联调协议](docs/client-api.md)。

AG1 uses `"freeAwardSymbolCounts": {"8": 3, "10": 4, "12": 5}` in its server game entry. The existing award weights choose free spins first; the selected award then determines the scatter count for both base triggers and free retriggers. Every positive-weight award must have a mapping to 3, 4 or 5 symbols. Legacy entries without this mapping retain their explicit `triggerSymbolCount`.

## 开奖顺序

1. 读取调用方传入的连续输赢、未触发免费局数、免费剩余次数等状态。
2. 按配置计算中奖概率、连续未中奖 RTP 补偿和免费触发概率。
3. 命中中奖概率后，按普通/免费倍率表权重抽取原始倍率；独立抽取免费触发。免费内部使用锁定概率、再触发上限与保底规则。
4. 正倍率从对应桶均匀读取一条紧凑骨架；空奖使用空骨架，不读取盘面库。
5. 重放骨架，按配置补空，执行金底转百搭和掉落。普通图标累计加权；免费图标每列恢复基础权重再加 n，每轮每列最多新增一个，未触发时整局最多两个。
6. 补空逐格检查该格在后续盘面的影响，保持各轮中奖图标、Ways、消除集合和总倍率一致。最多尝试 64 次，可设置 `MaxFillAttempts`；失败返回错误。
7. 重算奖金，返回完整初始盘面、各轮消除与补充、最终盘面、免费奖励以及新状态。

图标位置采用按列从左到右、列内从上到下的 0 起始编号；稳定的 `Cell.ID` 用于跟踪掉落。`Round.RawMultiplier` 为除以线数前的原始倍率。

金额使用整数最小货币单位，内部采用有理数精确计算：`总投注 × 原始倍率 / lineCount`。整条消除链合计后向下取整一次，返回 `WinMinorUnits`，同时用 `ExactWinMinorUnits` 保留精确值（不可有限小数时为分数字符串）。取整策略目前固定，后续若改结算规则应同步调整。

## 配置、数据与状态

- 从现有 `config.json`、`board.json`、`base.json`、`free.json` 读取数据，不修改文件，也不补内置玩法默认值。
- 加载时检查所有正权重正倍率均有对应骨架，普通/免费库都检查。规则不匹配、数据校验失败、缺少倍率或补空失败均报错；不会换倍率、改成空奖或修改入参状态。
- 磁盘盘面库启动时流式扫描，保留每条记录的偏移索引；每次开奖只用 `ReadAt` 读取一条骨架。索引占用仍随记录数增长，并非零内存；进程内多个请求共用一个 Engine/库实例。
- 库目录须在服务运行期间保持不可变。校验 manifest 的游戏、模式、格式、配置结构和文件 SHA-256；抽中的记录仍重放校验。
- Engine 配置快照的哈希写入返回状态。配置变化时旧状态会报版本不匹配；调用方应保留旧 Engine 让进行中的免费局完成，或另行定义迁移策略。
- `State` 是服务端可信状态，不能直接相信客户端回传。下注业务层通过 `bet.Store` 按完整平台身份串行处理订单。各步骤分别保存，最终订单和游戏状态原子提交；平台资金调用不能由本地事务回滚。内存适配器仅用于测试。`Sequence` 本身不是重复请求保护。
- 同一 Engine 可供多个玩家并发调用；生产随机数来自 `crypto/rand`。`engine.Options.Random` 仅用于测试/重放，注入时须保证并发安全。
- 现有 AG1 的历史库不保证覆盖当前倍率表或匹配当前盘面规则，须选择/生成配套批次后加载。

## 验证

```sh
cd slots_service
go test ./...
go test -race ./...
go vet ./...
```

覆盖普通中奖/空奖、免费触发/保底/再触发/退出、免费图标数量、零权重、金额取整、损坏骨架、缺失倍率、配置版本、取消和并发。`internal/engine/testdata/` 中的金底及概率预期值由现有 TypeScript 数值工具生成，检查两端一致性，包括中间 `0` 阶段、普通/免费消除加成、连续未中奖补偿和免费触发 RTP 补偿。

另覆盖平台/应用隔离、并发重复请求、减币/加币/退款超时查单恢复、加币成功后本地提交失败、登录验证和投注列表选择。

真实数据库集成测试通过 `make integration` 运行，需要 AISLOTS_TEST_DATABASE_URL。测试为每个用例创建并清理独立 schema，不修改联调用户的余额。覆盖并发重复请求、跳步拒绝、无未来结果泄漏、持久化恢复、免费链路、累计取整以及跨身份隔离。

更新对照样本（需要已安装 `slot_math` 依赖和 Node 22）：

```sh
node slots_service/scripts/generate-fixtures.mjs
```


### 历史下注与回放

- `GET /api/v1/games/{gameId}/bet-records`：整局下注列表，一次付费及整个免费链共用一条记录，返回投注金额、已结算累计赢分、状态和时间。
- `GET /api/v1/games/{gameId}/bet-records/{betId}/replay`：只读回放已提交的逐轮盘面；不返回继续下注的token，不推进进度或修改钱包。

两者均使用登录身份隔离并支持游标分页。参数和响应见 [客户端协议](docs/client-api.md)。

The mapping participates in the engine version. The test server configuration keeps the previous deployment as a non-current entry and adds the mapped entry as current. New bets use the mapping; existing bets remain pinned to their original rules and stored replay data is never rewritten. Restart the Go server after updating.

### AG1 金底联调数据（2026-11-02）

当前测试配置使用 `testdata/deployments/2026-11-02-gold/AG1` 快照。
百搭 ID 为 `10`、权重为 `0`；第 2、3、4 轴可出金底，普通概率 8.3%，免费概率 11%。
普通库生成 1,000,000 局、保留 66,882 条，免费库生成 100,000 局、保留 21,106 条；每个倍率最多保留 100 条。
两套库均覆盖快照中所有正权重倍率，并通过数值工具骨架重放校验。
当前数值配置赠送免费局数为 10/12/14，对应 3/4/5 个胡。
旧配置和旧库保留为非当前版本，供已开始的下注继续使用；新下注使用新的金底版本。

## 大厅接入与统一钱包

工作目录为`slots_service`，设置独立机台数据库`AISLOTS_DATABASE_URL`，以及与大厅一致的`LOBBY_GAME_SERVICE_TOKEN`后运行：

```sh
go run ./cmd/slots-server -config configs/server.lobby.json
```

大厅默认8081，机台默认8080。`launchTicket`经`POST /api/v1/login`兑换游戏会话，相同exchangeId允许恢复丢失的登录响应。新用户不注入测试余额。逐轮资金请求幂等，超时或本地提交失败保留待结算计划，下次state/spin先恢复，不能生成新请求号绕过。两端数据库不共用。完整部署见[大厅游戏接入](../lobby_service/docs/game-integration.md)。

## 整局统计与排行榜回放

付费投注及其全部消除、免费游戏结束后，机台在整局提交事务中写入统计Outbox及玩家游戏序号；后台按玩家流顺序向大厅投递，失败退避重试。统计投递不依赖客户端在线，不重复扣加币。

`POST /internal/rank-replay`仅供共享Bearer鉴权的大厅服务调用，校验已完成局及平台身份后签发只读分享凭据。浏览器通过原回放入口播放，不携带所有者登录会话。统计协议与榜单资格见[游戏统计文档](../lobby_service/docs/game-statistics.md)。
