# 用户资料接口

本地地址 `http://127.0.0.1:8081`。请求与响应目前不加密，统一经过预留的加解密函数。

用户昵称、头像和金币统一从 `/api/user/user/info` 获取，登录接口继续只返回 `uid、sid、expiresAt`。登录成功后调用本查询接口。

## 账号登录与注册

- 未登录浏览首页和优惠不创建用户，不分配 UID，不建立会话。
- `POST /api/user/account/uniquecode/register`：提交 `account、password`，可附带 `inviteCode`；成功创建账号、钱包、会话及邀请关系，同一事务返回 `uid、sid、expiresAt`。
- `POST /api/user/account/uniquecode/login`：只需 `account、password`，不要求已有 UID/SID。成功签发新会话。
- 账号 3–64 字节，首尾不得有空格；密码 8–72 字节。密码使用 bcrypt 保存，不记录明文。
- 公开 `POST /api/user/account/visitor/login` 已关闭，返回参数错误，不创建任何用户。
- 现有有效会话仍走 `session/renewal`；无效会话要求重新账号登录，不回退游客。
- 旧游客数据保留，不做迁移或删除；体验账号后台调度独立运行。

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
    "account": "",
    "avatarId": 7,
    "coins": 0
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| uid | number | 用户 UID |
| nickname | string | 昵称 |
| account | string | 已绑定的自定义账号，游客为空字符串 |
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

游客绑定自定义账号成功后，在同一事务中将 nickname 更新为 account，保持原 uid、头像和钱包。绑定不会额外创建用户；账号冲突时整体回滚，不改变原资料。

## 安全中心

- `POST /api/user/account/password/update`：`uid、sid、oldPassword、newPassword`。校验有效会话、旧密码和新密码格式，且新旧不可相同；成功更新 bcrypt 哈希并原子注销该账号全部会话，返回 `{success:true}`，客户端清理身份并要求重新登录。错误密码不注销会话。
- `POST /api/user/account/logout`：`uid、sid`。只注销当前会话，已注销会话重复请求仍成功。客户端二次确认后才提交，成功后清除身份及个人缓存并返回首页。
- 并发安全：登录验证旧哈希后创建会话前再次在用户锁内比较哈希，避免密码修改后仍创建旧密码会话。
