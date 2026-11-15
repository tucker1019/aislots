import { _decorator, sys } from 'cc';

const { ccclass, property } = _decorator;

let GameKey = {
    MUSIC: "hd_music",
    EFFECT: "hd_effect",
    LANGUAGE: "hd_language",
    SHAKE: "hd_shake",
}

export enum Language {
    EN = "en",
    PT = "br",
    ID = "id",
}

export class FRConfigCtrl {
    private static _instance: FRConfigCtrl = null

    public static get Instance(): FRConfigCtrl {

        if (FRConfigCtrl._instance == null) {
            FRConfigCtrl._instance = new FRConfigCtrl()
        }
        return FRConfigCtrl._instance
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



    private setKey(key, value) {
        sys.localStorage.setItem(key, value)
    }

 

}

