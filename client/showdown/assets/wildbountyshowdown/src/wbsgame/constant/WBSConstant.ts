import { WBSLanguage } from "../common/WBSlanguage";

export const WBSConstant = {


    GAMEID: "AG3",

    BUNDLENAME: "szcw_1068wildbountyshowdown",

    LOADDIR: "res/load",
    SOUND_PARH: "res/load/sound",

    SIGLETIME: 0.05,

    WILD_TYPE: 9,
    SCATTER_TYPE: 10,

    // ROW_COUNT: 3,
    COL_COUNT: 6,
    MAX_COUNT: 5,
    COL_COUNT_LIST: [3, 4, 5, 5, 4, 3],
    CELL_SIZE: { weight: 125, height: 125 }, // 单个cell宽高
    RANDOM_NOR: [1, 2, 3, 4, 5, 6, 7, 8],
    // RANDOM_MULT: [100, 200, 300, 500, 1000],

    ALL_WIN_MULTS: [512, 1024, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
    INDICES: [
        [0, 6, 12],
        [1, 7, 13, 18],
        [2, 8, 14, 19, 22],
        [3, 9, 15, 20, 23],
        [4, 10, 16, 21],
        [5, 11, 17]
    ],

    ALL_LINE: 20, // 总中奖连线数
    MULT_INDEXS: [1],   // 押注倍数表  --FTGlobal.LEAVE=1/2/3为分房  分房MULT_INDEXS固定1， 不分1-10
    MULT_INDEXS_M: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],

    //游戏图标类型 1=人头 2=枪 3=帽子 4=酒 5=A 6=K 7=Q 8=J 9=百搭 10=分散金块  1000+id代表带金框的图标 比如1001就表示金框人头
    PAYLOT_LIST: {
        1: [10, 20, 30, 50], 2: [8, 15, 20, 30], 3: [5, 10, 15, 20], 4: [5, 10, 15, 20], 5: [2, 4, 6, 10], 6: [2, 4, 6, 10], 7: [1, 2, 3, 5], 8: [1, 2, 3, 5], 9: WBSLanguage.Info_Wild_Symbol, 10: WBSLanguage.Info_Scatter_Symbol
    }
}
export enum WBSSTATE {
    READY,
    RUNING,
    FREEING,
    STEELE,
}
