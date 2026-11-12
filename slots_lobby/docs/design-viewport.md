# 大厅设计分辨率适配

设计宽度420px，比例min(屏幕宽/420,1)，大屏居中，小屏整页等比缩小，不按屏幕宽度重新排列组件。高度为可用视口高度/比例，根节点内纵向滚动。

`app/designViewport.ts`负责初始化、窗口及visualViewport高度变化；`styles/design-viewport.css`定义画布、固定层、弹窗及游戏放大的边界。`index.html`中lobby-viewport包含root；lobby-overlays作为body下独立的同尺寸缩放顶层，与游戏详情portal互不嵌套，保证弹窗不被游戏详情盖住。安全区转换到设计坐标，避免缩小后留白不足。

新增弹窗必须使用`overlayContainer`作为getContainer，下拉使用Providers的getPopupContainer，message.useMessage也使用同一容器。不要把弹层挂到body后另外缩放。避免添加依赖物理窗口宽度的media断点；减少动画和hover查询仍可使用。

长文本仍须组件内定义溢出规则。排行榜订单号省略显示、title保留全值，验证徽章和回放按钮固定占位。

游戏详情独立portal到body，普通详情使用相同比例；放大时解除大厅缩放，Cocos自行适配。放大/缩回仅改变样式，不重新创建iframe或重新获取票据。

验证：280/320/375/420与桌面、中英文、根滚动及固定底栏、弹窗/下拉/Toast、输入框与软键盘高度、游戏放大缩回。桌面模拟不能替代iOS/Android真机软键盘和安全区验证。

Android Chrome 兼容：缩放使用 CSS `zoom`，不在可滚动容器祖先使用 `transform: scale()`，避免合成滚动层重复缩放裁切。页面、独立弹层和游戏详情沿用相同缩放值；游戏全屏 zoom 为 1。

Ant Design Drawer 的 content-wrapper 默认 `max-width:100vw` 使用物理视口数值，在420px缩放弹层中会再次缩小。公共弹层统一覆盖为 `max-width:100%;max-height:100%`，上限相对设计画布，不能在业务抽屉中重新使用100vw限制。抽屉section同时限制为设计视口高度，确保短屏时body收缩并在内部滚动，避免只裁切外层。
