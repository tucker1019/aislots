# 紫晶电玩厅宝箱

手绘 SVG 源文件与运行时透明 WebP 对应：

- `locked`：柔紫箱体、浅金包边、闭盖与挂锁。
- `claimable`：亮紫箱体、糖果金包边、开盖金币与星光。
- `claimed`：淡紫包边、开盖空箱；完成勾选由现有页面组件显示。

配色沿用大厅 `#21103D`、`#9655FF`、`#FFD15C`。WebP 保持 192×192、透明背景，页面继续按 40×40 显示，不修改领取逻辑。

重建：`node slots_lobby/design-assets/chests/build.mjs /absolute/path/to/sharp`。
`sharp` 仅用于离线素材导出，不是大厅运行依赖。无参数时使用当前环境已安装的 `sharp`。
