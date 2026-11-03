# AISlots 游戏大厅

独立 React + TypeScript 前端，位于仓库根目录 `slots_lobby/`。使用 Ant Design、TanStack Query、Zustand，视觉参考 [Apple design.md](https://getdesign.md/apple/design-md)。

## 运行

需要 Node.js >= 22.12，推荐使用仓库当前的 Node 22.22.2。

```sh
cd slots_lobby
npm ci
npm run dev
```

打开 http://127.0.0.1:5175/ 。构建预览运行 `npm run build`、`npm run preview`（4175端口）。

## 页面适配

所有屏幕使用同一套手机竖版布局。大厅最大宽度430px，电脑上居中、两侧留灰底，手机上铺满可用宽度；游戏始终两列。内容在大厅内部滚动，底部导航固定在大厅宽度内，弹窗及遮罩同样限宽。底部预留安全区，窄屏文字按容器宽度调整，不使用整页缩放。

顶栏固定在顶部并预留等高内容空间，右侧显示真实金币与头像，兼容顶部安全区。去掉顶栏搜索和说明入口，列表搜索仍然可用。

## 大厅用户服务

先在另一个终端启动独立大厅服务（不替换8080端口的麻将服务）：

```sh
cd ../lobby_service
docker compose up -d
export LOBBY_DATABASE_URL='postgres://lobby:lobby-local-only@127.0.0.1:55433/aislots_lobby?sslmode=disable'
make run
```

开发和构建预览将 `/api/user` 代理到本机8081端口。正式部署需要同源反向代理，或者通过 `VITE_LOBBY_API_URL` 设置允许跨域的大厅接口源站；该变量不附加 `/api` 路径。

首次进入创建游客，本机身份保存后刷新先续期，再获取资料。会话失效保留原身份并提示错误，后续账号登录界面另做。Query持有资料及余额，窗口重新获得焦点且缓存过期时刷新；Zustand只持久化uid/sid/到期时间，密码和余额不落本机缓存。网络请求12秒超时，失败显示重试，不用0冒充失败结果。并发挂载共用一次登录，请求失败不自动重放创建游客。

余额为整数分，显示两位小数；服务端头像编号1–15对应 `public/assets/profile/avatar` 的同名图片，资源复制自用户指定的AB3目录。失败/加载时用中性占位头像。

## 数据与游戏入口

- 默认读取 `public/data/games.json`，这是明确的模拟大厅目录，不是服务端游戏列表。
- 只有 `AG1` 对应现有麻将客户端，其他卡片为筹备演示，禁止启动。
- 开发环境麻将默认入口 http://127.0.0.1:5180/ ，请自行启动对应 Cocos 客户端服务。
- 生产构建前设置 `VITE_MAHJONG_URL` 为实际客户端的完整 HTTP(S) 地址，未配置时入口禁用，不会错误地引导用户访问本机。
- 未来设置 `VITE_CATALOG_URL` 切换为真实目录接口，响应结构与演示 JSON 相同。所有请求只在 `src/services`。
- 已接游客身份和只读用户余额；不包含充值、提现、账号注册或资料编辑界面。进入游戏只打开配置地址，不会自动下注。大厅和麻将服务的身份及钱包尚未互通。
- 收藏及最近玩过仅保存在本机浏览器的独立 Zustand 存储；目录数据由 Query 管理。
- 游戏地址不接受 javascript 协议或 URL 内嵌账号密码。目录响应使用 unknown 校验，不能通过错误数据伪造正常空态。

配置示例见 `.env.example`，复制为 `.env.local` 后重启开发服务器。

## 目录

- `src/app`：主题和 Query Provider。
- `src/pages`：页面组合，不发起 fetch。
- `src/components`：通用品牌、导航、图标、异步状态。
- `src/features/games`：卡片、插画、查询、筛选、启动入口。
- `src/features/favorites`：收藏交互。
- `src/services`：请求及响应验证。
- `src/stores`：本机全局偏好。
- `src/features/account`、`src/services/account.ts`、`src/stores/session.ts`：顶栏用户展示、账号请求、持久化身份。
- `src/styles`：设计系统与响应式样式。

牌面图片复制自现有 Cocos 项目；筹备卡插画为本项目 SVG 代码，不依赖外部图片、字体或图标服务。

## 验证

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

覆盖目录边界、危险启动地址、请求失败、取消信号、搜索分类组合、收藏、最近玩过、持久化数据校验，以及页面 loading/empty/error/重试和禁用入口。

TypeScript 固定在 6.0 系列以兼容 typescript-eslint；测试和开发缓存独立。构建将 React 与 UI 依赖分块。

开发工具链存在 npm audit 中危告警，主要涉及文件 glob 匹配依赖；没有通过强制降级或跨大版本覆盖掩盖告警。生产依赖审计单独记录于 `docs/qa.md`。
