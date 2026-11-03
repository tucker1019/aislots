# 客户端联调协议（测试环境）

服务端 `http://127.0.0.1:8080`，客户端 `http://127.0.0.1:5180`。仅在 `testProfile.enabled=true` 启用；真实平台钱包尚未接入。统一成功响应 `{ "code":"OK", "data":... }`，失败为 HTTP 错误状态和 `{ "code":"...", "message":"..." }`。金额为整数分的十进制字符串。登录后携带 `Authorization: Bearer <accessToken>`。

## 登录

`POST /api/v1/login`

```json
{"test":true,"appname":"test-platform","appkey":"test-app","uid":"test-user","gameId":"AG1"}
```

仅接受配置的测试身份。返回 accessToken、expiresAt、player、balance。第一次初始化500000分，此后登录、刷新、服务端和数据库重启均不重置余额。数据库只保存令牌哈希。

## 投注列表

`GET /api/v1/games/AG1/bets`

返回 gameId、country、currency、amountScale、betOptions、defaultBet。当前来自 `configs/bets.test.json`，档位100/200/500/1000/2000，默认200。

## 进入游戏或重新连接

`GET /api/v1/games/AG1/state`

```json
{"requestId":"服务端签发的下一请求标识","balance":"499910","hasNext":true,"betAmount":"200"}
```

不扣款、不派奖。存在历史结果时返回 `lastFrame`，包括最后已结算盘面、逐轮赢分和本局累计 `totalWinAmount`。客户端直接静态显示，不重新转轴；如果有中奖，补播消除后再使用顶层 `requestId` 请求下一轮。`hasNext=true` 表示还有未结算的消除/免费轮；`hasNext=false` 时保留最终盘面和累计赢分，等待玩家发起新的付费旋转。服务端保留的旧未使用凭据不算已付费流程，不会导致重连自动扣款。

## 统一开奖

`POST /api/v1/games/AG1/spin`

```json
{"requestId":"从state或上一响应获得的标识","betAmount":"200"}
```

服务端根据已保存进度选择下一轮：没有进行中的投注时，校验档位、扣一次投注并结算第一轮；有进行中的投注时，结算下一轮消除或免费，不重复扣投注。继续轮沿用原投注金额，客户端不能修改金额。投注结果、逐轮派奖、进度、响应回执及下次请求标识在同一个数据库事务提交。

响应示意（board/wins的内容仅为结构示例）：

```json
{
 "requestId":"本次请求标识",
 "nextRequestId":"服务端签发的下次请求标识",
 "betId":"本次投注ID",
 "spinIndex":0,
 "stepIndex":1,
 "mode":"base",
 "status":"ready",
 "nextAction":"continue",
 "previewRows":1,
 "board":[[{"id":21,"symbolId":2},{"id":1,"symbolId":3},{"id":2,"symbolId":4},{"id":3,"symbolId":5},{"id":4,"symbolId":6}]],
 "wins":[],
 "removedIds":[],
 "transformedIds":[],
 "winAmount":"10",
 "totalWinAmount":"10",
 "betAmount":"200",
 "balance":"499810",
 "freeRemaining":0,
 "triggeredFree":false
}
```

实际AG1盘面为5列，每列5格，列内从上到下。第0格为顶部半格预览，不参与当前中奖、消除和免费计数；第1～4格有效。预览进入有效区时保持图标和格子ID；新预览由服务端提供。骨架与数值配置仍为5×4。更旧的缓存盘面没有 `previewRows` 时按旧结构展示。

`nextAction` 为 `continue`、`start_free` 或 `complete`。前两者仍调用相同 spin 接口，不上传 betId、spinIndex、stepIndex，也没有动画完成确认。索引仅用于展示；内部下一轮游标不返回客户端。末尾保留无奖最终盘面轮，中奖金额为0。一个betId覆盖付费旋转和它触发的所有免费旋转。

当前轮在响应前已经扣款/派奖并推进服务端进度，无论客户端动画是否播完。断线重进通过state恢复最后已结算盘面、余额及本局累计赢分；补播动画不重复派奖，再用最新请求标识继续下一未结算轮。已经整笔完成时，重进不会自动再扣下一笔投注。

## 超时和重复请求

同一次请求超时，仍使用原requestId和原betAmount重试，返回完全相同的原响应，不重新开奖、扣款、派奖或推进下一轮。请求标识绑定完整会话身份及游戏；伪造/过时但无回执的标识、修改原请求金额均拒绝。成功响应带回的nextRequestId用于下一次请求。

当前客户端在同一页面内保留失败请求供重试；刷新后丢弃旧页面请求状态，重新通过state继续下一轮。不会把已结算轮保存在浏览器等待确认。服务端请求回执保存在PostgreSQL，重启仍可幂等重试。

旧的 `/bet/prepare`、`/bet`、`/bet/continue` HTTP 路由已经移除。内部旧方法保留用于既有进度兼容和底层回归测试，不是客户端协议。

## 启动与数据

```sh
cd slots_service
docker compose up -d
export AISLOTS_DATABASE_URL='postgres://aislots:aislots-local-only@127.0.0.1:55432/aislots?sslmode=disable'
go run ./cmd/slots-server -config configs/server.test.json
```

`server.test.json` 使用 `testdata/deployments/2026-10-23T09-46/AG1` 配置快照，普通库 `2026-10-23T09-46-00-110Z-7555d806`、免费库 `2026-10-23T09-45-17-045Z-b8fedfe4`。保留旧联调引擎以完成旧投注；新付费投注使用当前版本，余额和累计状态保留。数据库迁移按编号追加执行，不重建已有数据。

### 展示倍率

新生成旋转返回 `cascadeFactors`（当前普通或免费模式的加成字符串数组）和 `cascadeIndex`（当前轮高亮档位，0起始且到最后一档封顶）。它们随完整结果保存，来自该投注固定版本的配置；客户端只展示，不自行推导免费倍率。较早已保存的旋转可能缺少此数组。


## 整局下注记录

`GET /api/v1/games/AG1/bet-records?limit=20&cursor=<上一页nextCursor>&from=<RFC3339>&to=<RFC3339>`

必须携带登录 Bearer token；只查询当前身份的 appname / appkey / uid、当前游戏、国家和币种，不能在参数中指定其他用户。与 `/bets` 的投注档位列表不同，本接口查询已实际下注的历史。

一条记录 = 一次付费下注 + 普通连续消除 + 本次触发及追加的所有免费旋转和消除。免费不重复累计投注，`totalWinAmount` 为已经逐轮结算的总赢分，不包含未来中奖。准备中但未下注的凭据不出现在历史。

```json
{
  "code": "OK",
  "data": {
    "amountScale": 0,
    "summary": {"recordCount": 1, "betAmount": "200", "totalWinAmount": "1050", "profitAmount": "850"},
    "items": [
      {
        "betId": "BET_ID",
        "gameId": "AG1",
        "betAmount": "200",
        "totalWinAmount": "1050",
        "profitAmount": "850",
        "winningRoundCount": 2,
        "totalRoundCount": 3,
        "status": "complete",
        "country": "ID",
        "currency": "IDR",
        "createdAt": "2026-10-30T03:00:00Z",
        "updatedAt": "2026-10-30T03:02:00Z"
      }
    ],
    "nextCursor": "OPAQUE_CURSOR"
  }
}
```

- `from` / `to`：同时提供或同时省略，左闭右开，最长7天。前端按 GMT+8 将所选结束日期转换为次日零点；分页时保留相同日期条件。
- `summary`：整个筛选范围的记录数、投注、总赢分和净盈亏，不受当前分页条数限制。
- `amountScale`：金额的小数位数；例如2表示100分展示为1.00。
- `winningRoundCount`：有中奖组合的消除轮数；`totalRoundCount`：全部已结算盘面轮数，包含末尾无奖盘面。
- `profitAmount`：整局净盈亏，即总赢分减一次付费投注。
- `status`：`active` 进行中、`complete` 整局结束。进行中的金额会随后续结算增加。
- `betAmount`：该局实际付费投注金额，只计一次。
- `totalWinAmount`：普通及整个免费链已经结算的累计总赢分，不减去投注额。
- 金额为整数分字符串，时间为 RFC3339 格式。
- 按 `createdAt DESC, betId DESC` 排序。默认20条，上限100条；`nextCursor` 不存在时已到末页。空结果 `items=[]`。

## 整局回放数据

`GET /api/v1/games/AG1/bet-records/{betId}/replay?limit=100&cursor=<上一页nextCursor>`

响应 `data`：

| 字段 | 含义 |
| --- | --- |
| `bet` | 与列表相同的整局摘要 |
| `frames` | 当前页已结算盘面，按 `spinIndex ASC, stepIndex ASC` 排序 |
| `nextCursor` | 后续帧游标，没有该字段表示本次已到末尾 |

每个 `frames` 元素包含开奖展示字段 `betId`、`mode`、`spinIndex`、`stepIndex`、`board`、`previewRows`、`wins`、`removedIds`、`transformedIds`、`cascadeFactors`、`cascadeIndex`、`winAmount`、`spinWinAmount`、`totalWinAmount`、`balance`、`betAmount`、`freeRemaining`、`triggeredFree`、`nextAction`，以及这一轮的 `settledAt`。详情另返回 `amountScale`；逐轮增加 `chargeAmount`（仅整局第一轮扣款）、`profitAmount`（当轮赢分减扣款）、`lineCount`、`payoutUnit`（分为单位的精确整数或分数），以及 `payouts` 逐中奖项的符号、连列数、ways、符号赔率、消除倍率和已取整金额。逐项金额沿用实际结算的累计取整口径；旧记录缺失计算信息时允许不显示公式，不能伪造明细。其中 `balance` 为当轮历史余额，不是当前钱包余额；`bet` 摘要为当前已结算进度。

- 回放只读取 `spin_steps` 中已经提交的结果，不重新开奖、不扣款、不派奖、不消耗下一请求标识。
- 不返回 `requestId`、`nextRequestId` 或内部 `next` 游标。回放分页游标仅供读取下一页，不能用于下注。
- 普通局和免费局均在同一 betId 内，免费不会产生新的列表记录。
- 默认100帧，上限200帧，长免费链分页读取。相同请求在进行中可能看到新结算的内容；每一页摘要与帧来自同一个数据库只读快照。
- 不存在、未实际下注、其他用户/国家/币种的记录一律返回404；未登录返回401。非法limit、非法游标或把其他betId的回放游标混用时返回400。

```sh
curl -H 'Authorization: Bearer <accessToken>' \
  'http://127.0.0.1:8080/api/v1/games/AG1/bet-records?limit=20'

curl -H 'Authorization: Bearer <accessToken>' \
  'http://127.0.0.1:8080/api/v1/games/AG1/bet-records/<betId>/replay?limit=100'
```

## 分享回放

`POST /api/v1/games/AG1/bet-records/{betId}/share`：需要当前登录 Bearer token，验证该交易属于当前用户。返回 `data: { betId, shareToken }`，分享凭据持久化保存，服务重启后继续可用。

`GET /api/v1/games/AG1/shared-replays/{betId}?share=<shareToken>&limit=100&cursor=...`：无需登录，只能读取凭据绑定的游戏和交易，分页结构与本人 replay 相同。无效凭据或不匹配的交易统一返回404。不会读取未来未结算盘面，不修改钱包、状态或下一下注标识；响应不包含登录身份、请求标识与内部推进信息。`balance` 固定为占位0，分享客户端必须隐藏余额，不能作为真实钱包余额展示。

客户端分享链接使用本站游戏路径：`?replay=<betId>&share=<shareToken>`。链接不能携带 appname/appkey/uid 或登录token；分享凭据不能用于登录或下注。公开页面仅运行回放，不调用 login、bets、state、spin。生产默认同源 `/api/v1`，开发环境继续连接本机8080。

## 请求追踪

所有响应头返回 `X-Trace-Id`，包括健康检查、业务错误、404、跨域预检和来源拒绝。编号由服务端为每次HTTP请求独立生成，为32位十六进制字符串；请求完成日志和服务端错误日志的 `traceId` 与响应头一致。可使用它关联日志，日志不记录含身份凭据的查询串。

响应包含 `Access-Control-Expose-Headers: X-Trace-Id`，在已允许的跨域来源上可通过 `response.headers.get('X-Trace-Id')` 读取。业务幂等仍使用requestId，Trace ID不替代requestId。

## 大厅真实用户

使用 `configs/server.lobby.json` 启用大厅钱包；该模式拒绝固定测试登录和旧测试会话。`POST /api/v1/login` 新增 `launchTicket`、`exchangeId`、`gameId` 的登录方式，不传大厅sid。兑换重试使用同一exchangeId，成功后保存游戏accessToken并移除URL票据。state/spin协议和逐轮结算行为保持不变；真实会话过期返回大厅重新进入，不自动切换测试用户。接入、内部资金协议及恢复机制见 `lobby_service/docs/game-integration.md`。
