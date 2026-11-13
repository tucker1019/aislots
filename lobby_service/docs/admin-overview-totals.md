# 后台账号分类总览

`GET /admin/api/overview` 保留原 members 等字段，新增 realMembers、experienceMembers、realBet、realWin、experienceBet、experienceWin。所有 Bet/Win 均为钱包最小金额单位的整数字符串，前端精确格式化，不转浮点数。

普通用户按 lobby_users.account_type=real（包括普通游客）统计，体验账号按 experience 统计；不按昵称、是否绑定账号或余额推断。Bet 是已确认结算 debit，Win 是已确认结算 credit，包含免费局派彩，不是净盈利，不包括充值、赠送或体验初始余额。当前大厅只有单一钱包币种；此统计不跨钱包/币种拼接。

028 迁移首次读取历史用户、confirmed 结算进行初始化。初始化期间锁住相关写入表，安装触发器和历史汇总在同一个迁移事务完成；初始化标记与汇总同时提交。失败整体回滚，重启后不会重复累计。首次历史扫描可能耗时并暂时阻塞写入，应安排测试/维护窗口；不要在请求处理中初始化，也不要手动删除初始化标记。

账号创建/删除、结算 INSERT/UPDATE/DELETE 触发汇总；rejected 不计数，幂等请求不产生重复 INSERT，业务事务回滚也回滚统计。账号类别不可更改。人数表仅两行，投注表按账号类别和 uid%64 分桶，最多128行，减少单行热点；总览只读取这些汇总，不 COUNT 用户表、不 SUM 结算明细。

可重复应用迁移，不会再次扫描历史或增加统计。直接用 psql 执行独立迁移时使用 `psql -1 -v ON_ERROR_STOP=1` 保证事务边界；应用通过整体 migrations.Schema 执行。

测试覆盖历史初始化、后续增量、rejected→confirmed、幂等重试、回滚、重复迁移、超 bigint 的汇总金额，以及移走明细表后总览仍可查询。
