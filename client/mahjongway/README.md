# Mahjongway 客户端

使用 Cocos Creator **3.8.8** 打开此目录，打开 `assets/mahjongway/mahjongway.scene` 后预览。

复制来源：`/Users/yaozhao/cocosproject/tkgame/mahjongway/`。源项目未修改。

## 服务端联调

先启动本仓库 PostgreSQL 与 Go 服务，默认接口地址 `http://127.0.0.1:8080`。服务端测试配置允许本机 5180、7456、7457 来源。预览参数 `?api=http://127.0.0.1:8080` 可以覆盖地址；appname/appkey/uid 参数可覆盖测试身份，默认 test-platform/test-app/test-user，登录带 test:true。

依次调用 login、bets、state、spin；超时重试保留原服务端 requestId 和投注金额。刷新后按 state.lastFrame 静态恢复最后已结算盘面和累计赢分，不重新转轴、不重复加钱；消除播放后用 state.requestId 请求下一轮。多个窗口共享测试用户时，409冲突会同步状态并提示手动重试，不自动新开下注。spin 统一负责当前轮结算，客户端不发送动画确认。

点击旋转开始或重试，停止按钮在等待响应时先记住立即停止请求。加减按钮使用服务端投注列表，当前投注未完成时不可换档。

服务端盘面为5列，每列1个预览格+4个有效格；客户端上下装饰牌不参与消除。同次消除保留装饰牌，依照格子 id 匀速补牌。普通/免费逐轮播放并显示服务端余额及累计赢分。

## 原生特效资源

特效来自 `/Users/yaozhao/cccProject/mahjongway1_1025/`，源项目未修改。

- `assets/resources/mahjong_effects/`：原生预制体、28段动画、图集、材质、数字字体及配套音效，约6.4 MiB，可直接在 Cocos 编辑器中修改。
- `assets/mahjongway/src/effects/`：预制体加载与姿态重置、弹窗/金币演出、Scatter期待时序。只保留原 MWSpriteCtrl 的图片切换接口，不引入旧平台或旧网络模块。
- 已接入普通消除、金底翻百搭、百搭/Scatter待机及Scatter停轴闪光、免费进入/追加/结算、大奖、倍率条、期待光框及转动/停止/Turbo按钮动画。消除等待原生 Animation 完成，保留原动画 speed。
- cell 初始化35个后复用，特效按cell缓存，金币按类型回收；补牌保持统一速度并增加落地回弹。
- 原版大奖门槛为投注额5/15/50倍，只读取服务端已结算的 spinWinAmount。免费倍率仍读独立配置，不假设普通倍率乘2；因此免费进入弹窗中原美术“倍率固定翻倍”的字幕隐藏。
- 弹窗点击可跳过计数或继续，超时自动结束，不向服务端发送动画确认；刷新后先静态恢复最后已结算盘面、余额和累计赢分，再继续下一未结算轮。

更新源资源：从仓库根目录运行 `python3 client/mahjongway/tools/import_effects.py /Users/yaozhao/cccProject/mahjongway1_1025`。工具保留UUID、递归复制依赖并剔除旧业务组件和按钮回调；会覆盖已迁入的同名资源，手工修改前请先保存自己的版本。

当前仍为测试身份，不接真实平台。移动设备帧率和长时间运行尚需真机验证。

## 验证与网页构建

从仓库根目录运行 `node --test client/mahjongway/tests/client.test.cjs`（使用 slot_math 已安装的 TypeScript）。覆盖请求幂等、恢复、错误恢复、重复点击、停止以及30/60/120 FPS停轴和匀速下落。测试中的 cc mock 不代替 Cocos 引擎验证。原生预制体已在实际构建中逐项检查：普通消除、金底翻百搭、百搭消除、免费进入/结算、大奖；资源依赖除引擎内置项外均可在本项目解析。

在 Cocos 编辑器构建 Web Mobile，或：

```bash
/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator --project /Users/yaozhao/aislots/client/mahjongway --build 'platform=web-mobile;debug=true'
python3 -m http.server 5180 --bind 127.0.0.1 --directory client/mahjongway/build/web-mobile
```

打开 http://127.0.0.1:5180/ 并点击 START。首次打开编辑器会重新生成 library/temp 缓存。

### 底部面板切换

场景节点为 `Canvas/GameLayer/layout_bottom/panel1`、`panel2`。`panel1` 保留本项目 Spin、Stop、加减投注和加速按钮的原响应；菜单按钮打开 `panel2`，关闭按钮返回 `panel1`。

`BottomPanels` 控制两段各0.08秒的下滑隐藏、滑入展示，读取场景可见位置，切换中忽略重复点击。`panel2` 的退出、声音、规则/赔率、历史按钮仅导入参考美术，未复制旧业务回调，后续分别实现。导入工具 `tools/import_bottom_panels.py` 只补缺失资源，不修改源项目。

## HTML 游戏记录

底部菜单 History 打开游戏区域内的 div 页面。支持今天、最近7天、自定义连续最多7天；列表显示整局投注、净盈亏、中奖消除次数，底部汇总覆盖完整筛选结果。点击记录进入静态逐轮详情，包含普通/免费盘面、消除倍率、历史余额和可展开的赔付计算。整个免费链仍是一条记录。

页面只读取 bet-records 和 replay 接口，不推进开奖；关闭后恢复当前游戏操作。资源由 `tools/export_history_art.py` 从现有牌面导出至 resources/history/art.json，无额外前端依赖。新增服务端字段需要重启 Go 服务后使用。

## 预览首屏封面

`preview-template/index.ejs` 使用 Creator 自定义预览模板。`preview-template/loading/1025.jpg` 由 HTML 直接加载，位于 assets 之外，不等待 Cocos 引擎或资源系统；图片与 web-mobile 的封面一致。`preview-cover.js` 等待场景启动及首帧绘制后自动移除封面；预览发生错误时移除封面以显示编辑器错误信息。刷新预览即可生效，原有工具栏保留。构建版的 START 按钮流程保持原样。

首屏 cell 延迟至登录、投注列表和状态接口返回后创建：有 lastFrame 就直接使用其盘面，无历史记录则使用 slots/initial_board.ts 的固定展示牌面（不参与开奖）。HTML 封面等待 aislots-board-ready 通知后的首帧才揭开；build 的 START 也在初始盘面准备好后显示。

Big/Mega/Super Win now count through each presentation tier instead of opening directly at the final tier. Big upgrades at 15x stake, Mega at 50x, and the final tier finishes at the settled win. The existing 8-second count duration is shared across tiers; displayed integer money never resets on upgrade. Clicking to skip still shows the final tier and total immediately. Threshold progression is in effects/big_win_progression.ts; native title, pile and VFX transitions are in effects/big_win_visuals.ts.

Rule opens an in-game HTML rules overlay using the history theme and floating scrollbar. The supplied Indonesian rules are translated into Chinese in rules/rules_content.ts. Per explicit content approval, the reference rule of 3 scatters awarding 12 free spins (+2 per additional scatter) is preserved; this static documentation does not change the server award mapping. Closing the page restores game input without sending gameplay requests.

### 独立 Web Audio

浏览器音频由 `src/audio/web_audio.ts` 管理，不通过 Cocos `AudioSource` / `AudioClip`。
`game_audio.ts` 将当前游戏符号 ID 映射到参考项目的语音，并管理普通/免费背景音乐、转轴、中奖、倍率和弹窗通道。
点击 START 或首次操作时解锁；页面进入后台暂停，回来尝试恢复。底部 Sound 控制全部通道并保存静音偏好。

静态 MP3 位于 `preview-template/audio/`，构建镜像位于 `build-templates/web-mobile/audio/`。
更新后运行 `python3 tools/sync_audio.py`，再构建。部署时需保留输出根目录的 `audio/`。
页面根节点的 `data-audio-backend`、`data-audio-state`、`data-audio-muted` 可用于检查解锁和静音状态。

排查语音时可使用 `?audioDebug=1`：页面根节点 `data-audio-award` 显示实际中奖图标，
`data-audio-events` 保留最近的请求、启动和停止记录（文件名、通道、音量与 AudioContext 状态）。
图标去重使用 `Array.from(new Set(...))`，避免 Cocos loose spread 把 Set 当成单个数组元素。
