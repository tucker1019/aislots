# 客户端联调协议（测试环境）

服务端 `http://127.0.0.1:8080`，客户端 `http://127.0.0.1:5180`。仅在 `testProfile.enabled=true` 启用；真实平台钱包尚未接入。统一成功响应 `{ "code":"OK", "data":... }`，失败为 HTTP 错误状态和 `{ "code":"...", "message":"..." }`。金额为整数分的十进制字符串。登录后携带 `Authorization: Bearer <accessToken>`。

## 游戏模块兼容说明

AG1～AG3 服务端已通过各自游戏模块提供展示与逐帧派奖计划，现有 HTTP 字段、金额单位、nextAction、预览行及 bottomSymbols 保持原样。新的运行状态/结果封套只用于内部存储，不透传给现有客户端。旧存档与新存档可继续恢复、回放和分享；回放仍只返回已结算的帧。AG4 已接入本地测试配置，同样使用这些路由；专属字段见下方说明。

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
{"requestId":"从state或上一响应获得的标识","bet":"10","betLevel":1}
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

## AG4 本地接口

以 `gameId: "AG4"` 登录，将上述路由中的 AG1 换成 AG4。投注输入为 `bet`（基础投注的整数分字符串）与 `betLevel`（整数等级），总投注 = bet × betLevel × lineCount。AG4 当前 lineCount=5、amountScale=2。例如：

```http
POST /api/v1/games/AG4/spin
Authorization: Bearer <accessToken>
Content-Type: application/json

{"requestId":"从state取得的标识","bet":"10","betLevel":1}
```

此例总投注50分，展示为0.50；基础投注和等级从 bets 接口取得，继续帧沿用原值。

- `mode` 为 `base` 或 `respin`。`board` 按列从左到右、列内从上到下，共3×3，格子 ID 为1～9。符号0为空位，1～6为普通符号，7为Wild，无 Ways 预览行或底部装饰。
- 新订单首帧就是第一轮实际重转结果；后续锁定目标符号并新增，无新增或填满结束。首轮无新增也可直接以空盘结束。旧订单保留原先的起始空帧，可继续恢复与回放。`nextAction=continue` 时继续 spin，最终为 `complete`，不进入 `start_free`。
- 第一帧只扣一次；中间帧 winAmount=0，最终帧一次派奖。奖金 = 总投注 × 原始每线倍率合计 ÷ 5，九格同符号再乘10，最终取整一次。
- 可选 `gameData` 包含 `targetSymbolId`（普通为空）、`lockedCellIds`、`addedCellIds`（均为1～9格子ID）、`bonusMultiplier`、`lineWins` 及 `replay: {payoutUnit, lineCount}`。最终帧返回中奖线和全屏倍数；中间帧不预告奖金。
- state、历史、排行榜及公开分享保留已结算展示；重启和重复请求不重新抽样或补盘，不返回未来帧。内部状态/结果封套不透传。

本地启动使用 `configs/server.test.json`；`server.lobby.json` 也已注册 AG4 快照 `testdata/deployments/2026-11-13-ag4-modules/AG4`。客户端见 [AG4 项目说明](../../client/fortunetiger/README.md)。

## AG5 本地接口

AG5 沿用公共的 `launchTicket → POST /api/v1/login` 换票流程，以及 `/api/v1/games/AG5/bets`、`state`、`spin`、`bet-records`、本人回放和公开分享回放。登录传 `gameId: "AG5"`；继续使用服务端签发的 `requestId`、`nextRequestId`。投注仍是 `{"requestId":"…","bet":"10","betLevel":1}`，十条线时总投注100分，`amountScale=2`。基础投注和可选等级以 bets 返回为准。

大厅模式登录请求使用 `{"launchTicket":"启动链接带入的票据","exchangeId":"本次换票固定的唯一标识","gameId":"AG5"}`；丢失响应时沿用相同 exchangeId 重试。`configs/server.test.json` 的本地独立测试使用上面的 `test:true` 登录格式。大厅模式需在对应运行配置注册 AG5 发布快照和游戏白名单，公共路由及资金协议保持一致。

AG5 当前实玩响应的金额字段为整数分 JSON 数字；请求的 `bet`、bets 档位、回放 `payouts[].amount` 仍为十进制字符串。`gameData.replay.payoutUnit` 为精确整数或分数字符串。客户端不要将原始倍率当作金额。

| 字段 | AG5 含义 |
| --- | --- |
| `mode` | 普通转为 `base`，特殊转为 `free` |
| `nextAction` | 还有特殊转时 `continue`；本局结束或达到封顶时 `complete` |
| `board` | 从左到右三列，列高3、4、3；列内从上到下。格子ID依次为1～3、4～7、8～10 |
| `wins` | 本转中奖项；线奖 `columns=3, ways=1`，奖励面值逐格列出、`columns=1, ways=1`。`cellIds` 使用格子ID；`rawPayout` 为未封顶的原始倍率字符串 |
| `winAmount`、`spinWinAmount` | 本转实际已入账金额，两者一致；中奖的特殊转立即派奖 |
| `totalWinAmount` | 同一 betId 内普通转与已结算特殊转的累计实付；不包含未来转 |
| `triggeredFree`、`awardedFreeSpins` | 只在触发的普通转返回 true 和8；其他转为 false，次数字段可能省略或为0 |
| `freeRemaining` | 本转结算后剩余特殊转数；达到封顶后为0 |
| `gameData.ruleType` | 固定 `fortune_rabbit_v1` |
| `gameData.specialIndex` | 普通转为0，特殊转为1～8 |
| `gameData.specialTotal` | 本局触发时为8，否则为0；提前封顶仍记录原定8次 |
| `gameData.specialRemaining` | 与 `freeRemaining` 一致；封顶时取消未完成次数 |
| `gameData.rewardCount`、`rewards` | 当前盘面奖励数量和逐格 `{cellId,symbolId,payout}`；`payout` 是该奖励的原始面值 |
| `gameData.lineWins` | 当前转中奖线，含 `{line,symbolId,payout,cellIds}`；线号从1开始。特殊转为空数组 |
| `gameData.rawPayout`、`paidRawPayout` | 当前转应付原始倍率、封顶后可付原始倍率；除10得到总投注倍率 |
| `gameData.dueAmount`、`paidAmount`、`truncatedAmount` | 当前转应付、实付、封顶扣减，单位分；`dueAmount=paidAmount+truncatedAmount`，`paidAmount=winAmount` |
| `gameData.capped` | 本转后本局累计达到总投注5000倍；此时立即 complete |
| `gameData.replay` | `{payoutUnit,lineCount:10,payouts}`。每项 `{symbolId,columns,ways,rawPayout,amount}` 与 `wins` 同序，amount 是实付分的字符串，合计等于本转 winAmount |

符号0表示空白，仅特殊转可出现；1胡萝卜、2烟花、3铜钱、4红包、5福袋、6金兔、7百搭。奖励符号11～19的原始面值依次为5、10、20、50、100、200、500、1000、2000，对应总投注0.5、1、2、5、10、20、50、100、200倍。普通图标原始三连赔付为2、3、5、10、50、100，百搭三连200；每条线取可成立的最高奖，十条线相加。没有全屏额外倍数。

十条线固定为 `[1,4,8] [1,5,8] [1,5,9] [2,5,8] [2,5,9] [2,6,9] [2,6,10] [3,6,9] [3,6,10] [3,7,10]`。同一转至少五个奖励时，支付本转所有奖励面值之和；每转清空，奖励不保留、不累计。普通转可同时支付线奖和奖励奖；先支付普通奖，再进入独立触发的八次特殊转。特殊转中奖后继续剩余次数，只有5000倍封顶可提前结束。普通/特殊没有消除、补落或锁格，`removedIds`、`transformedIds` 均为空，无顶部预览和底部装饰。

一次付费流程内公共 `spinIndex=0`、`stepIndex=1～9`；客户端依据 `gameData.specialIndex` 判断特殊转序号。每次只返回当前已结算的一转。首帧扣一次总投注；后续帧沿用原 bet/betLevel，只派奖。最后一转可以中奖，没有额外无奖结束帧。即使 complete 返回新的 nextRequestId，也只在玩家发起下一笔付费旋转时使用。

以下是以总投注100分为例的响应关键字段；所有行均来自一个 betId，金额为分。完整盘面与 `gameData` 响应样例见 [AG5 联调样例](../testdata/ag5-client-examples.json)，样例由服务端验奖和结算代码生成、测试复核。样例使用独立测试倍率表固定结果来覆盖这些流程，不代表当前数值表的倍率分布或开奖概率。

| 场景 | stepIndex / specialIndex | mode | winAmount | totalWinAmount | freeRemaining | nextAction |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 普通转中奖并触发 | 1 / 0 | base | 1000 | 1000 | 8 | continue |
| 第一次特殊转空奖 | 2 / 1 | free | 0 | 1000 | 7 | continue |
| 第二次特殊转中奖 | 3 / 2 | free | 250 | 1250 | 6 | continue |
| 第八次特殊转空奖、结束 | 9 / 8 | free | 0 | 1250 | 0 | complete |

独立封顶样例：普通转支付2000倍，特殊第1转支付2000倍，第2转支付700倍，本局累计4700倍；第3转应付1000倍、仅支付300倍，达到5000倍结束。在100分总投注下，最后一转 `rawPayout=10000, paidRawPayout=3000, dueAmount=100000, paidAmount=30000, truncatedAmount=70000, winAmount=30000, totalWinAmount=500000, capped=true, freeRemaining=0, nextAction="complete"`。逐项明细保留原始面值，实付 amount 合计30000分。

`state.lastFrame` 恢复最后已交付盘面，`hasNext` 表示是否仍有未结算特殊转；刷新后使用顶层 requestId。重试用原 requestId，返回同一帧与余额；不重抽图标、不重复扣款或派奖。私人、排行榜与公开回放只读已经结算保存的帧，保留同一 `gameData`、盘面、中奖项和实付明细；公开回放隐藏账户余额。封顶回放按保存的 `replay.payouts` 展示实付，不用未封顶原始倍率反算奖金。

本地注册使用 `configs/server.test.json`，绑定不可变快照 `testdata/deployments/2026-11-15-ag5/AG5`。此配置仅用于本地联调。

## AG6 本地接口

AG6复用登录换票和 `/api/v1/games/AG6/bets`、`state`、`spin`、历史、本人回放及公开分享回放，登录传 `gameId:"AG6"`。请求格式仍为 `{"requestId":"…","bet":"10","betLevel":1}`。五条线时总投注为50分；`amountScale=2`，基础投注和等级上限以bets返回为准。大厅换票仍使用原有launchTicket和固定exchangeId，不新增接口。

一次付费选择普通或特殊模式，两者互斥。普通一帧完成；特殊先交付2～8个无奖盘面，再交付一个中奖盘面并结束。只扣一次投注，特殊仅最后一帧派奖。后续spin沿用原bet和betLevel，使用最新nextRequestId；客户端不自行重摇左右列，不改变中列百搭。

| 字段 | AG6含义 |
| --- | --- |
| `mode` | 普通为`base`，特殊为`respin` |
| `board` | 三列三行，按列从左到右、每列从上到下；格子ID为1～9 |
| `wins` | 当前帧奖项；特殊前段为空。每条线只取最高奖；全盘百搭只有一项原始5000的替代大奖 |
| `winAmount`、`spinWinAmount` | 当前帧实际入账，特殊前段为0，最后一帧一次派奖 |
| `nextAction` | 中间帧`continue`，最后帧`complete` |
| `freeRemaining`、`triggeredFree`、`awardedFreeSpins` | 为0、false、0，特殊流程使用下列专用进度 |
| `gameData.ruleType` | `fortune_mouse_v1` |
| `gameData.special` | 是否特殊模式 |
| `gameData.stageIndex/stageTotal/stagesRemaining` | 当前盘面序号（从1开始）、整段盘面数、后续盘面数。普通为1、1、0 |
| `gameData.lockedCellIds` | 普通为空，特殊固定`[4,5,6]`，这三格始终是百搭7 |
| `gameData.lineWins` | 当前中奖线`{line,symbolId,payout,cellIds}`，前段空奖及全盘百搭大奖为空 |
| `gameData.rawPayout` | 当前盘面原始倍率；除5得到总投注倍率，前段空奖为0 |
| `gameData.jackpot` | 当前盘面九格均为百搭，支付总投注1000倍，替代普通线奖 |
| `gameData.replay` | `{payoutUnit,lineCount:5,payouts}`。金额单位为总投注÷5的精确分数；每项实付amount为十进制字符串，合计等于当前帧winAmount |

服务端符号编号：1花生、2橘子、3鞭炮、4钱袋、5红包、6金色鼠纹牌、7老鼠百搭。三连原始赔付分别为3、5、15、30、50、100、300。原始1000可来自非全盘百搭，必须与原始5000的全盘百搭大奖区分。总投注10元时，一条橘子线支付`5×2=10元`。

每笔投注公共spinIndex为0，stepIndex为1～盘面总数。完整盘面结果一次保存；重复请求返回同一帧及余额，不重复扣款或派奖。state.lastFrame、私人及公开回放返回已保存的同一盘面与gameData；未结算盘面不提前暴露。进行中投注固定旧版本，完成后的下一笔可使用新版本。

固定结果示例见[AG6联调样例](../testdata/ag6-client-examples.json)，包含普通空奖、橘子线奖、非全盘百搭原始1000、全盘百搭大奖，以及两种特殊过程。样例由服务端代码生成，不代表真实倍率权重。当前本地快照为`testdata/deployments/2026-11-15-ag6/AG6`，普通312/312、特殊267/267正权重档全部覆盖。

## 超时和重复请求

同一次请求超时，仍使用原 requestId、bet 和 betLevel 重试，返回完全相同的原响应，不重新开奖、扣款、派奖或推进下一轮。请求标识绑定完整会话身份及游戏；伪造/过时但无回执的标识、修改原请求金额均拒绝。成功响应带回的nextRequestId用于下一次请求。

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

AG1–AG4 的本人回放和公开回放可在第一页返回 `startBoard`：同一玩家、游戏、国家和币种上一笔已完成订单的最终盘面。首屏一并返回已有的 `startBottomSymbols` 和 `startPreviewRows`。这些字段只用于转轴启动前的显示，不属于本笔的 `frames`；没有可用上一笔盘面时省略。

客户端分享链接使用本站游戏路径：`?replay=<betId>&share=<shareToken>`。链接不能携带 appname/appkey/uid 或登录token；分享凭据不能用于登录或下注。公开页面仅运行回放，不调用 login、bets、state、spin。生产默认同源 `/api/v1`，开发环境继续连接本机8080。

## 请求追踪

所有响应头返回 `X-Trace-Id`，包括健康检查、业务错误、404、跨域预检和来源拒绝。编号由服务端为每次HTTP请求独立生成，为32位十六进制字符串；请求完成日志和服务端错误日志的 `traceId` 与响应头一致。可使用它关联日志，日志不记录含身份凭据的查询串。

响应包含 `Access-Control-Expose-Headers: X-Trace-Id`，在已允许的跨域来源上可通过 `response.headers.get('X-Trace-Id')` 读取。业务幂等仍使用requestId，Trace ID不替代requestId。

## 大厅真实用户

使用 `configs/server.lobby.json` 启用大厅钱包；该模式拒绝固定测试登录和旧测试会话。`POST /api/v1/login` 新增 `launchTicket`、`exchangeId`、`gameId` 的登录方式，不传大厅sid。兑换重试使用同一exchangeId，成功后保存游戏accessToken并移除URL票据。state/spin协议和逐轮结算行为保持不变；真实会话过期返回大厅重新进入，不自动切换测试用户。接入、内部资金协议及恢复机制见 `lobby_service/docs/game-integration.md`。

整局完成统计通过服务端outbox投递大厅：SaveTicket complete时同事务写入game_statistics_outbox，按游戏/玩家连续sequence后台重试。客户端不提交RTP和榜单结果；该通知不涉及额外钱包结算。详见大厅docs/game-statistics.md。

平台排行榜回放：`POST /internal/rank-replay` 仅接受配置的大厅服务 Bearer secret，输入大厅核验后的 `{uid,gameId,betId}`。只允许归属匹配且已完成的整局，复用原分享回放凭据；浏览器登录 token 无权调用。公开播放仍使用现有 `shared-replays`，不会登录或下注。

## 内部整局执行

`POST /internal/auto-round` 仅供持有服务凭据的大厅调用，协议见 `protos/auto_round.proto`。复用正常 spin、钱包结算与回放，每局返回完成回执及 betId；大厅使用原 requestId 重试恢复，不影响普通玩家逐轮接口。运行说明见大厅 `docs/experience-accounts.md`。

### 底部显示格子：`bottomSymbols`

AG1/AG2 每帧返回 5 个、AG3 返回 6 个服务端符号 ID，按列从左到右，对应有效盘面下方露出的格子。它不属于有效盘面，也不是顶部预览格，不参与验奖。顶部仍通过 `board` / `previewRows` 返回并参与补落。

同一 `betId + spinIndex` 的连续消除保持底部不变；新转轴旋转生成对应的一组。该字段随结算帧持久化，spin、请求重试、`state.lastFrame`、历史及公开回放透传相同值。旧帧缺少此字段时客户端继续原有随机兼容，不回填历史。`state` 没有任何历史帧时仍不伪造 `lastFrame`。

## AG7 本地接口

AG7复用既有登录、换票、bets、state、spin、历史、本人回放、公开分享和内部自动整局接口，游戏编号传AG7。spin路径为 /api/v1/games/AG7/spin，输入requestId、bet、betLevel；bet为10、等级1时十条线总投注100分，amountScale=2，档位与等级以bets返回为准。

普通和特殊二选一。普通一帧；特殊2～8个空奖盘面加最后一个中奖盘面。第一帧扣款一次，最终帧派奖一次并结束。后续请求沿用相同投注、使用最新nextRequestId。

| 字段 | AG7含义 |
| --- | --- |
| mode | 普通base，特殊respin |
| board | 三列3、4、3格，按列从上到下编号1～10 |
| wins | 当前帧中奖项，空奖为空；普通满盘为十项，纯百搭为一项替代大奖 |
| nextAction | 中间continue，最后complete |
| freeRemaining / triggeredFree / awardedFreeSpins | 0、false、0，进度使用专用字段 |
| gameData.ruleType / special | fortune_ox_v1、是否特殊 |
| gameData.stageIndex / stageTotal / stagesRemaining | 从1开始的序号、总盘面数、剩余盘面数 |
| gameData.lockedCellIds | 始终为空，三列每帧都旋转 |
| gameData.sharedCellIds / sharedSymbolId | 特殊为[1,2,3,8,9,10]及共同普通图标；普通为空数组及0。仅表示本盘面相同，不跨帧保留 |
| gameData.lineWins | line、symbolId、payout、cellIds；payout已包含满盘十倍，纯百搭大奖为空 |
| gameData.rawPayout | 最终原始倍率，已包含满盘加成，除10为总投注倍率 |
| gameData.fullBoard / fullSymbolId / fullBoardMultiplier | 满盘标记、统一赔付图标（非满盘0）、已使用的加成（非满盘1、满盘10）；仅供展示，不能再乘到rawPayout上 |
| gameData.jackpot | 十格纯百搭，原始20000、总投注2000倍 |
| gameData.replay | payoutUnit、lineCount=10、payouts；payoutUnit为总投注除10的精确整数或分数，逐项实付之和等于帧winAmount |

图标1～7为鞭炮、橘子、红包、钱袋、钱箱、金元宝、金牛百搭，三连原始赔付3、5、10、20、50、100、200。普通图标混百搭满盘统一按普通图标计十条线再乘十倍；总投注10元的橘子满盘支付500元，纯百搭支付20000元。客户端直接展示已取整实付金额。

每笔投注spinIndex=0、stepIndex为1～stageTotal。完整结果一次保存，重试、state.lastFrame、私人及公开回放复用同一已结算盘面，不提前返回未来帧、不重复扣款或派奖。进行中功能固定旧版本，下一笔可切换当前版本。

本地快照为testdata/deployments/2026-11-15-ag7/AG7。普通原始20000档初始权重0；特殊左右六格只允许普通图标，故无纯百搭档。[联调样例](../testdata/ag7-client-examples.json)含线奖、满盘奖、纯百搭大奖和完整特殊过程，固定样例不代表真实权重。

## AG8 本地接口

AG8复用现有登录、换票、bets、state、spin、历史及私人/公开回放，游戏编号传AG8。`GET /api/v1/games/AG8/bets`新增可选 `buyModes:[{"buyMode":1,"betMultiplier":1},{"buyMode":2,"betMultiplier":5}]`。投注档位、等级上限及金额精度仍以bets为准。

`POST /api/v1/games/AG8/spin`请求例：

```json
{"requestId":"服务端给出的下一请求编号","bet":"10","betLevel":1,"buyMode":2}
```

`buyMode`省略、0或1为普通投注，2为五倍投注。实际扣款为`bet×5条线×betLevel×betMultiplier`。例如bet为10分、等级1，普通扣50分、五倍扣250分；`betAmount`始终返回实际扣款。五倍模式采用独立普通及免费倍率表，单线奖金基准仍是10分。其他游戏不接受模式2。

同一付费局中，后续免费请求必须沿用投注金额及buyMode；每帧使用新的requestId，网络重试使用原requestId。重复请求返回同一已保存帧。修改同一请求或进行中局的金额、模式返回冲突。state.lastFrame也保存buyMode；恢复后沿用该值。

| 字段 | AG8含义 |
| --- | --- |
| `buyMode` | 本局投注模式1或2 |
| `mode` | 普通结果为base，免费结果为free |
| `board` | 三列各三格，按列从上到下编号1～9；图标1～7 |
| `freeRemaining` | 当前帧后剩余免费次数；封顶时直接为0 |
| `triggeredFree`、`awardedFreeSpins` | 第一免费帧为true和8，其他帧为false和0 |
| `spinWinAmount`、`winAmount` | 本帧实际入账金额；`totalWinAmount`为本局累计入账 |
| `gameData.multipliers`、`multiplierSum` | 底部倍率及其和；普通一个，免费2或3个，重复值合法 |
| `gameData.blankMultiplier` | 普通底部为空白时为true，内部按1倍计算 |
| `gameData.rawPayout` | 尚未乘底部倍率的五线原始赔付之和 |
| `gameData.rawWin` | 本帧原始盘面倍率乘底部倍率和，封顶前 |
| `gameData.paidRawWin`、`totalPaidRaw` | 本帧及累计实际结算原始值，包含封顶截断 |
| `gameData.capRaw`、`capReached` | 普通原始上限12500，五倍62500；是否已达上限 |
| `gameData.stageIndex`、`stageTotal` | 当前阶段（从1开始）及本局实际阶段数；可能因封顶少于8 |
| `gameData.featureSpins`、`stagesRemaining` | 规则免费次数8及当前帧后剩余次数 |
| `gameData.lockedCellIds` | 空数组，各转不保留盘面符号 |
| `gameData.lineWins` | 未乘底部倍率的逐线验奖，包含线号、符号、赔付及格号 |
| `gameData.replay` | 单线奖金基准、五条线，以及已乘底部倍率的逐项原始值和实际金额 |

普通结果和免费结果二选一，不额外派奖一笔触发主游戏。每次免费独立旋转并逐帧入账，完整八次全空也返回八帧；客户端按nextAction继续请求，不能因winAmount为0跳过后续帧。达到实际扣款2500倍时只支付剩余额度、`nextAction=complete`、剩余次数0。阶段奖金采用累计取整差分，回放每项amount合计与本帧winAmount一致。

百搭替代全部普通图标，按五线最高奖相加，全百搭盘面原始500；没有额外满盘加成。普通金额为实际扣款×rawWin÷5，五倍除以25。免费底部倍率相加，不跨转累计。底部倍率由服务端保存，state及回放采用同一结果。

本地快照 `testdata/deployments/2026-11-15-ag8/AG8`，两库均覆盖194/194档；[七组固定样例](../testdata/ag8-client-examples.json)包含普通/五倍同线奖、八次中奖、八次全空和两种模式封顶，样例使用固定测试概率。内部自动整局及旧准备/推进入口沿用普通投注，五倍投注从公共spin进入。生产启用需另行选择发布版本。


## AG9 本地接口

AG9 使用原有登录、投注、state、history及replay接口，五条线，仅支持普通投注。一次付费只返回普通结果或整段锁定重转，重转期间沿用原投注继续推进，只有末帧支付最终奖金。

`mode` 为 `base` 或 `respin`。盘面格号按列从左到右、每列从上到下排列，0是重转空白。`gameData.targetSymbolId`为本次重转目标，`lockedCellIds`是已锁定位置，`addedCellIds`是本轮新增，`bonusMultiplier`是1或10，`lineWins`按每线最高赔付列出中奖。`replay.payoutUnit`是总投注除以五的精确有理数，`lineCount`固定5。详细协议见[AG9协议](../protos/game_ag9.proto)。

## AG10 本地接口

AG10 沿用金兔公共的 `launchTicket → POST /api/v1/login` 换票流程，以及 `/api/v1/games/AG10/bets`、`state`、`spin`、`bet-records`、本人回放和公开分享回放。登录传 `gameId: "AG10"`；继续使用服务端签发的 `requestId`、`nextRequestId`。投注、逐帧特殊转、金额字段和回放结构与 [AG5 本地接口](#ag5-本地接口) 相同，十条线时总投注按 `amountScale=2` 和 bets 返回的档位计算。

AG10 使用 Lua 1022 的数值配置和独立盘面快照。普通转先结算，随后可追加 8 次特殊转；特殊转每转清空，至少 5 个奖励符号才支付当转奖励，封顶时只支付剩余额度并停止后续转。客户端不要将原始倍率当作金额。

普通三条横线各自中奖也会触发全盘十倍，不要求全盘同图标。最终原始倍率已经包含十倍。重转的中间帧仅展示新增及锁定，不累计支付；无新增末轮必须展示。重试和回放必须复用服务端保存的帧。
