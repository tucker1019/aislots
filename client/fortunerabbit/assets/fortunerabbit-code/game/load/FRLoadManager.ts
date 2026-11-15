import { Asset, instantiate, isValid, LoadCompleteCallback, LoadProgressCallback, Node, Prefab, resources, SpriteFrame, __private } from "cc";
import { frframe } from "../../frframe/frframe";

import { alertGame } from "../net/FRGameUI";
import { FRConstant } from "../FRConstant/FRConstant";

import { FREventName } from "../../frframe/event/FREventName";


export default class FRLoadManager {

    private static _ins: FRLoadManager = null;
    public static get ins() {
        if (this._ins == null) this._ins = new FRLoadManager();
        return this._ins;
    }
    public static set ins(_ins: FRLoadManager) {
        this._ins = _ins
    }
    private loadingLayer: Node = null;
    private netLoadingLayer: Node = null;
    private lineLayer: Node = null;


    public static rest() {
        if (isValid(FRLoadManager.ins.loadingLayer)) FRLoadManager.ins.loadingLayer.destroy()
        FRLoadManager.ins.loadingLayer = null;
        if (isValid(FRLoadManager.ins.loadingLayer)) FRLoadManager.ins.lineLayer.destroy()
        FRLoadManager.ins.lineLayer = null;
        if (isValid(FRLoadManager.ins.netLoadingLayer)) FRLoadManager.ins.netLoadingLayer.destroy();
        FRLoadManager.ins.netLoadingLayer = null;
        FRLoadManager._ins = null;
    }

    public preLoadDir<T extends Asset>(onProgress: LoadProgressCallback | null, onComplete: LoadCompleteCallback<T[]> | null) {
        resources.loadDir(FRConstant.LOADDIR, onProgress, onComplete);
    }

    public getPrefab(path: string): Prefab {
        let prefab: Prefab = frframe.res.get(path, Prefab);
        if (prefab) return prefab;
        else frframe.log.logError("getPrefab path :" + path + " error")
    }

    get<T extends Asset>(path: string, type: __private._cocos_core_asset_manager_shared__AssetType<T>): T | null {
        let asset: T = frframe.res.get(path, type);
        if (asset) return asset;
        else frframe.log.logError("get" + type + " path :" + path + " error")
    }
    getSpriteFrame(path: string): SpriteFrame {
        let asset: SpriteFrame = frframe.res.get(path, SpriteFrame);
        if (asset) return asset;
        else frframe.log.logError("getSpriteFrame" + " path :" + path + " error")
    }

    showNetLoading(tipStr?: string) {
        console.log("showNetLoading===<", this.netLoadingLayer)
        frframe.message.dispatchEvent(FREventName.SHOW_LOADING, true)
        // if (!this.netLoadingLayer) {
        //     let loadingPre = this.getPrefab(FRConstant.LOADDIR + "/prefab/loading/LoadingLayer");
        //     this.netLoadingLayer = instantiate(loadingPre)
        // }
        // console.log("showNetLoading===<===", this.netLoadingLayer, xNodeFR.find("Canvas"))
        // if (this.netLoadingLayer && xNodeFR.find("Canvas")) {

        //     this.netLoadingLayer.parent = xNodeFR.find("Canvas");
        //     setTimeout(() => {
        //         this.hideNetLoading()
        //     }, 6000);
        // }
    }
    hideNetLoading() {
        if (this.netLoadingLayer && isValid(this.netLoadingLayer)) {
            this.netLoadingLayer.removeFromParent();
        }
    }
    showLoading(tipStr?: string) {
        frframe.message.dispatchEvent(FREventName.SHOW_LOADING, true)
        // if (!this.loadingLayer) {
        //     let loadingPre = this.getPrefab(FRConstant.LOADDIR + "/prefab/loading/LoadingLayer");
        //     this.loadingLayer = instantiate(loadingPre)
        // }
        // this.loadingLayer.parent = xNodeFR.find("Canvas");
    }
    hideLoading() {
        frframe.message.dispatchEvent(FREventName.SHOW_LOADING, false)
        // if (this.loadingLayer && isValid(this.loadingLayer)) {
        //     // this.loadingLayer.removeFromParent();
        // }
    }

    async loadPrefab(path: string): Promise<Prefab> {
        return new Promise((reject) => {
            resources.load(path, Prefab, (err: Error, asset: Prefab) => {
                if (err) {
                    frframe.log.logError("loadPrefab" + " path :" + path + " error")
                }
                reject(asset)
            })
        })
    }

    showGetPrefab(path: string, parent: Node): Node {
        let prefab: Prefab = frframe.res.get(path, Prefab);
        if (!prefab) {

            frframe.log.logError("showGetPrefab" + " path :" + path + " error")
            return;
        }
        let node: Node = instantiate(prefab);
        node.parent = parent;
        return node
    }

    async showPrefabWithLoading(path: string, parent: Node) {
        this.showLoading();
        let prefab: Prefab = await this.loadPrefab(path);
        this.hideLoading();
        if (!prefab) return;
        let node: Node = instantiate(prefab);
        node.parent = parent;
    }

    showAlertWithInit(message: string, confirm?: () => void, cancel?: () => void) {
        alertGame(message, confirm, cancel);
    }
}
