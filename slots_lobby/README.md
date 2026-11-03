# AISlots 游戏大厅

独立 React + TypeScript 前端，位于仓库根目录 `slots_lobby/`。使用 Ant Design、TanStack Query、Zustand。

## 运行

需要 Node.js >= 22.12，推荐使用仓库当前的 Node 22.22.2。

```sh
cd slots_lobby
npm ci
npm run dev
```

打开 http://127.0.0.1:5175/ 。构建预览运行 `npm run build`、`npm run preview`（4175端口）。

## 页面适配

大厅最大宽度430px，电脑上居中、两侧留灰底，手机上铺满可用宽度，不使用整页缩放。当前只保留固定顶栏和真实用户资料，下方内容留空，待按新需求开发。旧推荐、目录、搜索分类、收藏、最近玩过、底部导航及说明弹窗已经移除。

顶栏固定在顶部并预留等高内容空间，右侧显示真实金币与头像，兼容顶部安全区。

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

## 目录

- `src/app`：应用入口、主题和Query Provider。
- `src/pages`：空白大厅页面组合，不直接请求接口。
- `src/components`：固定顶栏、品牌和金币图标。
- `src/features/account`：余额、头像及加载/错误/重试状态。
- `src/services/account.ts`：登录、续期、资料请求与响应校验。
- `src/stores/session.ts`：持久化身份，不缓存余额。
- `src/styles`：全局适配与顶栏样式。

大厅与麻将服务的身份及钱包尚未互通；当前不包含账号注册、充值、活动等页面。配置示例见`.env.example`。

## 验证

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

覆盖游客登录去重、续期、身份失效、网络重试、响应校验、金额换算，以及保留顶栏/空白主体和用户资料加载/错误/重试。

TypeScript 固定在 6.0 系列以兼容 typescript-eslint；测试和开发缓存独立。构建将 React 与 UI 依赖分块。

开发工具链存在 npm audit 中危告警，主要涉及文件 glob 匹配依赖；没有通过强制降级或跨大版本覆盖掩盖告警。生产依赖审计单独记录于 `docs/qa.md`。
