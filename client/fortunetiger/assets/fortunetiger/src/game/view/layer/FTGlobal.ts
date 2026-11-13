import { isWeb } from "../../common/FTUtils";



export let FTGlobal = {
    COUNTRYCODE: "ID",
    ADAPTATION: 1,
    wss: "",
    LEAVE: 0,
    CV: null,
    APPNAME: null,
    LANG: "en",
    MODE: "real",
    PLATFORM: "mobile",
    APPID: null,
    NET: "3",//1 公司内网，2 平台测试外网 3 平台外网
    enterTime: 0,
    webEnv: "master",
    USER: {
        uid: "",
        accessToken: "",
        avatar: "",
        gold: 0,
        beforeGold: 0,
        experienceGold: 10000000
    },
    isDecimals: 0,
    IS_WEB: isWeb(), // 是否是web端, false为测试平台APK
    coinType: 1,
    coinSymbol: "R$",
    debugLog: true,
    playerType: 1,
    env: "master",
    isPoint:0,
}

