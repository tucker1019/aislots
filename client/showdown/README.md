# AG3 · Wild Bounty Showdown

独立 Cocos Creator **3.8.8** 项目，来源 `/Users/yaozhao/cccProject/showdown_1068`。原项目保持不变，保留原资源 UUID、场景、音效、连消/金框/免费/倍率动画；内部资源包名 `szcw_1068wildbountyshowdown` 是资源定位名，业务 gameId 为 AG3。

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

## 协议和状态

- 登录、bets、state、逐轮spin使用现有 `/api/v1/games/AG3` 协议。spin发送 `requestId`、`bet`（基础金额整数字符串）、`betLevel`；金额展示精度2。
- 服务端Frame金额为数值；投注选项/历史汇总仍为整数字符串，不能混淆。
- 原生转轮只持有当前已结算帧；动画推进时获取下一帧，不预取整局或全部免费结果。
- 预览行不参与中奖位置映射；按稳定Cell ID定位，适配原场景从下往上的行顺序。金框1000+ID，变换结果是Wild9，使用服务端transformedIds。
- 普通×1、免费×8，倍率显示使用cascadeFactors与cascadeIndex。自动次数按付费局消费，连消和免费不消费。
- 网络失败保留requestId与原投注方案，显式重试；不伪造输局、不本地扣余额、不自动开启新付费局。
- 刷新读取state恢复静态盘面，未完成局必须显式继续。完成的免费局恢复普通控制。
- 历史入口沿用原菜单的历史图标。历史列表与分享使用现有只读接口；回放为独立的原符号逐帧视图（上一步/下一步/自动播放），不借用实时场景动画或调用spin。公开分享入口不登录、不取实时state。
- 原生退出发送无敏感信息的 `aislots:exit`；大厅检查iframe来源、origin与gameId。

## 接入范围

本地游戏服务8080允许5182来源，后台游戏目录已发布本地AG3入口（原G1068隐藏）。AG1/AG2配置及已有历史批次保留。未部署远程，未提交或推送。

## 本次验证

- 协议/视图契约/原生菜单回归13项（包含3.8.8隐藏节点Tween、竖屏切换、自动次数、金额精度、免费结束恢复、金框与触摸滚动）。
- TypeScript检查与3.8.8 web-mobile实际构建。
- 场景/Prefab脚本引用55处，未发现缺失UUID；旧平台网络/通信/上传实现无残留。
- 大厅退出消息相关测试6项通过；大厅lint/build通过。全量大厅测试曾有2项并行超时及1项RTP重复文本断言失败；限定单worker重跑相关两文件后，GamePage 6项通过，仍有1项GameInsights RTP断言失败。本次未改动RTP业务与该测试。
- 使用隔离模拟HTTP验证原生场景、连消及免费链；不操作真实账号资金。历史回放为独立逐帧盘面，不包含原生连消演出。

2026-11-12：修复未携带api参数时误向静态端口5182登录；增加本地8080/显式覆盖/线上同源回归用例，当前14项测试。
