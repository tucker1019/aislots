# 邀请奖励宝箱

使用内置 imagegen 生成三张独立透明底图片，无文字、无品牌，中文和英文共用。

- `public/assets/lobby/chests/locked.webp`：银灰色关闭宝箱，未达标。
- `public/assets/lobby/chests/claimable.webp`：金色关闭宝箱，可领取。
- `public/assets/lobby/chests/claimed.webp`：打开的宝箱，已领取。

最终尺寸 192×192 WebP（保留 alpha），页面显示40×40，服务端状态仍决定领取能力。可领取状态使用1.8秒轻微呼吸动画，系统减少动态效果时关闭动画。领取中的禁用状态不播放呼吸动画。

共用提示词：isolated premium 3D mobile game treasure chest icon, square canvas, true transparent background, no text/logo/base plate; compact rounded chunky chest, front three-quarter view facing slightly right, centered, 10% transparent padding; polished clean edges, readable at40px, matching camera/design.

状态差异：locked为银灰金属+蓝灰箱体、关闭银锁扣、无光；claimable为金色金属+蓝宝石蓝箱体、轻微金币与两颗光点；claimed为同款金蓝箱体打开约65度、空箱内深青衬里、无金币无光晕。
