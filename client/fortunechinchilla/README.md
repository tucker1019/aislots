# Fortune Chinchilla · AG10

原版来自 `fortunechinchilla_1022-master`，目录名 `fortunechinchilla`，业务编号 `AG10`。使用 Cocos Creator **3.8.5**。按上级 [迁移规范](../README.md) 完整复制原项目后接入；初始复制核对了 950 个 assets 文件，随后才做协议替换、单场景和清理。原工程保留在原位置作对照。

## 本地入口与构建

- 大厅：`http://127.0.0.1:5175/`，AG10 排在 AG9 后。
- Web Mobile：`http://127.0.0.1:5192/`，从大厅领取票据进入；直接打开裸地址不会创建真实玩家会话。
- 游戏 API：本机默认 `http://127.0.0.1:8080/api/v1`，非本机默认同源。大厅入口、API 和独立盘面库配置分别在 `lobby_service/etc/games.json`、`slots_service/configs/server.lobby.json`。

```sh
npm run build
python3 -m http.server 5192 --bind 127.0.0.1 --directory build/web-mobile
```

`COCOS_CREATOR` 可指定 Creator 可执行文件。构建脚本检查完成标志和产物，不单凭退出码宣称成功。启用内容哈希，Web 管线缓存按 settings 构建版本隔离。

已有大厅数据库需通过带审计的 `import-game-catalog -enable-ag10 -apply` 补齐 AG10 并隐藏旧 G1022；etc 不会覆盖运营后台的已发布配置。部署打包和 Nginx 已支持 `/games/ag10/`，发布记录见 `deploy/test/DEPLOYMENT.md`。

## 原版数据流与协议映射

原网络消息最终写入 `onceRotateInfo.mIcons/mAwardList`，再由中心控制器、列控制器和格子组件执行原作演出。现在 HTTP 数据经过 `FCResultAdapter` 转为同一展示结构。角色、Spine、转轴运动、中奖线、大奖动画及资源均来自龙猫原作。

| 服务端数据 | 原版展示与动作 |
| --- | --- |
| board：按列、列内从上到下，3/4/3 | 转为从下到上的交错槽位；格号 1–10 对应原版槽位 7/4/1/11/8/5/2/9/6/3；两侧遮罩外格子不参与验奖 |
| 普通符号 1–7 | 原版普通图标、Wild 和停轴/中奖 Spine |
| 0、奖励符号 11–20 | 0 映射原版空白 10；11–20 使用原版现金奖励素材，含预留 500 倍符号 |
| gameData.lineWins | 原版 1–10 条中奖线与每线金额 |
| gameData.replay.payouts | 使用服务端实际派彩金额进行逐个奖励飞入和累计；封顶不按未封顶倍率反算 |
| triggeredFree | 原版角色与卷轴联动、灯光、卷轴弹窗、奖励飞入及背景转换；进入 8 轮特殊旋转 |
| mode=free、freeRemaining | 每轮先起转，再请求当前结果、停轴、派奖演出，然后推进下一轮；次数使用当前帧 |
| nextAction=complete | 原版大奖与回到普通模式，恢复手动/自动操作 |
| state.lastFrame / hasNext | 已完成恢复盘面、WIN、连线；未完成恢复已交付帧和特殊背景，再取下一轮，不重复已播轮次 |
| replay.startBoard / frames | 上一局盘面起转，再播放本局逐帧结果；只读，不请求 live spin；余额始终为 `******` |

实玩请求仅获取当前帧。`launch_session` 按 API/gameId 保存标签页会话和兑换标识；超时重试复用原 requestId 与下注参数，成功后使用 nextRequestId。档位、线数和等级来自 bets，余额不足不启动转轴。

AG10 的线数为 10，金额为整数分。金币、历史和 HTML 弹窗使用印尼整数格式，不加 Rp、不显示小数；倍率保留精度。HTML 文案为印尼语，规则内容来自原作和 AG10 配置，连线图从原版 help4 裁出，不使用其他游戏插图。

## 单场景、通用界面与清理

唯一场景是 `assets/FCGameScene.scene`，编辑器和 Web Mobile 使用同一场景。旧自定义 bundle 已移除，资源使用引擎内置 resources，不再远程加载游戏 bundle。

启动顺序：公共 AG 动画 → 龙猫原版封面和真实加载进度 → MULAI → launch 全屏遮挡 → 首个游戏帧绘制后移除遮挡。Preview 和 Web Mobile 模板配套。

投注档位、自动旋转、规则、Alert、历史与回放使用现有通用 HTML 样式；新增历史图标复用公共素材，菜单原按钮尺寸保留。原版格子、大奖、数字和角色控制器保留，特别保留双层角色/卷轴 Spine。

删除旧入口场景、入口脚本、WebSocket/心跳/收发、旧平台 GameBridge、旧弹窗及其独占资源、旧平台字体引用和上传脚本。经过 UUID 与动态路径核对后删除 62 个旧入口/旧面板独占资源；运行中的游戏 Spine、动画、位图字体和音效保留。原编辑器 UUID 克隆工具夹带的旧工程副本也已移除。

Creator 3.8.5 会暂停隐藏节点的 Tween，因此缓冲格必须等回弹回调全部结束后再隐藏。这是引擎兼容修正，保留原版回弹时长与动作。每次起转将停轴许可清零，只有当前 HTTP 帧接收完成才能停轴，防止慢响应时使用上一轮结果。

服务端另补齐 AG10 存储结果解码：AG10 与 AG5 共享 `fortune_rabbit_v1` 线协议，但由 gameId 区分独立结果，避免读取 AG10 历史或推进特殊轮时出现 `unknown AG5 result version`。

## 验收记录（2026-11-19，本地）

- Creator 3.8.5 Web Mobile 构建成功；最终构建无缺失脚本、字体或资源告警。Preview 模板做资源一致性检查，未声称已人工打开编辑器预览。
- TypeScript 检查通过；仓库客户端测试通过。AG10 覆盖坐标/奖励金额、封顶实付映射、同请求号重试、逐轮请求、回放只读、单场景/原版封面，以及 3.8.5 隐藏节点回调回归。
- 游戏服务端 `go test ./...` 通过，包含新增 AG10 存储结果及状态回归。
- Chrome 从本地大厅实际进入，检查封面、MULAI、普通赢/输、WIN 与印尼金额；菜单历史按钮能打开真实记录，HTML 规则正常打开。
- 实际服务端保存的一笔特殊局共 9 帧（普通触发 + 8 特殊轮），完整播放，最终 `460000` 分展示 `4.600`；脱敏样本见 `tests/fixtures/special-replay.json`。
- 已完成局刷新恢复上局盘面与 WIN；未完成局在第 4 帧刷新，恢复第 4 帧后请求第 5 帧，没有回到首帧。QA 使用独立测试身份。
- 公开分享页无登录状态可播放，仅调用 shared-replays，未调用 login/bets/state/spin，余额隐藏。宽窗口缩回 320px 后无横向溢出。

执行客户端检查：

```sh
node --test client/tests/*.test.cjs
```

原作服务器已失效，不能声称做过与线上原服务器同时运行的逐帧录像对照。核对依据为完整原版源码/资源、协议映射和实际 Go 保存结果；原版角色、奖励演出和转轴相关方法已做源码对照。
