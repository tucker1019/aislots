# AG9 幸运豹数值输入

规则及开发说明见 [AG9规则](../../slot_math/docs/ag9-rules.md)。

`base.json`、`free.json`保存中奖条件下的最终原始倍率及权重；`config.json`独立保存中奖率、触发率和五线口径。`paylines.json`保存盘面、赔付和形态参数。倍率表控制奖金，骨架数量不影响返还率。

初值参考Lua1021。`free.lua-reference.json`保留旧表，`free.proposed.json`为用户已确认且应用到`free.json`的可达替代表。四个不可达档的处理见`unreachable-report.json`。后续调参应编辑实际`base.json`、`free.json`及`config.json`，参考文件不参与开奖。
