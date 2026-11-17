# AG9 Fortune Leopard（幸运豹）

基于 Fortune Leopard 原版资源，按 AG4～AG8 的单场景接口接入规范接入 AG9 Go 服务端。使用 Cocos Creator 3.8.5；保留原版转轴、中奖、重转、音频和美术资源。界面文案统一使用印尼语，金额以印尼格式显示。

- 使用 `/api/v1/login`、`/games/AG9/bets`、`state`、`spin`、历史及回放接口，不使用原版 WebSocket/GameBridge，也不加载原版多场景入口。
- AG9 为 3×3、5 条线；重转由服务端逐帧返回，首帧即第一轮，后续按 `nextAction` 请求。
- 规则、下注、自动旋转、历史和回放使用 AG4 的 HTML 交互样式，回放从保存的起始盘面开始。

```sh
npm run check:frames
npm run build
python3 -m http.server 5191 --bind 127.0.0.1 --directory build/web-mobile
```
