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
- 客户端大奖门槛为投注额10/25/60倍，只读取服务端已结算的 spinWinAmount。免费倍率仍读独立配置，不假设普通倍率乘2；因此免费进入弹窗中原美术“倍率固定翻倍”的字幕隐藏。
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

`preview-template/index.ejs` 使用 Creator 自定义预览模板。`preview-template/loading/1025.jpg` 由 HTML 直接加载，位于 assets 之外，不等待 Cocos 引擎或资源系统；加载条使用 `jdt.png` 底槽与 `jdt1.png` 填充图。加载进度覆盖引擎启动、特效预制体预加载、登录、配置、状态和首屏盘面初始化。预览和 web-mobile 均在盘面准备完成后显示 START，点击后等首帧绘制再揭开游戏；预览发生错误时移除封面以显示编辑器错误信息。刷新预览即可生效，原有工具栏保留。

首屏 cell 延迟至登录、投注列表和状态接口返回后创建：有 lastFrame 就直接使用其盘面，无历史记录则使用 slots/initial_board.ts 的固定展示牌面（不参与开奖）。HTML 封面等待 aislots-board-ready 通知后的首帧才揭开；build 的 START 也在初始盘面准备好后显示。

Big/Mega/Super Win now count through each presentation tier instead of opening directly at the final tier. Big upgrades at 25x stake, Mega at 60x, and the final tier finishes at the settled win. The existing 8-second count duration is shared across tiers; displayed integer money never resets on upgrade. Clicking to skip still shows the final tier and total immediately. Threshold progression is in effects/big_win_progression.ts; native title, pile and VFX transitions are in effects/big_win_visuals.ts.

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

### 历史动画回放

History 每条记录右侧的「回放」通过该记录的 betId 读取现有只读 replay API，并自动取全分页。
游戏场景复用正常旋转、消除、免费和大奖演出；顶部显示交易 ID、轮数以及退出按钮，Esc 也可退出。
回放期间禁止下注、Stop 和投注调整，不调用 spin、不消耗请求标识；场景中的金额暂时显示历史金额。
退出后恢复进入前的实时盘面和金额，并回到相同记录列表、分页和滚动位置。
当前游戏或自动旋转尚未结束时不能进入回放；进行中的历史记录只播放已结算部分。

### 分享回放

回放顶部左侧「分享」创建只读分享链接并复制；剪贴板不支持时显示可手动选择的链接。
接收者打开 `?replay=<交易ID>&share=<分享凭据>` 后，资源加载完成即自动播放该局，不需要登录或点击START。
分享页余额固定显示 `******`，仅可看回放、再次分享或原地重新播放，不恢复真实游戏或下注。
链接保留本站域名及游戏路径，不携带平台身份和登录token。生产API默认同源；localhost链接仅供本机验证，跨设备分享需要部署到可访问域名。

历史记录每行的回放按钮左侧也可直接分享；分享按钮宽度固定，显示“已复制”时不改变布局。共享回放重播复用已加载的历史帧和场景节点，不刷新页面。

## 从大厅进入AG1

大厅申请入口后跳转至 `?launchTicket=...`。客户端用稳定exchangeId兑换游戏会话，成功后从地址栏移除票据；当前标签页的sessionStorage保存游戏会话以支持刷新恢复。真实会话失效要求返回大厅，不回退到测试用户。机台需使用server.lobby.json，并与大厅设置相同的LOBBY_GAME_SERVICE_TOKEN。独立测试预览仍使用server.test.json。

Cocos场景启动时关闭profiler统计面板，预览和构建均不显示FPS/Draw Call。大厅iframe刷新复用同一已兑换票据对应的游戏会话；新的票据仍重新兑换身份。

## 免费资源生命周期

初始资源只包含免费触发页 `pop_free_tri`。触发后先显示该页，`bonus_lading` 旋转、`bonus_lab` 显示加载百分比，隐藏开始按钮；免费弹窗、免费面板、粒子及音频全部就绪后才显示按钮。失败保留触发页，可点击重试；回放也使用相同流程，加载完成后才启动自动关闭计时。

恢复到进行中的免费局先等待资源准备，免费结束、回放重播/退出及组件销毁时释放免费实例与所持有的资源引用。场景中的免费粒子宿主保留编辑器坐标和缩放，只保留空组件；实际粒子按需挂入，避免场景提前持有免费图片和动画。`ui_top_bar` 与当前符号映射保持本项目配置。

相关回归：`node --test tests/free_loading.test.cjs tests/ag2_board.test.cjs tests/effect_assets.test.cjs`。业务类型检查沿用 ES2020（已有 BigInt），引擎声明单独跳过：`tsc --noEmit --skipLibCheck --target ES2020 --lib ES2020,DOM -p .`。

## 1024 免费与大奖弹窗资源

`pop_free_tri / pop_free_again / pop_free_end / big_win` 使用参考 `mahjongway2_1024` 的预制体、美术及动画。通过 `python3 tools/import_popup_assets.py /path/to/mahjongway2_1024` 重导；工具只处理这四个预制体及递归依赖，清除旧业务脚本和按钮回调，保留显示组件并适配为当前 `MWSpriteCtrl`。资源使用独立确定性 UUID，四个公开预制体 UUID 保持原值。

新增图片、图集、位图字体及页图片在 `assets/mahjongway2/res/texture1/popups/`；动画与材质在 `resources/mahjong_effects/ag2_popups/`。`tools/popup_assets_manifest.json` 记录来源、依赖映射及原始二进制哈希。大奖使用参考项目 `bgq / bw_text` 等节点，保留10/25/60分级和金额连续滚动；免费触发页适配 `bl_icon/cnt / bonus_loading`，继续显示加载进度与重试。相关测试增加 `tests/popup_reference.test.cjs`。

## 参考音频

预览和构建模板的66个MP3与 `mahjongway2_1024` 的 `assets/mahjongwaytwo/res/sound` 一致；普通音乐为 `bgm_mg`，免费音乐为 `bgm_fs`，不再使用第一款游戏的 `bgm_bonus_loop`。重导命令：`python3 tools/sync_audio.py --source /path/to/mahjongway2_1024/assets/mahjongwaytwo/res/sound`，二进制哈希记录在 `tools/audio_reference_manifest.json`。

普通/免费背景音乐分别按现有生命周期播放；免费BGM仍按需加载与释放。中奖中等奖音效按本项目服务端符号6–9（八万、白板、红中、发）判断，单符号语音及第二段0.6秒延迟保留。待机时按原项目顺序循环 `voxRandom01–11`，间隔5–12秒；旋转、自动旋转、弹窗、静音和切到后台时不播放待机语音。

音频URL带由全部音频内容计算的版本号，避免同名背景音乐继续命中旧缓存；同步工具自动更新版本。

## 通用记录页中的游戏美术

历史详情和赔率说明继续使用通用页面结构，只更新 `resources/history/art.json` 内的游戏图案。用安装了 Pillow 的 Python 执行：

```sh
python3 tools/export_history_art.py --source /path/to/mahjongway2_1024
python3 tools/cleanup_legacy_art.py --source /path/to/mahjongway2_1024
```

导出39张图到 `texture1/history`，包括正常/金底牌、WILD、胡、倍率数字、倍率背景和箭头，源文件及输出哈希见 `tools/history_art_manifest.json`。停止按钮的模糊/灰色箭头使用目标图集中的 `spin_arrow_blur / spin_arrow_grey`。场景隐藏图片引用清空，启动图及进度条资源从目标项目迁入 `texture1/loading`，节点位置、缩放、层级保留。

旧手工金币发射逻辑已移除，大奖和免费结算使用1024预制体内的原生粒子。清理144项不再引用的旧资源（及其meta），清单位于 `tools/legacy_art_cleanup.json`。旧 `texture` 目录及目录meta已在确认无依赖后删除。相关检查为 `tests/resource_cleanup.test.cjs`；不要用早期面向第一款游戏的通用 `import_effects.py` 覆盖当前资源。
