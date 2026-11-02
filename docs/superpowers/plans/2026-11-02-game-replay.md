# 游戏动画回放 Implementation Plan

**Goal:** History 每条记录增加回放按钮，按 betId 在原 Cocos 游戏场景播放整局历史动画。

**Architecture:** 复用 slots_base.play 的转轴、消除、免费和大奖演出，独立 ReplaySession 提供历史帧，严格替代实时 spin 请求。HTML 回放控制栏负责状态与退出；History 暂时隐藏，退出后恢复列表、筛选和滚动位置。实时盘面、金额、投注档位和会话标识保留；回放不调用结算接口。

**Tech Stack:** Cocos Creator 3.8.8 / TypeScript / 原生 DOM / 现有只读 replay API。

**Spec:** 用户确认“游戏动画回放”；包括付费首转、连续消除和完整免费链。

- [x] 新增历史分页加载与可取消 ReplaySession；测试全分页、交易隔离、顺序和取消。
- [x] History 列表与加载更多均有独立回放按钮，避免嵌套 button；支持隐藏/恢复原页面。
- [x] 接入动画数据源与游戏状态快照，提供回放中/已结束/退出控制栏。
- [x] 取消时移除中奖动画回调、停止演出，等待异步播放退出后恢复真实状态；销毁场景也清理。
- [x] 验证无 spin 请求、会话 nonce 不变、完整免费播放、异常与退出恢复；类型检查、构建及浏览器实测。
