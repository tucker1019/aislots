# Slots 大厅开发规范

- React + TypeScript + Ant Design；函数组件和 Hooks。
- TanStack Query 管理服务端数据；Zustand 只管理客户端全局状态。
- 页面 src/pages，通用组件 src/components，业务模块 src/features，请求统一 src/services。页面禁止直接 fetch。
- 禁止 any；外部响应用 unknown 并校验。单组件不超过 300 行，优先复用已有组件。
- 不修改无关文件；新增依赖先解释理由并取得确认。
- 复用 DESIGN.md 和 Ant Design 主题；异步页面覆盖 loading、empty、error 和重试。
- 危险操作二次确认；异步按钮防重复并显示 loading，禁用状态不触发业务；表单显示错误。
- 写代码前阅读相关文件、复述需求、列文件与职责、说明组件和数据流，待用户确认。已确认范围无需反复确认。
- 完成后运行 npm run lint、npm run typecheck、npm test 和 npm run build；报告真实结果及剩余风险。
- 本项目使用用户确认的 Apple 参考系统字体栈，不额外安装字体包。
- 当前界面为固定资料顶栏、通知、Banner、厂商分类及三列游戏网格。分类仅热门/AG/PG/JILI/PP，只有麻将胡了一款游戏；PG/JILI/PP点击Toast“敬请期待”，不切换为空列表。旧搜索、收藏、底部导航等不自行恢复。

## 多语言表格和统计区

- 同行标题、金额必须共享行高，翻译换行不能使金额错位；使用语义化表格或共享行轨道，不要按列独立堆叠。
- 允许标题换行；不要只缩短英文、缩小字体或写死标题高度来解决适配。空间不足时在表格内部横向滚动，不撑宽页面。
- 反水预估与反水规则页统一复用 `src/features/earn/RebateForecast.tsx`，其他同类布局优先复用现有组件。
- 修改后检查中英文及 320px 窄屏、长文案、大金额，在浏览器核对标题与金额对齐，不能只依赖 DOM 测试。
