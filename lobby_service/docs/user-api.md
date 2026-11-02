# 用户资料接口

本地地址 `http://127.0.0.1:8081`。请求与响应目前不加密，统一经过预留的加解密函数。

用户昵称、头像和金币统一从 `/api/user/user/info` 获取，登录接口继续只返回 `uid、sid、expiresAt`。登录成功后调用本查询接口。

## 查询用户信息

`GET /api/user/user/info`

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| uid | 整数 | 是 | 当前用户 UID |
| sid | 字符串 | 是 | 当前有效会话 |

可附带公共参数 `app_name、app_key、cv、uuid、lca_coun、lca_lang、client_ts` 等；MVP 不以这些参数替代 uid/sid 鉴权。只能查询当前会话所属用户，不能传其他 uid 查询他人。

```http
GET /api/user/user/info?uid=123&sid=YOUR_SID&app_name=zhyx&lca_lang=zh
```

响应：

```json
{
  "code": "OK",
  "data": {
    "uid": 123,
    "nickname": "player_123",
    "avatarId": 7,
    "coins": 0
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| uid | number | 用户 UID |
| nickname | string | 昵称 |
| avatarId | number | 头像编号，整数 1–15；客户端映射对应图片 |
| coins | number | 金币余额，整数分单位，100 表示 1.00；客户端展示时 /100 |

新游客默认昵称 `player_{uid}`；新注册账号也使用同一默认规则。头像从 1–15 均匀随机分配，持久化后不会随登录、查询或续期重新随机。新用户金币为 0。已有用户迁移补齐资料和余额记录，资料查询不续期会话。

## 修改用户信息

`POST /api/user/user/update`

`Content-Type: application/json`

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| uid | number | 是 | 当前用户 UID |
| sid | string | 是 | 当前有效会话 |
| nickname | string | 否 | 去掉首尾空白后为 1–24 个 Unicode 字符，禁止控制字符，允许重名 |
| avatarId | number | 否 | 整数 1–15 |

`nickname、avatarId` 至少提供一个；未提供的字段保留原值。uid/sid 也可以放在 URL 查询参数；与 JSON 同时提供时必须一致。不要传 null 表示清空，昵称不允许清空。

```json
{
  "uid": 123,
  "sid": "YOUR_SID",
  "nickname": "快乐玩家",
  "avatarId": 15
}
```

只换头像：

```json
{"uid":123,"sid":"YOUR_SID","avatarId":3}
```

成功响应与查询接口结构一致，返回修改后的完整用户资料。修改昵称、头像不影响账号密码和金币，也不续期会话。`coins` 为只读字段，没有通过本接口修改余额的能力。

## 错误响应

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | 10010001 | 参数类型无效、身份参数冲突、昵称不符合要求、头像越界、未提交修改字段 |
| 401 | 10010002 | uid/sid 缺失、不匹配或会话已过期 |
| 500 | 10010005 | 数据库异常 |
| 500 | 10010006 | 系统异常 |

```json
{"code":10010002,"message":"会话无效或已过期"}
```
