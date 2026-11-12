import { Component, View, _decorator } from "cc";
import { WBSGameManager } from "./mgr/WBSGameManager";
import { WBSLoadManager } from "./mgr/WBSLoadManager";
import { WBSPoolManager } from "./mgr/WBSPoolManager";
import { WBSSendManager } from "./mgr/WBSSendManager";
import { WBSStorageManager } from "./mgr/WBSStorageManager";
import { WBSEventManager } from "./mgr/WBSEventManager";
import { WBSAudioManager } from "./mgr/WBSAudioManager";
import { WBSViewManager } from "./mgr/WBSViewManager";
import { WBSPlatformMgr } from "./mgr/WBSPlatformMgr";
import { WBSGameLayer } from "./view/WBSGameLayer";
const { ccclass } = _decorator;
@ccclass('wbsgame')
export class wbsgame extends Component {

    static gameMgr: WBSGameManager;
    static loadMgr: WBSLoadManager;
    static poolMgr: WBSPoolManager;
    static sendMgr: WBSSendManager;
    static platformMgr: WBSPlatformMgr;
    static storageMgr: WBSStorageManager;
    static message: WBSEventManager;
    static audioMgr: WBSAudioManager;
    static viewMgr: WBSViewManager;
    static gamelayer: WBSGameLayer;


    protected onLoad(): void {

        wbsgame.gameMgr = this.addComponent(WBSGameManager);
        wbsgame.loadMgr = this.addComponent(WBSLoadManager);
        wbsgame.poolMgr = this.addComponent(WBSPoolManager);
        wbsgame.sendMgr = this.addComponent(WBSSendManager);
        wbsgame.platformMgr = this.addComponent(WBSPlatformMgr);
        wbsgame.storageMgr = this.addComponent(WBSStorageManager);
        wbsgame.message = this.addComponent(WBSEventManager);
        wbsgame.audioMgr = this.addComponent(WBSAudioManager);
        wbsgame.viewMgr = this.addComponent(WBSViewManager);


    }

    rest() {
        this.node.destroy();
    }
}