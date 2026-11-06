# 大厅运营后台

已确认：新项目名 slots_lobby_admin；配置管理、会员查询、充值提现订单和人工审核一起实现。未来游戏后台独立成项目，不访问机台数据库，不在本后台管理赔率/盘面库。

## 结构

- slots_lobby_admin：独立 React/TypeScript/Ant Design 前端，TanStack Query，Zustand。开发端口5176。
- lobby_service/app/apis/lobby/api/admin：独立后台服务入口，127.0.0.1:8082，管理大厅同库。后台API独立鉴权，玩家uid/sid不可用于后台。
- 后台业务配置持久化至大厅库，现有etc配置用于首次初始化。草稿校验、发布、回滚与审计。密钥和部署参数仍由环境变量提供。
- 大厅运行时订阅配置发布版本；整份校验后原子切换新请求依赖，处理中的请求保留旧快照。涉及已经创建的资金订单必须沿用原订单金额，已结算奖励不重算。无法安全热改的字段必须明确拒绝或显示生效边界。
- 管理员账号通过本地初始化命令创建，bcrypt密码、随机会话令牌仅存哈希、HttpOnly SameSite cookie、角色校验、来源校验、登录限流。无默认口令。
- 会员只读查询；充值确认和提现批准/退回以原订单为对象，在钱包行锁和幂等事务内执行，审核理由与审计原子落库。

## HTTP契约

JSON统一 {code:"OK",data:...}；错误返回HTTP 400/401/403/409/429/500及{code,message}。金额为整数字符串（分）；UID为字符串；时间RFC3339。列表默认20条、最多100条、游标分页。认证为cookie，写请求带X-Admin-Request:1；仅允许配置的Origin。

- POST /admin/api/login {username,password} → {username,role}
- GET /admin/api/me → {username,role}
- POST /admin/api/logout → {}
- GET /admin/api/overview → {members,pendingDeposits,pendingWithdrawals,todayDeposits,todayWithdrawals}，统计金额为分字符串。
- GET /admin/api/members?q=&cursor=&limit= → {items:[{uid,account,nickname,avatarId,vipLevel,coins,createdAt,lastLoginAt}],nextCursor}
- GET /admin/api/members/{uid} → {member,wallet:{coins,turnoverRequired},accounts:[{channel,account,name}],ledger:[{id,type,amount,balance,createdAt}]}，收款账号与姓名脱敏。
- GET /admin/api/orders?kind=deposit|withdrawal&status=&q=&cursor=&limit= → {items:[{orderId,uid,kind,status,amount,fee,bonus,creditAmount,channel,account,name,createdAt,settledAt}],nextCursor}，账号姓名脱敏。
- POST /admin/api/orders/review {kind,orderId,decision:approve|return,reason,requestId} → {orderId,status}。充值approve表示人工确认原订单入账；return表示关闭待付订单；提现approve表示审核通过（不宣称已真实打款），return按原事务退回本金。
- GET /admin/api/audit?q=&cursor=&limit= → {items:[{id,username,action,target,reason,createdAt}],nextCursor}
- GET /admin/api/configs → {items:[{key,label,description,publishedVersion,draftVersion,hasDraft}]}
- GET /admin/api/configs/{key} → {key,label,published,draft,publishedVersion,draftVersion,history:[{version,status,username,createdAt,reason}]}
- POST /admin/api/configs/{key}/draft {document,expectedVersion,reason} → 同配置详情
- POST /admin/api/configs/{key}/validate {document} → {valid:true}
- POST /admin/api/configs/{key}/publish {expectedVersion,reason,requestId} → 同配置详情
- POST /admin/api/configs/{key}/rollback {version,expectedVersion,reason,requestId} → 同配置详情（回滚作为新发布版本）

权限：admin全部；operator配置草稿和查询；finance会员订单查询及审核；viewer只读。发布回滚仅admin。日志不包含密码、令牌、完整收款资料。

## 第一版配置区

recharge、withdrawal、checkin、returns、turnover、agent、vip、invite、newbie-recharge、games、experience；展示内容区用于公告/Banner等大厅展示数据。所有字段通过现有配置校验器与模块约束校验，不提供任意文件编辑能力。

## 实施时确认的边界

保存草稿expectedVersion采用max(publishedVersion,draftVersion)单调版本，防止发布清空草稿后的ABA覆盖。新手、订单、VIP保留已生成快照；反水新费率按下个日/周/月周期生效，亏损返还按日。展示分区content包含双语公告与Banner，实际接入大厅公开内容API；图片先上传现有静态目录或CDN，再填写URL，本期不做文件上传。
