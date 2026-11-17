# Slots 大厅开发规范

- React + TypeScript + Ant Design；函数组件和 Hooks。
- TanStack Query 管理服务端数据；Zustand 只管理客户端全局状态。
- 页面 src/pages，通用组件 src/components，业务模块 src/features，请求统一 src/services。页面禁止直接 fetch。
- 禁止 any；外部响应用 unknown 并校验。单组件不超过 300 行，优先复用已有组件。
- 不修改无关文件；新增依赖先解释理由并取得确认。
- 视觉样式以 DESIGN.md 为准，复用 Ant Design 主题；默认深色并保留用户选择的浅色主题，页面和弹层使用相同颜色语义。异步页面覆盖 loading、empty、error 和重试。
- 危险操作二次确认；异步按钮防重复并显示 loading，禁用状态不触发业务；表单显示错误。
- 写代码前阅读相关文件、复述需求、列文件与职责、说明组件和数据流，待用户确认。已确认范围无需反复确认。
- 完成后运行 npm run lint、npm run typecheck、npm test 和 npm run build；报告真实结果及剩余风险。
- 大厅字体按 DESIGN.md 使用本地 Nunito 可变字体与粉圓体 Huninn，由正文、按钮、金额和 Ant Design 共用；Noto Sans TC 与系统字体作缺字回退，不引入远程字体请求或运行依赖。
- 首页沿用固定资料顶栏、通知、Banner、厂商分类及三列游戏网格。游戏列表、可用状态与厂商分类以现有目录接口和组件为准，不写死游戏数量或假定只有 AG1；未开放游戏沿用现有敬请期待交互。
- 底部固定导航仅保留首页、存款、赚钱、我的四项，优惠路由和入口已移除；遵守各路由的底栏显示规则。新增悬浮入口和弹层需避开底栏与安全区，不恢复已移除的搜索、收藏等功能，除非需求明确要求。

## 多语言表格和统计区

- 同行标题、金额必须共享行高，翻译换行不能使金额错位；使用语义化表格或共享行轨道，不要按列独立堆叠。
- 允许标题换行；不要只缩短英文、缩小字体或写死标题高度来解决适配。空间不足时在表格内部横向滚动，不撑宽页面。
- 反水预估与反水规则页统一复用 `src/features/earn/RebateForecast.tsx`，其他同类布局优先复用现有组件。
- 修改后检查繁体中文、英文、印尼语及 320px 窄屏、长文案、大金额，在浏览器核对标题与金额对齐，不能只依赖 DOM 测试。

- 公共接口失败界面按 [slots-lobby-ui skill](../.agents/skills/slots-lobby-ui/SKILL.md) 实现，复用 NetworkError 组件。

## 设计分辨率适配

- 大厅统一420px设计宽度，小屏按宽整体等比缩放，大屏不放大并居中，高度自然滚动。详见 docs/design-viewport.md。
- 页面、固定导航、弹窗、下拉和Toast使用统一设计坐标；Modal和message使用app/designViewport.ts的overlayContainer，禁止绕过公共挂载点单独缩放。
- 不新增依赖物理窗口宽度的排版断点；长文本仍显式定义换行/省略/内部滚动。游戏放大由Cocos自己适配，不能重新挂载iframe。

- 多语言使用英文语义 key（如 `copy.walletBalance`），禁止中文 key 或根据中文文案反查 key；服务端展示项按稳定英文业务 ID 映射，未知项保留服务端原文。

## 异步按钮

- 点击请求接口的按钮遵守 [async-button-states skill](../.agents/skills/async-button-states/SKILL.md)：请求中只显示居中的小圆圈旋转动画，原文字隐藏但保留占位，按钮大小及位置不变，全程防重复触发。
