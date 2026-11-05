# 优惠页海报

- 路由：`/offers`；底栏优惠入口。
- 7 个活动：充值赠送、游戏返水、亏损返还、代理佣金、邀请好友、每周礼金、每月礼金。
- 左侧分类筛选；海报为普通图片，不绑定点击事件、不显示品牌。
- 图片路径：`public/assets/lobby/offers/{活动id}-{zh-tw|en}.webp`，每张 960×320，3:1，WebP quality 86。原始图保留在生成工具输出目录。
- 用 `width/height` 和 `aspect-ratio` 预留空间，首屏图片优先加载，后续 lazy loading。
- 随大厅中英文切换图片，alt 文案在多语言 JSON 中维护。
- 海报只介绍活动，不写固定奖励数字，避免与后续服务端配置修改不一致。

## 生成方式与提示词

使用内置 imagegen，每张海报单独生成。共用提示：

> ONE finished mobile casino promotional banner, 3:1 wide landscape intended 960x320. No brand/logo/URL. Premium polished 3D mobile game advertising; rich cyan teal glossy rounded beveled panel with luminous rim, pale neutral surround. Consistent luxurious cheerful campaign style. Large immaculate Chinese/English typography LEFT 65%, thematic illustration RIGHT 30%. Safe margins 4%, no cropping of words. Exact supplied text only. White bold readable headline with gold accents. Single finished banner, no mockup, no UI, no extra text.

| ID | 繁體中文標題 / 副标题 / 小字 | English title / subtitle / supporting line | 插画 |
| --- | --- | --- | --- |
| deposit | 充值赠送 / 充值享好礼 / 多档充值 · 奖励随行 | Deposit bonuses / More with every deposit / Flexible amounts · Extra rewards | 蓝色钱包和金币 |
| rebate | 游戏返水 / 每一份投注 都有回馈 / 日 · 周 · 月 多重返水 | Betting rebates / More play. More rewards. / Daily · Weekly · Monthly | 蓝宝石筹码和金币 |
| loss | 亏损返还 / 昨日亏损 今日回馈 / 给下一次出发 多一份支持 | Loss return / A little back for your next play / Yesterday’s losses · Today’s return | 金色盾牌和金币 |
| agent | 代理佣金 / 携手推广 共享收益 / 专属代理 · 佣金奖励 | Agent commissions / Grow together. Earn together. / Build your team · Earn commissions | 金狮吉祥物 |
| invite | 邀请好友 / 邀好友同行 领专属好礼 / 分享邀请 · 好友达标享奖励 | Invite friends / Good company. Great rewards. / Invite friends · Earn when they qualify | 狐狸吉祥物和宝箱 |
| weekly | 每周礼金 / 每周一份 专属心意 / VIP 权益 · 每周相伴 | Weekly VIP gifts / Your weekly reward awaits / VIP privileges · Every week | 紫金花冠日历 |
| monthly | 每月礼金 / 每月好礼 为你而来 / VIP 权益 · 每月回馈 | Monthly VIP gifts / A new month. A new reward. / VIP privileges · Every month | 月亮日历和礼盒 |
