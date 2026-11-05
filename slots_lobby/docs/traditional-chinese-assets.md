# 繁體中文與圖片

大廳僅提供 `zh-TW`、`en-US`。舊 `zh-CN` 偏好自動遷移至 `zh-TW`；英文偏好保留。翻譯 key 仍使用英文語義，Ant Design 使用 zh_TW。

2026-11-05 使用內建 imagegen 編輯原有圖片，逐張核對繁體字後，以 Sharp 去除生成留白、縮放並輸出 WebP。保留英文資源，移除原簡體圖片，避免頁面誤用。

## 最終檔案

`public/assets/lobby/promotions/`：1080×200、WebP quality 84，約34–39KB。

- `referral-200-zh-tw-v1.webp`：推薦一人 獎勵200
- `deposit-bonus-5-zh-tw-v1.webp`：錢包百億補貼 全網最高 筆筆贈5%
- `cashback-1-zh-tw-v1.webp`：投注無需遞增 直接返水1%

推薦圖原人物編輯被圖像工具審核拒絕；繁體版右側改為禮盒與金幣，英文版保留原圖。

`public/assets/lobby/offers/{id}-zh-tw.webp`：960×320、WebP quality 86，約63–78KB。

| id | 主標題 | 副標題 | 小字 |
| --- | --- | --- | --- |
| deposit | 充值贈送 | 充值享好禮 | 多檔充值 · 獎勵隨行 |
| rebate | 遊戲返水 | 每一份投注 都有回饋 | 日 · 週 · 月 多重返水 |
| loss | 虧損返還 | 昨日虧損 今日回饋 | 給下一次出發 多一份支持 |
| agent | 代理佣金 | 攜手推廣 共享收益 | 專屬代理 · 佣金獎勵 |
| invite | 邀請好友 | 邀好友同行 領專屬好禮 | 分享邀請 · 好友達標享獎勵 |
| weekly | 每週禮金 | 每週一份 專屬心意 | VIP 權益 · 每週相伴 |
| monthly | 每月禮金 | 每月好禮 為你而來 | VIP 權益 · 每月回饋 |

## 提示詞

每張原圖各自作為 edit target：保留原有構圖、比例、背景、插畫、色彩、字級與安全邊距；僅將所有中文替換成上表的精確繁體文字，不新增數字、品牌、網址或宣傳承諾。輪播圖保留200、5%、1%。推薦圖額外要求「Remove both people, replace with a gold gift box and coins, no people」。

英文圖片不修改。圖片不包含實作說明或測試標記。
