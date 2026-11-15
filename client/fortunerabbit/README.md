# Fortune Rabbit（AG5）

这是 AG5 的 Cocos Creator 客户端，基于原版 `fortunerabbit_1018-master` 迁移。项目名和项目 UUID 独立于 AG4；保留在用资源的原 UUID。动态资源使用 Cocos 内置的 `assets/resources`，原版自定义 bundle 已移除；场景组件在 `assets/fortunerabbit-code`。

当前 Cocos 入口使用 Go API，游戏演出沿用原版。原版工程使用 Creator 3.6.3，本仓库使用 3.8.5 构建。使用 `node client/fortunerabbit/scripts/build.mjs`，产物在 `build/web-mobile`。旧平台的 `npm run build` 和 `deploy.js` 不用于本地联调。

用独立测试钱包时，启动机台的 `server.test.json`，通过已列入测试 CORS 的本地端口提供游戏静态文件，在 URL 加 `?test=1`。本机测试端口不为 8080 时，用 `api` 查询参数指定机台地址。正式入口由大厅发票据，大厅和机台运行配置都需注册 AG5。

## 接口约定

按 [AG4 的公共 HTTP 规范](../../slots_service/docs/client-api.md) 接入，游戏标识使用 `AG5`：

| 用途 | 接口及行为 |
| --- | --- |
| 进场 | `POST /api/v1/login`，交换大厅的 `launchTicket`，重试沿用 `exchangeId`；后续请求使用游戏 Bearer token |
| 档位与恢复 | `GET /api/v1/games/AG5/bets`、`GET /api/v1/games/AG5/state`；用服务端档位、线数和金额精度，恢复最后结算的盘面、余额与继续位置 |
| 下注与继续 | `POST /api/v1/games/AG5/spin` 提交 `requestId`、`bet`、`betLevel`；同一请求重试沿用原参数，成功后用 `nextRequestId` 推进 |
| 历史与回放 | 复用 `bet-records`、本人 replay 和 `shared-replays`；分享回放独立加载，不登录、不下注，余额隐藏 |

AG5 的盘面为 3／4／3。按 Go 服务端合同，`mode` 使用 `base` / `free`，`nextAction` 使用 `continue` / `complete`。继续时只请求下一转；`winAmount` 是本转实付，`totalWinAmount` 是本局累计实付。特殊转、奖励格、中奖线及封顶信息走 AG5 的 `gameData`，字段以服务端接口文档及 [帧定义](../../slots_service/internal/games/ag5/frames.go) 为准。

## HTML 界面与回放

下注列表、自动旋转和 Alert 使用 AG4 的 HTML 样式。下注仍按服务端的单注、级别、线数计算，确认后保留用户选择的单注与级别。菜单中的规则与游戏记录有各自的入口；赔率表使用 AG5 的符号图和原版赔付值。Creator 预览窗口较窄时，HTML 弹层按浏览器中可见的游戏区域布局。

游戏记录支持按日期查询，详情按 AG5 的 3／4／3 盘面和服务端的实付金额展示。动画回放使用独立的只读游戏画面，从服务端保存的上一局盘面起转；隐藏余额，退出时恢复记录页的滚动位置。公开回放继续使用分享令牌。

## 原版演出接入点

| 数据入口 | 当前原版用途 |
| --- | --- |
| `FRGameLayerCtrl.onMessageReady`（旧消息 10182） | 恢复进场数据并初始化盘面 |
| `FRGameLayerCtrl.onMessageOpenAward`（旧消息 10184） | 把 `mRotateData` 和整包 `mFeeData` 交给 `FRGameManager`，通知 `FRCenterRollCtrl.setCanStop()` 播放结果 |
| `FRCenterRollCtrl` | 起停轴、兔子入场、切换特殊场景、次数提示、奖金飞入和退场 |

HTTP 帧通过 `FRResultAdapter` 映射为原版交错网格：Go 每列从上到下，Cocos 停轴格从下到上、按行交错。格子 ID 1–10 映射为原版 1-based 槽位 `[7,4,1,11,8,5,2,9,6,3]`，第 10、12 槽是边轴遮罩外的补位。仍使用原版符号节点，特殊空白映射到原版空格，随机格只用于滚动缓冲。普通线奖使用原版十组连线；奖励格按 `gameData.replay.payouts` 播放实付金额。封顶直接结束，不补造下一帧。

Web Mobile 和 Creator 浏览器预览共用单场景 `assets/FRGameScene.scene`，旧的 `h5main → game` 入口已移除。AG 动画结束后保留兔子封面，实际预加载和机台初始化完成后，START 在进度条原位出现。点击后显示全屏 launch；直到盘面首帧绘制才撤掉遮挡，之后才继续未完成的游戏或播放回放。预览时在 Creator 打开 `FRGameScene.scene`，点浏览器预览；本地联调可给预览地址追加 `test=1`（以及需要时的 `api`）。流程见 [Cocos 机台迁移规范](../README.md)。

本地验收：Creator 3.8.5 Web Mobile 构建通过。Chrome 使用 Go 测试钱包验证了普通下注、本人回放、余额不足不转轴且不发请求。用 Go 提供的固定帧样例验证了八次特殊转、封顶提前结束、丢包重试沿用同一请求号、从 `state` 续转，以及公开回放仅访问 `shared-replays`。大厅配置需要单独启用 AG5 后才能从大厅直接进场。
