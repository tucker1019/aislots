# AG6 Fortune Mouse（金鼠）

项目使用 Cocos Creator 3.8.5。打开本目录，预览 `assets/FMGameScene.scene`。Web Mobile 只构建这一个场景；原版转轴、角色、音效和中奖演出随项目保留，动态资源走 Creator 内置的 `resources`。

```sh
node client/fortunemouse/scripts/build.mjs
node --experimental-strip-types client/fortunemouse/scripts/check-frames.mjs
```

构建产物位于 `client/fortunemouse/build/web-mobile`。本地大厅入口为 Fortune Mouse（AG6），静态资源使用 5187，机台接口使用 8080。单独联调时，可从环回地址访问 `/?test=1&api=http://127.0.0.1:<port>`，机台服务需要开启同一测试账号的 test profile，并允许客户端 Origin。普通入口从大厅取得票据。

- 开场沿用 AG5 的开场动画、封面进度和 START。点击后显示铺满的 launch，再显示已恢复或默认盘面。
- 一笔投注仅扣一次。AG6 普通转一帧结束；特殊第一帧进入时播放原版金鼠和三个 Wild 的触发动画，此后锁定中轴，左右轴开始转动后才请求下一帧。只播放服务端交付的当前盘面，最终中奖帧才显示整笔派奖。
- 适配层把服务端按列从上到下的格子转为原版按行从下到上的格子。线号和赔付表对照 AG6 发布快照；界面使用服务端实付金额。全盘 Wild 按一个奖展示，不当成五条线重复派奖。普通原始倍率 1000 与全盘 Wild 的总投注 1000 倍是两种结果。
- 刷新展示上一张盘面、赢分和中线；进行中的重转从下一帧继续。回放从上一局保存的盘面转到本局，隐藏余额，按已保存的帧播放。
- 投注、自动转、规则、历史、回放和提示沿用 AG4/AG5 的 HTML 交互方式。规则正文使用提供的印尼语文本。金额以分传输、元显示。

机台协议见 [AG6 接口](../../slots_service/docs/client-api.md#ag6-本地接口)，数值和盘面发布见 [AG6 Go 模块](../../slots_service/internal/games/ag6/README.md)。
