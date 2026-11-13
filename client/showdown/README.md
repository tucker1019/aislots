# AG3 · Wild Bounty Showdown

独立 Cocos Creator **3.8.8** 项目，来源 `/Users/yaozhao/cccProject/showdown_1068`。原项目保持不变，保留原资源 UUID、场景、音效、连消/金框/免费/倍率动画；业务 gameId 为 AG3。取消原项目自定义 Bundle，仅保留 `assets/wildbountyshowdown/WBSGameScene.scene` 游戏场景，编辑器直接打开该场景运行。动态资源使用内置 `resources/res`，UUID 保留。

已删除旧平台 Socket、Protobuf、GameBridge、认证、充值/VIP跳转、上传及部署脚本。源美术保留原样。项目不包含旧 library/temp/release 缓存。

## 本地运行

从仓库根目录，使用 Node 22：

```sh
node client/showdown/scripts/test.mjs
node slot_math/node_modules/typescript/bin/tsc -p client/showdown/tsconfig.json --noEmit --skipLibCheck --target ES2020 --lib ES2020,DOM
node client/showdown/scripts/build.mjs
python3 client/showdown/scripts/serve.py --port 5182
```

构建脚本使用已安装的3.8.8；可通过环境变量 `COCOS_CREATOR` 指定同版本可执行文件。检查完整完成日志和产物，兼容Creator成功返回36。首次导入后才有引擎类型声明。项目沿用仓库现有 TypeScript，不新增依赖。

从本地大厅 `http://127.0.0.1:5175/game/AG3` 进入，启动URL由大厅添加 `launchTicket`；可选 `api` 参数覆盖服务地址，本地默认8080，线上默认同源，禁止使用旧 uid/sid 参数。直接访问5182没有票据或保存会话时，显示重新从大厅进入的提示，不创建默认投注身份。

静态服务器只绑定127.0.0.1。`--mock --port 5183` 使用隔离的固定接口数据，不转发游戏服；仅用于开发验证，不能部署到远程。模拟进入URL必须显式添加 `api=http%3A%2F%2F127.0.0.1%3A5183` 并使用52字符虚拟launchTicket，绝非真实账号凭据。

## 单场景启动

- `WBSGameScene` 是编辑器预览及构建的唯一入口；已移除 `h5main`、`game` 中转场景及加载脚本。
- 场景先创建管理器并初始化平台参数，同时准备登录状态和 `resources/res/load` 资源，完成后再激活原有游戏节点。等待和失败重试期间不能操作盘面。
- 管理器随场景销毁，不再作为跨场景持久节点；不使用自定义 Bundle 或场景跳转。
- `resources` 是 Cocos 内置动态资源入口，不是原项目的自定义游戏 Bundle。

## 协议和状态

- 登录、bets、state、逐轮spin使用现有 `/api/v1/games/AG3` 协议。spin发送 `requestId`、`bet`（基础金额整数字符串）、`betLevel`；金额展示精度2。
- 服务端Frame金额为数值；投注选项/历史汇总仍为整数字符串，不能混淆。
- 原生转轮只持有当前已结算帧；动画推进时获取下一帧，不预取整局或全部免费结果。
- 预览行不参与中奖位置映射；按稳定Cell ID定位，适配原场景从下往上的行顺序。金框1000+ID，变换结果是Wild9，使用服务端transformedIds。
- 普通×1、免费×8，倍率显示使用cascadeFactors与cascadeIndex。自动次数按付费局消费，连消和免费不消费。
- 网络失败保留requestId与原投注方案，显式重试；不伪造输局、不本地扣余额、不自动开启新付费局。
- 刷新读取state恢复静态盘面，未完成局必须显式继续。完成的免费局恢复普通控制。
- 历史入口沿用原菜单的历史图标。历史列表与分享使用现有只读接口；回放在独立 Cocos 实例中播放原生动画，不调用spin。公开分享入口不登录、不取实时state。
- 原生退出发送无敏感信息的 `aislots:exit`；大厅检查iframe来源、origin与gameId。

## 接入范围

本地游戏服务8080允许5182来源，AG3 公网版本已于 2026-11-12 发布（见部署记录）。本次单场景改造仅修改本地，尚未重新部署。

## 本次验证

- 协议/视图契约/原生菜单回归13项（包含3.8.8隐藏节点Tween、竖屏切换、自动次数、金额精度、免费结束恢复、金框与触摸滚动）。
- TypeScript检查与3.8.8 web-mobile实际构建。
- 场景/Prefab脚本引用55处，未发现缺失UUID；旧平台网络/通信/上传实现无残留。
- 大厅退出消息相关测试6项通过；大厅lint/build通过。全量大厅测试曾有2项并行超时及1项RTP重复文本断言失败；限定单worker重跑相关两文件后，GamePage 6项通过，仍有1项GameInsights RTP断言失败。本次未改动RTP业务与该测试。
- 使用隔离模拟HTTP验证原生场景、连消及免费链；不操作真实账号资金。该阶段使用独立逐帧盘面；已由下方原生动画回放取代。

2026-11-12：修复未携带api参数时误向静态端口5182登录；增加本地8080/显式覆盖/线上同源回归用例，当前14项测试。

2026-11-12 单场景改造：取消自定义 Bundle，删除两个中转场景，17 项测试和 TypeScript 检查通过，Creator 3.8.8 构建及隔离 mock 首屏/盘面验证通过。单场景改造仅更新本地构建，未重新部署。

### 2026-11-13 HTML 首屏加载封面

`loading_bg_en.jpg`、`loading_jdt1.png`（底槽）、`loading_jdt2.png`（填充）移出 assets，放入 `preview-template/loading` 与 `build-templates/web-mobile/loading`。HTML 在 Cocos 脚本前展示封面和加载条，不再实例化场景内 loadingPage；启动 loadingLayer 保持隐藏。进度来自 resources.loadDir，资源与会话准备好后恢复游戏节点，初始化盘面并等引擎绘制，再显示 START。点击沿用原生入场演出，首次绘制可见游戏后移除 HTML；公开分享回放自动开始。后续更新封面时两份模板资源须保持一致。

首屏 AG SVG 与 AG1/AG2 保持一致：至少展示 1 秒，收到实际场景绘制通知后渐隐，不能由封面图片加载完成触发。开始按钮统一为 START，尺寸、边框、圆角与字号按封面宽度缩放，不再使用随 iframe 高度变化的固定百分比高度，也不换行。

### HTML 投注与自动旋转面板

`src/ui` 复用 AG1/AG2 的 HTML 滚轮、底部抽屉样式和适配方法；按 AG3 的 750×1334 可见游戏区域定位。`WBSPopupMenuCtrl` 的原投注、自动按钮入口转到 `ag3_panels.ts`，不再实例化对应原生面板。档位与等级读取当前服务端初始化后的 GameManager，投注确认保留具体档位和等级，取消不提交。自动次数接原有 onAutoSelectClick / AutoBudget，不更改服务端协议。运行中、免费阶段、自动旋转和公开回放禁止打开；场景销毁清理 DOM 与监听。

### 原生动画回放与分享

历史记录回放改用独立、可销毁的 AG3 Cocos iframe，不改动当前游戏的盘面、投注、余额和下一请求 ID。父页面读取同一订单全部历史分页，再通过校验 source / origin / 随机 channel 的消息将历史帧传入；不传认证信息或历史余额。子实例跳过登录、config、state 和 spin，原生转轴、消除、金框、倍率及免费演出仅消费有限的已结算帧。未完成历史在最后已结算帧停止。

分享入口使用受限的 shared-replays API，无需登录，不查询实时余额；钱包显示 ******。回放顶栏提供分享、退出，结束后可原地重新播放。分享按钮保持固定尺寸；剪贴板被权限策略禁止时提供可选择的手动复制链接。退出私有回放销毁子实例、恢复父页面音乐并返回原历史列表。旧小格子回放面板已移除。

### 中文 HTML 赔率与规则

菜单原 Payment Table 入口改为 `rules/Ag3PaytablePage`，不再实例化英文规则图面板。标题栏、游戏区域定位、背景主题、悬浮滚动条和关闭恢复复用 AG1/AG2 RulesPage 实现；插图取 AG3 已加载的原生 SpriteFrame（含金框转 Wild、倍增、免费与 Ways 示意）。`paytable_data.ts` 按用户提供的印尼语 HTML 翻译，保留符号1～8的3～6轴赔率、×8免费起始倍数、1,024最高倍增、5,000倍最高赢奖、购买功能说明及3,600 Ways示例。此页只展示文档，不修改服务端数值，也不新增购买接口。

### HTML 提示与重试

AG3 使用 `ui/game_dialogs.ts` 的 AG1 风格 HTML 提示：深色余额不足／普通提示、白色网络失败与重试、中文会话失效返回入口；Toast 也不再依赖原生预制体。所有提示按实际游戏区域缩放，场景销毁统一清理。恢复未完成游戏的提示延迟到 START 后原生入场结束附近，避免封面未关闭就推进游戏。网络重试继续使用原待处理请求，不创建新投注标识。旧 AlertLayer 维持删除，相应资源断言改为检查其不存在。
