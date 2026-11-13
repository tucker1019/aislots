import { FTPlatformMgr } from "../3rd/FTPlatformMgr";

export const FTConstant = {

    GAMEID: 31017,

    BUNDLENAME: "resources",

    LOADDIR: "fortunetiger/res/load",

    PRAFAB_CELL: "res/load/prefab/games/cell",    // cell预制位置
    PRAFAB_CELL_WIN: "res/load/prefab/games/cell_win",    // cell动画预制位置
    // node:节点名字 blur_node:模糊节点 win_node：动画节点 win_anim：中线动画  idle_anim:idle动画  MULT-中线倍率
    PRAFAB_LIST: {
        1: { node: "c1", blur_node: "c1_blur", win_node: "s1", win_anim: "win", idle_anim: "win_idle", MULT: 3 },   // 橘子
        2: { node: "c2", blur_node: "c2_blur", win_node: "s2", win_anim: "win", idle_anim: "win_idle", MULT: 5 },   // 鞭炮
        3: { node: "c3", blur_node: "c3_blur", win_node: "s3", win_anim: "win", idle_anim: "win_idle", MULT: 8 },   // 红包
        4: { node: "c4", blur_node: "c4_blur", win_node: "s4", win_anim: "win", idle_anim: "win_idle", MULT: 10 },   // 福袋
        5: { node: "c5", blur_node: "c5_blur", win_node: "s5", win_anim: "win", idle_anim: "win_idle", MULT: 25 },   // 如意
        6: { node: "c6", blur_node: "c6_blur", win_node: "s6", win_anim: "win", idle_anim: "win_idle", MULT: 100 },   // 金元宝
        7: { node: "c7", blur_node: "c7_blur", win_node: "s7", win_anim: "win", idle_anim: "idle", MULT: 250 },   // WILD

        0: { node: "c0", win_node: "c0" },  // 空
    },
    CELL_SIZE: { weight: 200, height: 203 }, // 单个cell宽高
    WILD_TYPE: 7,   // wild
    CELLTYPE_ALL: [1, 2, 3, 4, 5, 6, 7], // 全部

    COL_COUNT: 3,   // 列
    ROW_COUNT: 3,   // 行
    showLineTime: 0.5,

    ALL_LINE: 5,   // 总中奖连线数
    MULT_INDEXS: [1],   // 押注倍数表  --FTGlobal.LEAVE=1/2/3为分房  分房MULT_INDEXS固定1， 不分1-10
    MULT_INDEXS_M:[1, 2, 3, 4, 5, 6, 7, 8, 9, 10],

    // languagePath: `res/load/image/language/${FTPlatformMgr.getLanguage()}/`,
    languagePath: "",
}
export enum FTSTATE {
    READY,
    RUNING,
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
    // NoSpecial = 2,  // 不含特殊图标-bonus/scatter/wheel
    // NoScatter = 3,  // 不含scatter
    // NoWheel = 4,  //   不含wheel拖拉机
}