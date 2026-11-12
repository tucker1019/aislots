# SDD ledger — plan: docs/superpowers/plans/2026-11-12-ag3-client.md
Ruling: 在当前checkout新建codex/ag3-client分支，保留现有未提交配置与本地服务；不另建worktree，避免遗漏未提交AG3配置。
Ruling: 原项目原生组件沿用Cocos，不迁移React；资源UUID不改。
Task 1: complete — 独立副本、移除旧Socket/Protobuf/Bridge/上传工具；3.8.8构建通过，修复旧private类型引用；原资源UUID保留。
Task 2: complete — 模拟协议测试红绿通过，HTTP实际协议使用bet字符串与betLevel；Frame金额为数值；启动票据与重试幂等。
Task 3: complete — 原生逐轮连消与免费接入，FrameGate防止重复演出，恢复静态盘面后显式继续；原动画保留。金框变换按transformedIds定位。
Ruling: 历史回放使用独立只读盘面视图及原符号纹理，不借用正在进行的原生场景动画 — 保证退出回放不会遗留异步动画推进投注 — 与原生演出回放视觉不同，后续可独立完善。
Task 4: in progress — 大厅退出消息来源校验测试已红绿通过，正在验证历史/回放、发布本地目录和最终构建。
Final review: fresh reviewer ag3_client_review found money precision, completed-free restore, auto-spin +1, golden Wild109/1009 encoding, global touchmove scroll blocking. All corrected. Added precision/restore/auto budget and template/encoding contracts; full protocol suite now 12 tests. Mobile width-change policy additionally corrected with failing regression first.
Ruling: 复用当前工作区后台已有管理员会话API发布本地游戏目录版本8，只新增AG3并隐藏旧G1068，保留其他发布内容；无远程发布。风险：本地大厅立即显示AG3入口。
Ruling: 浏览器实测补充修复3.8.8隐藏Node Tween暂停：菜单先激活再动画，位置取场景原值；倍率栏由已激活组件调度后激活节点再播放。原生菜单模拟3.8.8语义测试先失败后通过。
Verification: 游戏协议与native菜单13项通过，tsc通过；场景脚本55处引用完整。大厅lint/build通过，GamePage6项通过；全量大厅178/181，2项超时独立重跑通过，剩余GameInsights重复97.00%文本断言失败，未改该业务/测试。
Task 4: complete — 本地目录发布版本8；8080/5182健康；手机浏览器实测倍率栏出现、菜单开合、历史记录加载及回放开关均正常，无浏览器error。mock回放只发只读GET；未操作真实投注。
Final: fixed monetary precision and completed-free restore — display regressions RED→GREEN.
Final: fixed auto-spin +1 — AutoBudget 1/10/30-spin regressions RED→GREEN.
Final: fixed gold Wild conversion and canvas-only touch cancellation — source contracts green.
Final: fixed 3.8.8 inactive-node tween — extracted native menu regression RED→GREEN; actual menu/multiplier view verified.
Final: minor (deferred): 独立只读回放尚不包含实时场景原生演出，已在README披露。
Follow-up fix 2026-11-12: user observed login POST on static5182. Root cause: launch URL contains ticket but not api, unlike previous README assumption; AG3 bootstrap mistakenly used page origin instead of established AG1/AG2 localhost8080 fallback. resolveApiBase now preserves explicit api, defaults localhost to8080, production to same origin. Regression RED→GREEN,14/14 tests,tsc/build pass; real unauthenticated GET state returned401 from8080 and login preflight204. No real credentials, login or funds used in verification.
