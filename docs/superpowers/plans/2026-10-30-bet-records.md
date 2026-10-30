# 整局下注记录与回放

已确认口径：一次付费下注、普通消除、所有免费旋转及追加免费共用一条 betId；列表投注额只计付费下注，赢分为已结算累计。进行中可查，只返回已结算内容。回放查询不改变钱包和游戏进度。

## 实现选择

复用 bet_tickets / spin_steps；不新增重复流水，不重新执行开奖。读取使用独立只读数据库事务，避免占用下注钱包锁。回放用一致性快照保证列表摘要与本页帧一致。

## 接口

- GET /api/v1/games/{gameId}/bet-records?limit=20&cursor=...
- GET /api/v1/games/{gameId}/bet-records/{betId}/replay?limit=100&cursor=...
- Bearer 登录态限定 appname/appkey/uid、游戏、国家及币种；不接受请求者指定其他用户。
- 列表按创建时间、betId 倒序；回放按 spinIndex、stepIndex 正序。
- 金额为整数字符串；返回游标分页，不返回未结算帧、下一开奖标识或内部继续游标。

## 实施步骤

1. 先写真实 PostgreSQL/HTTP 集成测试，验证未实现路由失败。
2. 在 application/play 增加记录 DTO、分页校验及查询服务；Store 声明只读查询端口。
3. PostgreSQL 查询已有已下注记录，回放仅取 spin_steps；增加按用户、游戏分页索引。
4. 接入 HTTP 两个 GET 路由，文档写明字段、状态、分页与请求示例。
5. 跑服务端全套测试、真实数据库 race 集成测试、vet 与构建，提供可直接调用的接口。

## 验证重点

整个免费链仅一条记录且只扣一次投注；进行中不泄漏未来结果；刷新/查询不重复结算；分页无重复遗漏；他人记录不可查；回放不暴露有效 requestId；不存在和未下注准备记录返回404。
