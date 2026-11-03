# AISlots

游戏大厅、机台服务、Cocos 游戏客户端及数值工具的单仓库项目。当前接入 AG1「麻将胡了」，包含用户、统一钱包、测试充值、活动、邀请奖励、报表、游戏统计和排行榜回放。

大厅和机台是独立 Go 服务，使用独立数据库，只通过 HTTP 接口交互。大厅持有真实钱包；机台负责权威开奖、逐轮进度、游戏记录和回放。

## 项目结构

| 目录 | 职责 | 说明 |
| --- | --- | --- |
| `slots_lobby/` | React + TypeScript 大厅 | [前端说明](slots_lobby/README.md) |
| `lobby_service/` | 大厅 Go 服务、用户和统一钱包 | [服务说明](lobby_service/README.md) |
| `slots_service/` | Go 机台服务、开奖与恢复 | [服务说明](slots_service/README.md) |
| `client/mahjongway/` | Cocos Creator 麻将客户端 | [客户端说明](client/mahjongway/README.md) |
| `slot_math/` | 数值编辑、模拟及盘面库生成 | [数值工具说明](slot_math/README.md) |
| `game_configs/` | 按游戏管理规则、倍率与权重 JSON | AG1 的 config/board/base/free 配置 |
| `game_libraries/` | 普通及免费模式的版本化盘面库 | 与游戏配置版本配套使用 |

## 当前功能

- 用户：游客创建、会话续期、自定义账号注册/登录/绑定、昵称和15种头像。默认会话60天，续期从当前时间重新计算；新 UID 从10000001开始。
- 钱包与充值：整数分记账、source流水、配置充值档位、手续费或赠送、订单查询和历史。当前支付为测试模式，创建订单后约3秒模拟成功。
- 活动：循环签到、日周月反水、昨日亏损返还、新手累计充值多档奖励、VIP升级奖励/周月工资/保级，以及直属邀请奖励、宝箱和好友达标详情。
- 记录与报表：充值记录、整局投注记录、逐笔资金明细及个人报表。取款、代理等未实现项目按接口标记或页面提示展示。
- 游戏入口：大厅签发短期票据，机台兑换身份；iframe 内进入 AG1，刷新恢复已结算盘面，返回大厅刷新余额。
- 游戏统计：整局完成事件通过机台持久化 Outbox 同步大厅，生成 RTP、派彩/倍数/连胜排行榜；派彩及倍数榜支持只读回放。
- 大厅界面：手机竖版布局，中英文切换，账户、充值、福利、赚钱及记录页面。当前仅 AG1 可玩，其他厂商入口提示敬请期待。

## 数据流与服务边界

```mermaid
flowchart LR
    A[React 大厅] --> B[大厅服务 / 用户与钱包]
    A --> C[Cocos AG1 客户端]
    C --> D[机台服务 / 开奖与恢复]
    D -->|票据兑换、逐轮结算| B
    D -->|Outbox 整局完成通知| B
    B --> E[(独立大厅数据库)]
    D --> F[(独立机台数据库)]
    G[数值工具] --> H[规则配置与盘面库]
    H --> D
```

一次付费投注及其消除、免费游戏构成一整局；付费只扣一次，各轮派彩按展示进度结算。机台先保存待结算计划，大厅确认后再提交盘面与回执。请求超时或本地提交失败时沿用原请求号恢复，不重抽、不重复扣加币。活动统计来自可信服务端事件，客户端不能上报流水。

开奖按数值配置抽取目标倍率，从配套盘面库选骨架，补空并重放验证，再返回已结算的当前轮；不向客户端泄露未来完整结果。

## 本地启动

需要 Go 1.25、Docker，以及大厅前端所需的 Node.js >=22.12。Cocos 项目使用的编辑器版本见其 `package.json`。分别在各项目目录运行，详细依赖和数据库配置见子项目 README。

| 组件 | 默认地址/端口 |
| --- | --- |
| 大厅前端 | `http://127.0.0.1:5175` |
| 大厅构建预览 | `http://127.0.0.1:4175` |
| 大厅服务 | `http://127.0.0.1:8081` |
| 机台服务 | `http://127.0.0.1:8080` |
| AG1 网页入口 | 大厅游戏配置默认指向 `http://127.0.0.1:5180/` |
| 大厅 PostgreSQL | `127.0.0.1:55433`，数据库 `aislots_lobby` |

1. 启动大厅数据库和服务（工作目录 `lobby_service`）：

   ```sh
   docker compose up -d
   export LOBBY_DATABASE_URL='postgres://lobby:lobby-local-only@127.0.0.1:55433/aislots_lobby?sslmode=disable'
   export LOBBY_GAME_SERVICE_TOKEN='<本地生成并由两端共用的随机密钥>'
   make run
   ```

2. 启动机台数据库并按机台 README 设置独立的 `AISLOTS_DATABASE_URL`。在 `slots_service` 中使用相同密钥启动大厅接入模式：

   ```sh
   export LOBBY_GAME_SERVICE_TOKEN='<与大厅相同的随机密钥>'
   go run ./cmd/slots-server -config configs/server.lobby.json
   ```

3. 用 Cocos 打开 `client/mahjongway`，使网页入口与 `lobby_service/etc/games.json` 中的 URL 一致；默认5180是配置的入口地址，需自行启动对应网页服务。
4. 在 `slots_lobby` 中运行 `npm ci`、`npm run dev`，打开5175。

共享密钥可用 `openssl rand -hex 32` 生成，通过环境变量注入，不放入前端或版本库。未设置时大厅不能签发游戏票据，机台真实模式拒绝启动。`server.test.json` 是独立测试钱包模式，不能当作大厅统一钱包模式使用。

## 配置与接口文档

大厅业务配置在 `lobby_service/etc/`，包含充值、签到、反水、VIP、新手充值、邀请与游戏入口；环境变量覆盖及配置快照规则见对应文档。机台部署配置在 `slots_service/configs/`，路径相对于服务配置文件解析；规则和盘面库需保持版本配套，进行中的局继续使用原版本。

- [用户与资料](lobby_service/docs/user-api.md)、[充值订单](lobby_service/docs/recharge-api.md)
- [签到](lobby_service/docs/checkin-api.md)、[反水和亏损返还](lobby_service/docs/returns-api.md)、[VIP](lobby_service/docs/vip-api.md)
- [新手充值](lobby_service/docs/newbie-recharge-api.md)、[邀请奖励](lobby_service/docs/invite-api.md)
- [游戏接入、投注记录、资金明细和个人报表](lobby_service/docs/game-integration.md)
- [RTP、排行榜、回放及统计重建](lobby_service/docs/game-statistics.md)
- [金币 source 注册表](lobby_service/docs/coin-sources.md)、[机台客户端协议](slots_service/docs/client-api.md)

金额接口通常返回数字整数分，展示统一除以100；游戏统计累计金额、倍数等字段有字符串口径，以各接口协议为准。HTTP 响应提供 `X-Trace-Id`，可用于关联请求日志。

## 开发检查

- 大厅服务：`make test`、`make lint`；协议修改先改 proto 再 `make build`，数据库迁移后 `make model`，source 在脚本中维护。
- 大厅前端：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。
- 机台服务：`make check`；数据库集成测试配置 `AISLOTS_TEST_DATABASE_URL` 后运行 `make integration`。

开发规范见各模块 `AGENTS.md`。提交按模块拆分，使用仓库 skill 规定的中文前缀。真实支付渠道、Google/Telegram绑定、取款及完整代理系统仍待接入。
