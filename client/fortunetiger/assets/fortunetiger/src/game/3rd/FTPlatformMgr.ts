import { _decorator, Component, director, Node, sys } from 'cc';
import { FTGameConstants } from '../view/layer/FTGameConstants';
import { FTGlobal } from '../view/layer/FTGlobal';
import GameBridge from '../../../../game.bridge';
import { DEV } from 'cc/env';
import { debugLog } from '../common/FTUtils';
// import { FTGlobal_ma } from '../../../../main';




const { ccclass, property } = _decorator;

export class FTPlatformMgr {

    // 退出到平台大厅
    public static exitToPlatform() {
        debugLog("退出到平台大厅")
        if (DEV) return;
        GameBridge.callNoReturnValue("BACK_TO_CHALL");
    }


    // 退出到登录界面
    public static exitToLogin() {
        debugLog("退出到登录界面")
        if (DEV) return;
        GameBridge.callNoReturnValue('BACK_TO_LOGIN');
    }



    public static getWsUrl() {
        // return "ws://10.223.5.109:11016"
       // return "ws://10.223.5.109:11016"
       if (FTGlobal.COUNTRYCODE == "MX") {
        if (FTGlobal.env == "master") {
           return "wss://service.playsmx.com/wss/web"
        } else {
            return "wss://testservice.playsmx.com/wss/web"
        }
    }
    if (FTGlobal.COUNTRYCODE == "ID") {
        if (FTGlobal.env == "master") {
            return "wss://service.ipe7ct.com/wss/web"
        } else {
            return "wss://testservice.ab3.bet/wss/web"
        }
    }
    }

    public static getLanguage() {
        return FTGlobal.LANG

    }
    public static refreshCoin(value: number = FTGlobal.USER.gold) {
        if (DEV) return;
        GameBridge.callNoReturnValue('REFRESH_COIN', { value });
    }
    public static loadingHide() {
        if (DEV) return;
        GameBridge.callNoReturnValue('LOADING_HIDE');
    }
       // 游戏支付
       public static pay(openType: number = 1) {
        if (DEV) return
        GameBridge.callNoReturnValue('TO_CHARGE', { openType });
    }

    // 游戏支付
    public static toVip() {
        if (DEV) return
        GameBridge.callNoReturnValue('TO_VIP');
    }
    public static onRegisterPlayTypeUpdate() {
        if (DEV) return;
        GameBridge.on("PLAY_TYPE_UPDATE", (data: any) => {
            FTGlobal.playerType = data.playerType;
        });
    }

}

