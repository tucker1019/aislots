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
- 当前只保留竖版适配、固定顶栏和真实用户资料。旧推荐、游戏列表、搜索分类、收藏和底部导航已清理，后续按用户确认的需求逐项重建。
