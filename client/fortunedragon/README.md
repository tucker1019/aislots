# Fortune Dragon（AG8）

基于原版 1048 Cocos 工程迁移，使用 Creator **3.8.5**。入口是 `assets/FDGameScene.scene`，资源通过 Cocos 内置 `resources` 加载。Web Mobile 和编辑器预览共用 AG 开场、封面进度与 START，点击后显示全屏转场图，首个游戏盘面绘制后撤下遮罩。

- `FDGoSession` 负责大厅换票、bets、state、逐帧 spin 和回放接口。普通投注的扣款为 `bet × betLevel × 5`，五倍投注再乘 5。局内请求锁定投注与模式，同一帧重试沿用同一个 requestId。
- `FDResultAdapter` 把服务端列优先、从上到下的 3×3 盘面转为原版底行优先的卷轴数据。五条中奖线、倍率球和实际赔付均取自帧。空白倍率球只在画面上隐藏，结算仍按服务端的 1 倍。
- 触发免费时，首个回复就是第一转的结果。仍播放原版龙飞、倍率球过场和免费音乐，后续每转开始后再请求下一帧。由 `nextAction` 判断是否继续；零派奖不终止，封顶可提前结束。刷新恢复服务端最后盘面，已有后续帧时直接进入下一转。
- 历史、规则、下注选项、自动旋转和提示使用 HTML。回放先恢复 `startBoard`，再用原版卷轴播放保存帧，余额显示 `******`。旧记录没有起始盘面时使用开局盘面。
- 旧平台 WebSocket 配置、协议文件、加载弹窗及其图片、旧规则图和原平台开场素材已清理。普通文字使用系统字体，位图数字、现用底栏和免费转演出素材保留。

本地运行：

```sh
# 在本目录，使用 Node 22
npm run check:frames
npm run build
python3 -m http.server 5190 --bind 127.0.0.1 --directory build/web-mobile
```

从本地大厅选择 **Fortune Dragon / 福运金龙**。机台接口默认使用本机 8080；`slots_service/configs/server.test.json` 包含 AG8 数学快照和 5190 的跨域配置。联调大厅钱包时继续使用原有的大厅服务模式、关闭 testProfile，在机台服务的大厅 gameIds 中包含 AG8。单独启用 testProfile 时可用 `http://127.0.0.1:5190/?test=1` 验证，无需大厅票据。

Creator 预览：用 3.8.5 打开本项目，双击 `assets/FDGameScene.scene`，再点浏览器预览。直接访问预览服务器时，可在 URL 中加 `scene=e9b418d0-8299-40ac-adee-e84e8d2e0793` 选中该场景。

帧样例来自 `slots_service/testdata/ag8-client-examples.json`，覆盖普通与五倍投注、八转中奖、八转全空、两种模式封顶。服务端契约见 `slots_service/docs/client-api.md` 的 AG8 章节。

本地验收：Creator 3.8.5 Web Mobile 构建通过，编辑器预览验证了封面、窗口切换、START 与首次渲染；大厅入口、真实换票、HTML 规则／下注／自动旋转、50 分普通投注、250 分五倍投注、余额不足零下注、历史详情和真实订单回放均已在浏览器验证。用 Go 固定样例验过重试、免费八转全空、刷新接续、从上局盘面起转的公开回放，以及五倍免费第 5 转封顶到 6,250.00 元。
