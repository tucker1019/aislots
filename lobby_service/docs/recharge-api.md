# 充值接口（MVP）

基础地址 `http://127.0.0.1:8081`。所有充值接口均需要有效的 `uid、sid`。创建订单时不加币；测试支付后台在创建约3秒后确认成功并入账。订单持久保存在独立大厅 PostgreSQL 中。

金额字段全部为 JSON 数字、整数分单位，显示金额时 /100。到账金额：`creditAmount = amount + bonus - fee`。赠送和手续费互斥，可同时为0。

## 充值档位配置

配置文件 `etc/recharge.json`，可通过环境变量 `LOBBY_RECHARGE_CONFIG` 指定其他路径。修改后重启服务生效。数组顺序就是接口返回顺序，移除档位即下架；空数组表示暂无档位。

```json
[
  {
    "id": "recharge_10",
    "amount": 1000,
    "bonus": 0,
    "fee": 20
  },
  {
    "id": "recharge_20",
    "amount": 2000,
    "bonus": 0,
    "fee": 40
  },
  {
    "id": "recharge_50",
    "amount": 5000,
    "bonus": 0,
    "fee": 0
  },
  {
    "id": "recharge_100",
    "amount": 10000,
    "bonus": 0,
    "fee": 0
  },
  {
    "id": "recharge_200",
    "amount": 20000,
    "bonus": 400,
    "fee": 0
  },
  {
    "id": "recharge_300",
    "amount": 30000,
    "bonus": 600,
    "fee": 0
  },
  {
    "id": "recharge_500",
    "amount": 50000,
    "bonus": 1000,
    "fee": 0
  },
  {
    "id": "recharge_1000",
    "amount": 100000,
    "bonus": 2000,
    "fee": 0
  },
  {
    "id": "recharge_2000",
    "amount": 200000,
    "bonus": 10000,
    "fee": 0
  },
  {
    "id": "recharge_3000",
    "amount": 300000,
    "bonus": 15000,
    "fee": 0
  },
  {
    "id": "recharge_5000",
    "amount": 500000,
    "bonus": 25000,
    "fee": 0
  },
  {
    "id": "recharge_10000",
    "amount": 1000000,
    "bonus": 50000,
    "fee": 0
  }
]
```

当前12个档位规则（下表为展示单位，配置和接口仍使用整数分）：

| 档位 | 手续费 | 赠送 | 到账 |
| --- | --- | --- | --- |
| 10 | 0.2 | 0 | 9.8 |
| 20 | 0.4 | 0 | 19.6 |
| 50 | 0 | 0 | 50 |
| 100 | 0 | 0 | 100 |
| 200 | 0 | 4 | 204 |
| 300 | 0 | 6 | 306 |
| 500 | 0 | 10 | 510 |
| 1000 | 0 | 20 | 1020 |
| 2000 | 0 | 100 | 2100 |
| 3000 | 0 | 150 | 3150 |
| 5000 | 0 | 250 | 5250 |
| 10000 | 0 | 500 | 10500 |

`id` 唯一且不超过64字节。amount 必须大于0；bonus、fee 不能为负；不能同时大于0；fee 必须小于 amount。配置有误时服务拒绝启动，避免按错误档位加币。

## 获取充值列表

`GET /api/recharge/list?uid=123&sid=YOUR_SID`

可附带既有公共查询参数。只校验身份，不修改余额或延长会话。

```json
{
  "code": "OK",
  "data": {
    "items": [
      {
        "id": "recharge_10",
        "amount": 1000,
        "bonus": 0,
        "fee": 20,
        "creditAmount": 980
      },
      {
        "id": "recharge_20",
        "amount": 2000,
        "bonus": 0,
        "fee": 40,
        "creditAmount": 1960
      },
      {
        "id": "recharge_50",
        "amount": 5000,
        "bonus": 0,
        "fee": 0,
        "creditAmount": 5000
      },
      {
        "id": "recharge_100",
        "amount": 10000,
        "bonus": 0,
        "fee": 0,
        "creditAmount": 10000
      },
      {
        "id": "recharge_200",
        "amount": 20000,
        "bonus": 400,
        "fee": 0,
        "creditAmount": 20400
      },
      {
        "id": "recharge_300",
        "amount": 30000,
        "bonus": 600,
        "fee": 0,
        "creditAmount": 30600
      },
      {
        "id": "recharge_500",
        "amount": 50000,
        "bonus": 1000,
        "fee": 0,
        "creditAmount": 51000
      },
      {
        "id": "recharge_1000",
        "amount": 100000,
        "bonus": 2000,
        "fee": 0,
        "creditAmount": 102000
      },
      {
        "id": "recharge_2000",
        "amount": 200000,
        "bonus": 10000,
        "fee": 0,
        "creditAmount": 210000
      },
      {
        "id": "recharge_3000",
        "amount": 300000,
        "bonus": 15000,
        "fee": 0,
        "creditAmount": 315000
      },
      {
        "id": "recharge_5000",
        "amount": 500000,
        "bonus": 25000,
        "fee": 0,
        "creditAmount": 525000
      },
      {
        "id": "recharge_10000",
        "amount": 1000000,
        "bonus": 50000,
        "fee": 0,
        "creditAmount": 1050000
      }
    ]
  }
}
```

## 创建充值订单

`POST /api/recharge/create`，Content-Type: application/json

```json
{"uid":123,"sid":"YOUR_SID","tierId":"recharge_200","requestId":"recharge-20261103-0001"}
```

`requestId` 是客户端生成的幂等请求号，1–128字节，无控制字符或首尾空白。一次充值的所有重试必须使用同一个请求号；新的充值使用新请求号。uid/sid也可放查询参数，两处都有时必须一致。金额和赠送由服务端配置计算。

```json
{"code":"OK","data":{"orderId":"SERVER_ORDER_ID","paymentUrl":"https://www.baidu.com","status":"pending"}}
```

相同用户、相同requestId和档位返回原订单（状态为当前状态），不会重复创建或重复入账；换档位复用请求号返回409。订单保存创建时的金额快照，之后修改配置不会改变已有订单。

## 查询订单详情 / 轮询付款状态

`GET /api/recharge/order/info?uid=123&sid=YOUR_SID&orderId=SERVER_ORDER_ID`

建议每1秒轮询一次，收到success或failed停止轮询。

```json
{
  "code":"OK",
  "data":{
    "orderId":"SERVER_ORDER_ID",
    "requestId":"recharge-20261103-0001",
    "tierId":"recharge_200",
    "amount":20000,
    "bonus":400,
    "fee":0,
    "creditAmount":20400,
    "coins":20400,
    "status":"success",
    "paymentUrl":"https://www.baidu.com",
    "failureCode":0,
    "createdAt":"2026-11-03T01:00:00Z",
    "settledAt":"2026-11-03T01:00:03Z"
  }
}
```

| status | 显示 | 说明 |
| --- | --- | --- |
| pending | 付款中 | 尚未入账，coins为0、settledAt为空 |
| success | 成功 | 已入账；coins是此订单结算后的余额 |
| failed | 失败 | 未入账；failureCode表示失败原因 |

当前余额仍通过 `GET /api/user/user/info` 获取，历史订单coins不表示当前余额。金额字段全部为整数分数字。时间为UTC RFC3339格式。

当前仅为测试支付：付款页面固定为百度，不需要实际支付，后台每200毫秒扫描到期订单，创建约3秒后自动成功。无需客户端轮询触发；服务重启后会继续处理数据库中到期的付款中订单。余额溢出时订单失败，failureCode=10010009。数据库临时故障回滚后重试，不会部分入账。

## 查询历史订单列表

`GET /api/recharge/order/list?uid=123&sid=YOUR_SID&limit=20&status=success`

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| uid、sid | 是 | 当前有效会话，只能查自己的订单 |
| status | 否 | pending / success / failed；省略查询全部 |
| limit | 否 | 每页1–100，省略或0默认20 |
| cursor | 否 | 上一页返回的nextCursor，原样传入并URL编码 |

```json
{"code":"OK","data":{"items":[],"nextCursor":""}}
```

items中每项字段与详情接口一致，按创建时间倒序；相同时间按订单号倒序。nextCursor为空表示已到末页。翻页时保持筛选条件一致。

## source与事务

source统一在 `script/coin_sources.py` 维护，执行 `make source` 生成常量和[注册表](coin-sources.md)。本金rch_001、赠送rch_002、手续费rch_003。赠送与手续费互斥。

创建订单先独立持久化付款中状态；结算时钱包余额、全部source流水和订单终态在同一个事务提交。行锁及状态检查保证并发后台任务不重复入账。旧版本已有的成功订单保留，不会再次加币。

## 错误码

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | 10010001 | 参数或分页游标无效 |
| 401 | 10010002 | 会话无效或过期 |
| 400 | 10010007 | 档位不存在或已下架 |
| 409 | 10010008 | 同一请求号用于其他档位 |
| 404 | 10010010 | 订单不存在或不属于当前用户 |
| 500 | 10010005 | 数据库异常 |

失败订单的failureCode=10010009表示余额溢出；查询该订单本身仍返回HTTP 200。

## 存取记录页的时间筛选

`GET /api/recharge/order/list` 新增可选查询参数 `from`、`to`，必须同时提供 RFC3339 时间。按订单创建时间过滤，范围为 `[from,to)`，最长31天；不提供时保留原有历史查询行为。分页游标与当前时间、状态筛选绑定，切换筛选后从第一页重新查询。

大厅提供今天、昨天、近7天、近30天，按浏览器本地日期计算午夜边界，再转换UTC传给服务端。当前只有存款记录，取款入口提示敬请期待。详情复用订单查询接口，显示实际费用、到账和状态；测试支付渠道不标成支付宝等真实支付方式。
