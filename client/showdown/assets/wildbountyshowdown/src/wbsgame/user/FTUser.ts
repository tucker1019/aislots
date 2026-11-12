import { consoleLog } from "../../xtools/WBSUtils";
import { WBSConfig } from "../cfg/WBSConfig";
import { wbsgame } from "../wbsgame"

type IUser = {
    uid: string,
    accessToken: string,
    gold: number,
    fastSwitch: boolean,
    localBetIndex: number,
    localBetLevelIndex: number,
    musicSwitch: boolean,
    soundSwitch: boolean
}

export default class FTUser {

    private static user: IUser = {
        uid: null,
        accessToken: null,
        gold: 0,
        fastSwitch: false,
        localBetIndex: null,
        localBetLevelIndex: null,
        musicSwitch: true,
        soundSwitch: true,
    }
    public static init(uid: string, accessToken: string) {
        this.user.uid = uid;
        this.user.accessToken = accessToken;
        this.user.fastSwitch = wbsgame.storageMgr.get("fast", "false") == "true";
        this.user.localBetIndex = Number(wbsgame.storageMgr.get(`${WBSConfig.roomLevel}_localBetIndex`, -1));
        this.user.localBetLevelIndex = Number(wbsgame.storageMgr.get(`${WBSConfig.roomLevel}_localBetLevel`, 0));
        this.user.musicSwitch = wbsgame.storageMgr.get("music", "true") == "true";
        this.user.soundSwitch = wbsgame.storageMgr.get("sound", "true") == "true";
        consoleLog(`userinfo`, this.user)
    }


    public static getUid(): string {
        return this.user.uid
    }

    public static getToken(): string {
        return this.user.accessToken
    }
    public static getCoin(): number {
        return this.user.gold
    }
    public static setCoin(gold: number) {
        consoleLog(`金币变动 gold=${gold}`)
        this.user.gold = gold
    }
    public static getFastSwitch(): boolean {
        return this.user.fastSwitch;
    }
    public static setFastSwitch(fast: boolean) {
        this.user.fastSwitch = fast;
        wbsgame.storageMgr.set("fast", fast)
    }
    public static getLocalBetIndex() {
        return this.user.localBetIndex;
    }
    public static getLocalBetLevel() {
        return this.user.localBetLevelIndex;
    }

}