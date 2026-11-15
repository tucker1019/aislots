# Fortune Tiger（AG4）

本项目是 [Cocos 机台迁移规范](../README.md) 的参考实现。

Cocos Creator 3.8.5。浏览器与编辑器均以 `assets/FTGameScene.scene` 为入口。开发构建：

```sh
npm run build
npm run serve
```

大厅签发进入凭据后打开本地 AG4（默认端口 5184）；机台 API 默认使用本地 8080。需指定其它本地机台 API 时，在进入地址加 `api` 参数。

Go 盘面由 `FTResultAdapter` 转成原版控制器使用的结构，由原版控制器播放老虎、红包、转轴和结算动画。触发重转时，第一次 `spin` 返回第一轮真实重转盘面；后续每轮先启动转轴，再用 `nextRequestId` 请求 `spin`，收到这一轮的盘面后才停轴。刷新通过 `state` 返回的最近一轮盘面和请求 ID 继续。回放读取历史盘面并使用同一套动画，前一局盘面有记录时从该盘面开转。

进场从 `state.lastFrame` 恢复上一局盘面。已结算时一起恢复底栏 WIN 和中奖连线；未完成时从最近已保存的盘面续转。回放按历史帧播放，余额显示 `******`。

| 改造点 | 本项目位置或行为 |
| --- | --- |
| 单场景与加载 | [FTGameScene](assets/FTGameScene.scene)、[FTGame](assets/fortunetiger/src/game/view/scenes/FTGame.ts)；[Web Mobile 模板](build-templates/web-mobile/)和[编辑器预览模板](preview-template/)同步维护 AG 动画、封面、进度与 START。 |
| 会话与数据适配 | [launch_session](assets/fortunetiger/src/game/net/launch_session.ts) 管理票据和游戏会话；[FTGoSession](assets/fortunetiger/src/game/net/FTGoSession.ts) 请求 Go 接口；[FTResultAdapter](assets/fortunetiger/src/game/net/FTResultAdapter.ts) 把盘面和中奖线交给原版演出控制器。AG4 是 3×3、5 条线、无额外预览行。 |
| 界面与回放 | [HTML 界面](assets/fortunetiger/src/game/ui/)和[投注记录及回放](assets/fortunetiger/src/game/history/)；底栏菜单保留，旧弹窗预制体及其独占资源移除。 |
| 旧项目清理 | 删除 `h5main.scene`、原 `game.scene`、旧平台 GameBridge、WebSocket 和原协议代码，以及旧平台字体引用；大厅退出与历史回放仍走当前通信协议。 |
