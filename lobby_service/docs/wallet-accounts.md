# 收款方式管理

渠道由服务端返回，目前为 `test1`、`test2`。每位用户在每个渠道最多绑定一组账号和姓名，保存时新增或覆盖本人该渠道记录。此模块仅管理收款资料，不发起提现、不变动余额。

- `POST /api/user/wallet/accounts`：请求 `{ "uid": 10000001, "sid": "当前会话" }`，返回 `data.channels`，每项含 `channel`、`account`、`name`、`bound`。未绑定项返回空账号、空姓名和 `bound: false`。
- `POST /api/user/wallet/account/save`：请求包含 `uid`、`sid`、`channel`、`account`、`name`，返回保存后的同结构渠道项。

两接口均验证当前有效会话，仅允许读写本人数据。账号保留前导零，去除两端空白后为1–128字符；姓名为1–64字符，禁止控制字符。仅允许服务端支持的渠道。数据库 `lobby_payout_accounts` 使用 `(uid, channel)` 联合主键，原子 upsert，刷新、重启不丢失。

迁移：`deploy/migration/017_wallet_accounts.sql`，随服务启动执行。协议及路由通过 `make build` 生成，模型须在迁移后通过 `make model` 生成。失败不会覆盖现有资料，客户端保留输入供重试。
