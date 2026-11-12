# AG3 单场景与内置资源加载 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 按用户要求取消 AG3 自定义 Bundle，只保留游戏场景，编辑器可直接运行。

**Architecture:** 以 WBSGameScene 为唯一入口，场景负责创建随场景销毁的管理器，并等待登录和资源准备后恢复游戏节点。动态资源移动至内置 resources/res，保留资源 UUID、游戏 UI 层级、玩法和原生动画。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Node test。

**Spec:** 本文即本次范围：删除 h5main/game 中转场景及脚本；无自定义 loadBundle/getBundle/BUNDLENAME；内置 resources 是引擎机制，保留；不改服务端和测试环境。

## Global Constraints
- 不改游戏节点层级与美术 UUID，不改投注协议和动画。
- 登录与资源都准备好才启用游戏；退出或销毁后不能继续激活。
- 现有重试与只读分享回放入口保留。

## Review Focus
- 资源与接口先后返回均不能提前启动。
- 资源失败不能显示可操作的盘面。
- 场景销毁后不激活，管理器不持久化。
- 动态加载路径和场景/Prefab UUID 不丢失。
- 构建和编辑器入口均为唯一游戏场景。

### Task 1: 资源和入口整理
- [x] 增加单场景、自定义 Bundle 与动态资源路径契约测试并确认失败。
- [x] 移动 res 到 resources/res（保留 meta），游戏场景移至游戏根目录；删除两个中转场景及专属脚本。
- [x] 加载管理器使用 resources，删除自定义 Bundle 配置、加载包装器及场景跳转。

### Task 2: 游戏场景启动与验证
- [x] 增加异步启动门闩行为测试：等待两个准备任务、失败不启动、销毁不启动。
- [x] 实现单场景启动、随场景生命周期的管理器、资源失败重试。
- [x] 更新构建配置及 README，执行全部测试、类型检查、Creator 实际构建和隔离 mock 浏览器验证。

## 验证记录

17 项测试通过，TypeScript 检查通过，Creator 3.8.8 实际构建成功。构建只有 main/resources/internal，launchScene 指向唯一 WBSGameScene。隔离 mock 接口下已验证登录、bets、state、GET STARTED 和盘面显示，控制台无 error；未连接真实账号或调用真实投注。场景初次迁移时与改动前字节完全一致；编辑器随后补齐 3.8.8 序列化字段，资源 meta UUID 检查无重复。
