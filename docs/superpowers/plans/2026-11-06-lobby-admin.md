# Lobby Admin Implementation Plan

> **For agentic workers:** Use superpowers:dispatching-parallel-agents for independent frontend/backend work, then one fresh-context code review. No commits or remote deployment without user request.

**Goal:** 独立 slots_lobby_admin，提供真实配置管理、会员、充值提现订单及人工审核。

**Architecture:** 独立后台前端与独立后台HTTP入口，复用大厅业务模型和事务；配置持久化、版本发布与安全热更新。大厅与未来游戏后台边界隔离。

**Tech Stack:** React、TypeScript、Ant Design、TanStack Query、Zustand；Go、Protobuf、GORM、PostgreSQL。

**Contract:** slots_lobby_admin/docs/design.md。

- [x] 管理协议、迁移、管理员会话和权限、只读查询、审计与金融审核事务；隔离数据库测试。
- [x] 独立前端登录、概览、会员、订单审核、配置表单与历史、审计页面；请求状态稳定与异常重试；测试和构建。
- [x] 配置草稿与发布、校验、并发版本控制、回滚，接入大厅运行时刷新，保留历史资金订单语义。
- [x] 集成前后端、初始化命令、开发启动、文档；浏览器验证只读和模拟数据，禁止操作真实资金审核。
- [x] 运行协议生成、Go测试和vet、前端lint/typecheck/test/build，记录限制与验证证据。

## 实施记录

- 独立前端5176、后台API8082，12个配置分区，玩家端不暴露后台API。
- 审核与配置并发测试使用独立PostgreSQL临时schema；没有审核真实订单。
- 独立审查发现并修复：草稿CAS清零ABA、反水历史费率重算、空数组/map无法新增、展示内容后台缺失。
- 配置发布全局事务锁，版本+文档一致读取；正在处理的请求不切换依赖。返水调度未来周期，不重算历史。
- 后台真实登录及只读overview/members/orders/audit/configs接口已验证；前台公开内容双语及3张Banner验证。
- 管理员随机口令单独存于用户私有目录，未入库明文或提交到仓库；服务仅监听本机。
- 前端15项后台测试；大厅164项测试通过（并发资源紧张时一项5000ms测试超时，降低worker并发重跑全部通过）。
- 远程未部署，未提交/推送。真实支付渠道、实际出款、资源文件上传不属于本期。

最终检查：`make build`成功；带隔离数据库的`make test`及覆盖率门槛通过（pkg100%，logic最低90.1%）；`make lint`为0 issues；`go vet ./...`通过；后台lint/typecheck/15测试/build通过；大厅lint/typecheck/164测试/build通过。浏览器真实登录后验证配置分区，截图`/tmp/aislots-admin-console.png`。本地服务5176/8082/8081已确认监听。
