import { isWeb } from "../../common/FCUtils";



export let FCGlobal = {
    ADAPTATION: 1,
    wss: "",
    isDecimals: 1,
    LEAVE: 0,
    CV: null,
    APPNAME: null,
    LANG: "en-US",
    MODE: "real",
    PLATFORM: "mobile",
    APPID: null,
    NET: "3",//1 公司内网，2 平台测试外网 3 平台外网
    webEnv: "master",
    enterTime: 0,
    GameTax: 100,
    USER: {
        uid: "",
        accessToken: "",
        avatar: "",
        gold: 0,
        beforeGold: 0,
        experienceGold: 10000000
    },
    COUNTRYCODE: "ID",
    IS_WEB: isWeb(), // 是否是web端, false为测试平台APK
    coinType: 1,
    coinSymbol: "R$",
    debugLog: true,
    env: "master",
    playerType: 1,
    isPoint:0,
}

