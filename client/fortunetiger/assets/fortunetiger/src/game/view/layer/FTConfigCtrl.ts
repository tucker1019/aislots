import { _decorator, sys } from 'cc';
import { FTPlatformMgr } from '../../3rd/FTPlatformMgr';
import { FTGlobal } from './FTGlobal';
import { En, Pt } from './FTLanguage';
const { ccclass, property } = _decorator;

let GameKey = {
    MUSIC: "hd_music",
    EFFECT: "hd_effect",
    LANGUAGE: "hd_language",
    SHAKE: "hd_shake",
}

export enum Language {
    EN = "en",
    PT = "br"
}

export class FTConfigCtrl {
    private static _instance: FTConfigCtrl = null

    public static get Instance(): FTConfigCtrl {

        if (FTConfigCtrl._instance == null) {
            FTConfigCtrl._instance = new FTConfigCtrl()
        }
        return FTConfigCtrl._instance
    }

    getBooleanValue(key): boolean {
        let value = this.getKey(key)
        if (value == null || value == "true" || value == "") {
            return true
        }
        return false
    }

    isOpenMusic(): boolean {
        return this.getBooleanValue(GameKey.MUSIC)
    }

    isOpenEffect(): boolean {
        return this.getBooleanValue(GameKey.EFFECT)
    }

    isOpenShake(): boolean {
        return this.getBooleanValue(GameKey.SHAKE)
    }

    setOpenMusic(isOpen) {
        this.setKey(GameKey.MUSIC, isOpen)
    }

    setOpenEffect(isOpen) {
        this.setKey(GameKey.EFFECT, isOpen)
    }

    setOpenShade(isOpen) {
        this.setKey(GameKey.SHAKE, isOpen)
    }

    private getKey(key) {
        return sys.localStorage.getItem(key)
    }



    setLanguage(lang: Language) {
        this.setKey(GameKey.LANGUAGE, lang)
    }


    // 是否时葡萄牙语
    isPT() {
        // console.log("==========>",FTPlatformMgr.getLanguage())
        return FTPlatformMgr.getLanguage() == Language.PT
    }

    private setKey(key, value) {
        sys.localStorage.setItem(key, value)
    }

    // FTLanguage.settting
    getLanguageText(key): string {
        let languageDict = En;
        if (this.isPT()) {
            languageDict = Pt
        }

        return languageDict[key]
    }

}

