# Fortune Tiger（AG4）

Cocos Creator 3.8.5。浏览器与编辑器均以 `assets/FTGameScene.scene` 为入口。开发构建：

```sh
npm run build
npm run serve
```

大厅签发进入凭据后打开本地 AG4（默认端口 5184）；机台 API 默认使用本地 8080。需指定其它本地机台 API 时，在进入地址加 `api` 参数。

原版回包进入 `FTGameLayerCtrl.onMessageOpenAward`。重转目标、各轮盘面及中奖线交给原版控制器，由它播放老虎、红包、转轴和结算动画。Go 盘面由 `FTResultAdapter` 转成相同结构；Go 在第一步生成并保存完整结果，AG4 的 presentation 接口只读这份结果，后续每轮仍用原有 spin 接口推进结算。回放读取历史盘面并使用同一套动画，前一局盘面有记录时从该盘面开转。

`tools/local-validation/original-flow.cjs` 可用 Playwright 对保留的原版离线构建验证二进制回包；也接受 Go 回放接口响应 JSON，验证转轴轮数、最终盘面及中奖线。设置 `AG4_ORIGINAL_URL` 指向本机的原版离线构建，依赖 TypeScript、Playwright 和 Chrome。
