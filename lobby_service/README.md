# AISlots 大厅服务

采用 apps-skills 的 HTTP 单体方案。独立 Go 模块（module apps）、PostgreSQL 数据库、容器及卷；与机台服务通过接口交互，不引用其代码或数据库。

## 启动

```sh
docker compose up -d
export LOBBY_DATABASE_URL='postgres://lobby:lobby-local-only@127.0.0.1:55433/aislots_lobby?sslmode=disable'
export LOBBY_SESSION_DAYS=60
make run
```

默认监听 `127.0.0.1:8081`，通过 `LOBBY_HTTP_ADDRESS` 修改。独立数据库名称固定 `aislots_lobby`，端口 `55433`。开发密码仅供本机使用。启动自动执行幂等 SQL，已有用户和 sid 保留。

GoLand：运行种类 Package；包路径 `apps/app/apis/lobby/api`；工作目录为当前 `lobby_service` 绝对路径；环境变量配置 `LOBBY_DATABASE_URL`。

## 目录和开发顺序

- `protos/apis/lobby/api/v1`：Protobuf HTTP 协议，路径由 google.api.http 注解定义。
- `protos/apis/lobby/api/errors`、`protos/common/errors`：八位错误码及服务前缀。
- `pb/`：protoc 生成类型，禁止手改。
- `app/apis/lobby/api/internal/handler`：参数绑定、加解密边界、响应序列化。
- `internal/router`：从 Proto 描述文件生成路由，禁止手改。
- `internal/logic/userv1/userservice`：用户业务。
- `internal/repository`、`internal/repository/model`：依赖接口、GORM 生成 Model 和自定义事务方法。
- `internal/svc`、`internal/config`：依赖注入与配置。
- `pkg/xerr`、`pkg/xlog`、`pkg/codec`：错误、上下文日志与加解密透传入口。
- `deploy/migration`：独立数据库 SQL。

上面的 `internal/` 均位于 `app/apis/lobby/api/`。

先修改 proto，`make build` 生成 pb 与 HTTP 路由；再实现 logic/repository。表结构修改后先执行迁移、确认表存在，再 `make model` 从数据库生成模型，扩展操作写在对应的 `*_model.go`。`make mock` 生成 Repository mock。

依赖 protoc 和 protoc-gen-go v1.36.6（安装：`GOTOOLCHAIN=go1.25.0 go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.6`）。google HTTP annotation 源文件已放在 `protos/third_party`。技能包没有提供内部框架源码及代码生成工具，本模块提供最小生成器和公共包；尚无独立协议仓库，先随本模块版本管理 proto。PostgreSQL 为现有独立数据库选择，适配技能中的 GORM 模式。

## 接口

账号操作接口为 POST + JSON，资料和活动查询另有 GET 接口，具体以协议为准；公共查询参数如 `cv、app_name、app_key、uuid、lca_coun、lca_lang、client_ts` 可随请求携带，MVP 不据此鉴权或划分租户。uid/sid 可在查询参数或 JSON 中传入，同时出现必须一致，重复身份查询参数拒绝。uid 为数字，sid 为字符串。

| 路径（前缀 `/api/user/account/`） | JSON 请求体 | 行为 |
| --- | --- | --- |
| `visitor/login` | `{}` | 每次创建新游客；客户端无缓存时调用 |
| `session/renewal` | `{"uid":1,"sid":"..."}` | 恢复登录并续期 |
| `uniquecode/register` | `{"account":"alice","password":"password123"}` | 创建独立账号 |
| `uniquecode/login` | `{"uid":1,"sid":"...","account":"alice","password":"password123"}` | 校验当前身份后登录目标账号 |
| `uniquecode/bind` | `{"uid":1,"sid":"...","account":"alice","password":"password123"}` | 游客绑定，保留 uid |

成功：`{"code":"OK","data":{"uid":1,"sid":"...","expiresAt":"..."}}`。保持 uid 为 JSON 数字，expiresAt 为 RFC3339 字符串；pb 类型使用 encoding/json 输出，由 handler 映射到客户端约定字段。

按技能将失败 code 统一为 proto 定义的数字：

| code | HTTP 状态 | 含义 |
| --- | --- | --- |
| 10010001 | 400 | 参数无效 |
| 10010002 | 401 | 会话无效或过期 |
| 10010003 | 401 | 账号密码错误 |
| 10010004 | 409 | 账号已存在或已绑定 |
| 10010005 | 500 | 数据库异常 |
| 10010006 | 500 | 系统异常 |

错误响应：`{"code":10010002,"message":"会话无效或已过期"}`。不暴露数据库错误或记录密码、sid。

账号区分大小写，长度3–64字节；密码8–72字节，bcrypt哈希存储。sid使用随机数生成，数据库仅存SHA-256。默认60天，可配1–3650天；成功续期沿用sid，从当前时间重置，过期不可续期。账号登录失败不延长旧会话；登录成功颁发新sid，保留原游客和其他设备会话。绑定和续期在同一数据库事务完成。

`pkg/codec` 中 `DecryptRequest` / `EncryptResponse` 当前透传，后续在此实现加密。

## 验证

`make test` 运行全量测试并检查每个 pkg 包≥90%、logic包≥80%的覆盖率。`make lint` 使用 golangci-lint v2.5.0；`make format` 使用 goimports/gofumpt。生成文件不手工格式化或修改。

健康检查：`GET /health`（进程存活检查）。尚不包括Google/Telegram绑定、找回密码、取款和真实支付渠道；AG1已通过独立服务接口接入统一钱包。

## 用户资料

新增 `GET /api/user/user/info`，统一返回 uid、nickname、avatarId、coins；`POST /api/user/user/update` 修改昵称和头像。完整参数与示例见 [用户资料接口文档](docs/user-api.md)。余额按整数分返回，新用户为0，存放在独立钱包余额表；资料接口不提供余额修改能力，充值由独立充值接口负责。

## 充值与金币 source

`GET /api/recharge/list` 获取配置档位；`POST /api/recharge/create` 创建付款中订单并返回订单号、测试付款链接。后台约3秒后模拟付款成功，事务更新余额、source流水与订单状态。`GET /api/recharge/order/info` 轮询详情，`GET /api/recharge/order/list` 分页查询历史，支持状态筛选。待付款订单保存在数据库，重启继续处理，幂等重试不重复加币。

配置：[etc/recharge.json](etc/recharge.json)，`LOBBY_RECHARGE_CONFIG` 可指定路径，重启生效。手续费与赠送互斥。

source统一维护：[script/coin_sources.py](script/coin_sources.py)，执行 `make source` 生成常量及文档。完整接口示例见 [充值接口](docs/recharge-api.md)。

真实数据库事务测试：设置 `LOBBY_INTEGRATION_DATABASE_URL` 为独立大厅数据库地址后执行 `make test`；测试创建并清理自己的用户，覆盖手续费、赠送、并发重试、请求冲突和余额溢出。

## 请求追踪

所有经过服务路由的HTTP响应（含参数错误、鉴权失败、404、405）均返回 `X-Trace-Id`，值为服务端生成的32位十六进制随机编号。`Access-Control-Expose-Headers: X-Trace-Id` 声明浏览器可读取此响应头；跨域请求本身仍须由部署层允许来源。

请求完成日志包含 `traceId、method、path、status、durationMs`；通过 `pkg/xlog` 输出的上下文错误日志自动携带同一traceId。只记录路径，不记录含sid的查询串或请求体。当前每次请求生成独立编号，不接受客户端指定的编号覆盖，也不改变充值requestId的业务幂等规则。

## 循环签到

`GET /api/activity/checkin/info` 查询今日进度，`POST /api/activity/checkin/claim` 领取奖励；两个接口均需uid/sid。断签重置第1天，领完配置周期重新循环，每天只计算当天流水及成功充值。配置[etc/checkin.json](etc/checkin.json)，可用LOBBY_CHECKIN_CONFIG覆盖，默认Asia/Shanghai（北京时间）时区，修改后重启。示例7天的门槛/奖励为可调整占位配置。

独立业务事件和每日汇总统计流水，预留可信游戏结算适配方法，不遍历机台source；AG1已通过可信逐轮结算接入真实游戏流水。完整协议与接入约定见[签到接口文档](docs/checkin-api.md)。

## 日周月反水与亏损返还

`GET /api/activity/rebate/info` 分别返回日/周/月上一周期可领取奖励及当前周期实时预估；`POST /api/activity/rebate/claim` 一次领取全部到期反水。`GET /api/activity/loserreturn/info` 查询昨日净亏损返还及今日预估，`POST /api/activity/loserreturn/claim` 单独领取。均需uid/sid，领取时带info的activityDate防止跨日误领。

配置[etc/returns.json](etc/returns.json)，LOBBY_RETURN_CONFIG可覆盖，默认比例0.8%、0.1%、0.1%、10%，沿用签到活动时区，过期不补领。奖励批次、明细、source和余额事务提交。AG1投注/派彩已接入可信结算事件。完整示例见[反水与Loser Return文档](docs/returns-api.md)。

## VIP等级、保级与工资

`GET /api/vip/info`返回VIP0–VIP30配置、升级/保级进度、待领升级礼金、已结算周月工资和当前周期预估；升级礼金、周工资、月工资分别通过POST `/api/vip/upgrade/claim`、`/api/vip/weekly/claim`、`/api/vip/monthly/claim`领取。所有接口需uid/sid，领取需要requestId和activityDate。

[etc/vip.json](etc/vip.json)按截图的元金额换算为分，可用LOBBY_VIP_CONFIG覆盖。后台执行30天无活动后15天保级任务、到期降级和周月工资结算；结算不加币，领取才加币。进入保级清零升级流水和充值进度，期间完整累计；成功后全部计入升级进度（不扣保级门槛），失败则降级并清零本次累计，但不清历史奖励。完整协议见[VIP接口](docs/vip-api.md)，截图数值核对见[元配置表](docs/vip-config.md)。

## 新手累计充值

`GET /api/activity/newbie-recharge/info`返回注册起活动截止时间、累计成功充值、各档进度/还差金额/可领状态；`POST /api/activity/newbie-recharge/claim`手动合领全部已达标未领取档位，requestId幂等，每档仅一次。

[etc/newbie-recharge.json](etc/newbie-recharge.json)可配置天数、门槛、奖励、到期是否作废。示例注册起3天内充值100/500/1000元分别额外赠10/50/100元，配置仍为整数分。注册时快照规则，不扫描source；成功充值本金按精确时间窗口统计。详见[新手充值接口](docs/newbie-recharge-api.md)。

## UID分配

新用户（游客和注册账号）UID从10000001开始，由数据库identity生成。迁移010同时适配新库和已有库，保留已分配UID并只向前调整序列，重复启动不会回退或重用编号。

## 游戏统一钱包与记录

大厅是唯一真实钱包，机台数据库独立，双方只通过HTTP交互。`POST /api/game/launch`签发短期票据；机台通过Bearer鉴权的内部接口兑换身份、查余额、逐轮结算。部署时两端必须设置相同的`LOBBY_GAME_SERVICE_TOKEN`；仅配置数据库不会自动启用游戏入口。游戏地址、厂商和私有API地址在[etc/games.json](etc/games.json)中配置。

`POST /api/game/records`查询整局投注，`POST /api/game/wallet-ledger`及`/detail`查询逐笔账变，`POST /api/user/report`查询今天、昨天、本周、上周报表。充值本金、赠送、手续费和奖励各自记账；有效流水来自可信事件。完整部署、重试恢复和报表口径见[游戏接入文档](docs/game-integration.md)。

## 邀请奖励

首次游客创建可携带inviteCode；资格门槛和奖励在注册时保存快照，按期限内成功充值次数、本金及实际投注判定。支持邀请信息、全部合领、分页宝箱单领和直属好友详情，奖励入账与source流水事务提交。配置[etc/invite.json](etc/invite.json)，接口及边界见[邀请文档](docs/invite-api.md)。当前是直属邀请奖励，不是完整五级代理系统。

## RTP、排行榜及回放

机台整局完成后通过持久化Outbox投递`/internal/game/complete`，大厅核对逐轮资金汇总后更新分钟RTP桶及排行榜，不重复结算钱包。统计启用时间固定，不回填旧局。

`POST /api/game/rtp`支持5分钟、1小时、24小时；`POST /api/game/leaderboard`支持派彩、倍数、连胜及今日、近7日、全部周期。`POST /api/game/rank-replay`只允许当前派彩/倍数榜前20的订单，服务端查找所属机台并签发只读回放地址，不公开玩家身份。统计配置、精度、缓存、重建命令见[统计文档](docs/game-statistics.md)。
