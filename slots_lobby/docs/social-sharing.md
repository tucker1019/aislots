# 大厅分享

游戏详情、订单回放、邀请与代理入口共用 `components/share/ShareSheet.tsx`。代理中心另有直接社交入口。复制按钮仍复制原链接；分享按钮打开吸底弹窗。回放先申请服务端签发的公开回放链接，不分享登录票据。

默认文案集中在三份语言文件的 `share.gameTitle/gameText`、`share.inviteTitle/inviteText`、`share.replayTitle/replayText`，`{name}` 为游戏名。目前为本地默认配置，未新增后台配置接口。

`services/social-share.ts` 维护平台分享链接和编码，使用普通 HTTPS 链接在用户点击时打开新标签。移动端是否唤起安装的 App 由平台和浏览器决定；未安装时进入网页。Facebook、LinkedIn 等平台可能忽略预填文案，展示链接自身的元数据；不承诺预填标题被所有平台采用。Skype 已停服，未提供入口。无需额外 SDK 或应用密钥。

外部平台需要真实可访问的网址。本地 127.0.0.1 链接只用于开发验证，外部收件人无法访问。分享不会自动发送，仍由用户在对应平台确认。
