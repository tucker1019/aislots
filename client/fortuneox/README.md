# AG7 金牛（Fortune Ox）

Cocos Creator 3.8.5，主场景 `assets/FOXGameScene.scene`。Web Mobile 和编辑器预览使用同一场景，资源预加载完点 START 进入游戏。

```sh
npm run check:frames
npm run build
python3 -m http.server 5189 --bind 127.0.0.1 --directory build/web-mobile
```

本地大厅从 `http://127.0.0.1:5175/` 进入金牛。机台使用 `slots_service/configs/server.lobby.json`（如已有本地配置，把 AG7 挂载和 5189 CORS 补入现有清单）。已有大厅数据库可用 `import-game-catalog -apply -hide-fortune-ox-placeholder` 导入 AG7 并隐藏旧占位 G1023。仅使用测试钱包时，须启用 Go 测试配置，再以 `?test=1` 打开客户端；API 可由本地 `api` 查询参数指定。

- 盘面按列从上到下为 3／4／3。旧动画下标按行从下到上，映射为 `[7,4,1,11,8,5,2,9,6,3]`，旧下标 10 不属于可见盘面。历史与回放也使用这十个格子。
- 特殊模式每轮三列都转，左右六格只在当前盘面同图；按服务端 `nextAction` 请求下一轮，整局只扣一次，末轮派奖。无结果时 STOP 只记操作意图，续转或重试沿用原请求号。
- 中奖线、金额、满盘十倍和全百搭大奖由服务端下发。刷新恢复最后一帧与下一请求号；分享回放按历史帧播放，不走下注接口。
- 旧平台 WebSocket、GameBridge、协议文件和已替换的弹窗及其专用图已清理。下注、自动旋转和玩法走 HTML；原版中奖线、大奖、音频及位图数字保留。游戏层在预加载完成并点击 START 后启用。

数值与倍率见 [AG7 规则](../../slot_math/docs/ag7-rules.md)，帧验证来自 [Go 接口样例](../../slots_service/testdata/ag7-client-examples.json)。

本地已验收：大厅票据登录、真实 Go 普通下注及十格历史详情；用 Go 固定样例覆盖重试期间点棋盘、逐轮重转、刷新继续、满盘十倍、纯百搭大奖及点击跳过、共享回放。PostgreSQL 测试验证重启和重复请求不会重复扣款或派奖。
