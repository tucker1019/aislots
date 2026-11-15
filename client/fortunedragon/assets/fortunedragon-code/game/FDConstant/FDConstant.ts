
export const FDConstant = {
    GOLDFLYCONFIG: [
        { num: 11, time: 0.12, max: 20000 },
        { num: 18, time: 0.07, max: 100000 },
        { num: 25, time: 0.05 },
    ],
    GAMEID: 31048,

    BUNDLENAME: "resources",

    LOADDIR: "res/load",

    PRAFAB_CELL: "res/load/prefab/games/cell",    // cell预制位置
    PRAFAB_CELL_WIN: "res/load/prefab/games/cell_win",    // cell动画预制位置
    // nor_spr:默认图片 blur_spr:模糊图片 atlas:图片图集  win_node：动画节点 win_anim：中线动画 
    PRAFAB_LIST: {
        1: { nor_spr: "h1_coins", blur_spr: "h1_coins_blur", win_node: "h1", shadow_winnode: "h1_s", win_anim: "win", winidle_anim:"win_idle",spawn_anim: "spawn", shadow_winanim: "spawn", MULT: 2 },
        2: { nor_spr: "h2_ribbon", blur_spr: "h2_ribbon_blur", win_node: "h2", shadow_winnode: "h2_s", win_anim: "win", winidle_anim:"win_idle", spawn_anim: "spawn",shadow_winanim: "spawn",  MULT: 3 },
        3: { nor_spr: "h3_firecracker", blur_spr: "h3_firecracker_blur", win_node: "h3", shadow_winnode: "h3_s", win_anim: "win", winidle_anim:"win_idle", spawn_anim: "spawn",shadow_winanim: "spawn",  MULT: 5 },
        4: { nor_spr: "h4_lantern", blur_spr: "h4_lantern_blur", win_node: "h4", shadow_winnode: "h4_s", win_anim: "win", winidle_anim:"win_idle", spawn_anim: "spawn", shadow_winanim: "spawn", MULT: 10 },
        5: { nor_spr: "h5_angbao", blur_spr: "h5_angbao_blur", win_node: "h5", shadow_winnode: "h5_s", win_anim: "win", winidle_anim:"win_idle", spawn_anim: "spawn", shadow_winanim: "spawn", MULT: 25 },
        6: { nor_spr: "h6_ingot", blur_spr: "h6_ingot_blur", win_node: "h6", shadow_winnode: "h6_s", win_anim: "win", winidle_anim:"win_idle", spawn_anim: "spawn",shadow_winanim: "spawn",  MULT: 50 },
        7: { nor_spr: "s_wild", blur_spr: "s_wild_blur", win_node: "s_wild",shadow_winnode:"", win_anim: "win", winidle_anim:"win_idle", spawn_anim: "spawn", idle_anim: "idle",  MULT: 100 }, // wild

        0: { node: "c0", win_node: "c0" },  // 空
    },
    CELL_SIZE: { weight: 210, height: 204 }, // 单个cell宽高
    WILD_TYPE: 7,   // wild
    // FCRACKER_TYPE:3,    // 鞭炮
    CELLTYPE_ALL: [1, 2, 3, 4, 5, 6, 7], // 全部

    COL_COUNT: 3,   // 列
    ROW_COUNT: 3,   // 行
    showLineTime: 0.5,

    SCATTER_TYPE: 1,

    ALL_LINE: 5,   // 总中奖连线数
    MULT_INDEXS: [1],   // 押注倍数表  --FDGlobal.LEAVE=1/2/3为分房  分房MULT_INDEXS固定1， 不分1-10
    MULT_INDEXS_M: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],

    // languagePath: `res/load/image/language/${FDGlobal.LANG}/`,
    languagePath: "",
}
export enum FDSTATE {
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