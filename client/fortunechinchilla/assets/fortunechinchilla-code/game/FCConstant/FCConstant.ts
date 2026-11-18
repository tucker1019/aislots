import { FCPlatformMgr } from "../3rd/FCPlatformMgr";

export const FCConstant = {
    GOLDFLYCONFIG: [
        { num: 11, time: 0.12, max: 20000 },
        { num: 18, time: 0.07, max: 100000 },
        { num: 25, time: 0.05 },
    ],
    GAMEID: 31022,


    LOADDIR: "res/load",

    PRAFAB_CELL: "res/load/prefab/games/cell",    // cell预制位置
    PRAFAB_CELL_WIN: "res/load/prefab/games/cell_win",    // cell动画预制位置
    // node:节点名字 blur_node:模糊节点 win_node：动画节点 win_anim：中线动画  idle_anim:idle动画  MULT-中线倍率
    PRAFAB_LIST: {
        1: { node: "c1", blur_node: "c1_blur", win_node: "s1", win_anim: "win", stop_anim: "spawn", MULT: 2 },   // 橘子
        2: { node: "c2", blur_node: "c2_blur", win_node: "s2", win_anim: "win", stop_anim: "spawn", MULT: 3 },   // 鞭炮
        3: { node: "c3", blur_node: "c3_blur", win_node: "s3", win_anim: "win", stop_anim: "spawn", MULT: 5 },   // 红包
        4: { node: "c4", blur_node: "c4_blur", win_node: "s4", win_anim: "win", stop_anim: "spawn", MULT: 10 },   // 福袋
        5: { node: "c5", blur_node: "c5_blur", win_node: "s5", win_anim: "win", stop_anim: "spawn", MULT: 50 },   // 如意
        6: { node: "c6", blur_node: "c6_blur", win_node: "s6", win_anim: "win", stop_anim: "spawn", MULT: 100 },   // 金元宝
        7: { node: "c7", blur_node: "c7_blur", win_node: "s7", win_anim: "win", stop_anim: "spawn", idle_anim: "idle", MULT: 200 },   // WILD
        11: { node: "c8", BONUS_MULT: 0.5 },
        12: { node: "c8", BONUS_MULT: 1 },
        13: { node: "c8", BONUS_MULT: 2 },
        14: { node: "c8", BONUS_MULT: 5 },
        15: { node: "c8", BONUS_MULT: 10 },
        16: { node: "c8", BONUS_MULT: 20 },
        17: { node: "c8", BONUS_MULT: 50 },
        18: { node: "c8", BONUS_MULT: 100 },
        19: { node: "c8", BONUS_MULT: 200 },
        20: { node: "c8", BONUS_MULT: 500 },

        0: { node: "s_blank", blur_node: "s_blank_blur", win_node: "c0" },  // bonus空
        10: { node: "s_blank", blur_node: "s_blank_blur", win_node: "c0" },  // bonus空
    },
    CELL_SIZE: { weight: 198, height: 178 }, // 单个cell宽高
    WILD_TYPE: 7,   // wild
    BONUS_TYPE: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],   // bonus
    EMPTY_TYPE: 10, // 空

    CELLTYPE_ALL: [1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 7,], // 全部
    CELLTYPE_SPECIAL: [11, 11, 11, 12, 12, 13, 14, 15, 16, 17, 18, 19, 20, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,],

    COL_COUNT: 3,   // 列
    ROW_COUNT: 4,   // 行
    ROW_REAL_COUNT: [3, 4, 3],  // 实际显示行
    showLineTime: 0.5,

    // BONUS_MULT: [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500,], // bonus数值显示--总押注的倍率


    ALL_LINE: 10,   // 总中奖连线数
    MULT_INDEXS: [1],   // 押注倍数表  --FCGlobal.LEAVE=1/2/3为分房  分房MULT_INDEXS固定1， 不分1-10
    MULT_INDEXS_M:[1, 2, 3, 4, 5, 6, 7, 8, 9, 10],

    // languagePath: `res/load/image/language/${FCPlatformMgr.getLanguage()}/`,
    languagePath: "",
}
export enum FCSTATE {
    READY,
    RUNNING,
    FREEING,
    BONUS,
    // SPECIAL,
}
export enum WINTYPE {
    BIGWIN,
    HAPPYDUCK,
    OVERALL,

}

export enum RandomCellType {
    All = 1,    // 所有图标
    BONUS = 2,
    EMPTY = 3,
    // NoSpecial = 2,  // 不含特殊图标-bonus/scatter/wheel
    // NoScatter = 3,  // 不含scatter
    // NoWheel = 4,  //   不含wheel拖拉机
}