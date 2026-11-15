/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-01-12 17:12:14
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-01-12 17:39:14
 * @FilePath: /1048FortuneDragon/assets/fortunedragon/src/game/view/layer/FDGlobal.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

import { ResolutionPolicy } from "cc";

export let FDGlobal = {
    ADAPTATION: ResolutionPolicy.FIXED_WIDTH,
    debugLog: true,
    wss: null,
    CV: null,
    LANG: "en",
    APPID: null,
    GameTax: 100,
    COUNTRYCODE: "ID",
    env: "test",
    USER: {
        uid: "",
        accessToken: "",
        gold: 0,
    },
    GameName:"Fortune Dragon",
}
