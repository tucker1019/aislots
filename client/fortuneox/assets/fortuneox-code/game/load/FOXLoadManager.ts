import { Asset, assetManager, AssetManager, director, ImageAsset, instantiate, isValid, LoadCompleteCallback, LoadProgressCallback, Node, Prefab, SceneAsset, SpriteFrame, Texture2D, __private } from "cc";
import { foxframe } from "../../foxframe/foxframe";

import { xNodeFOX } from "../../xtools/xNodeFOX";
import { FOXConstant } from "../FOXConstant/FOXConstant";

import { FOXEventManager } from "../../foxframe/event/FOXEventManager";
import { FOXEventName } from "../../foxframe/event/FOXEventName";


export default class FOXLoadManager {

    private static _ins: FOXLoadManager = null;
    public static get ins() {
        if (this._ins == null) this._ins = new FOXLoadManager();
        return this._ins;
    }
    public static set ins(_ins: FOXLoadManager) {
        this._ins = _ins
    }
    private bundle: AssetManager.Bundle = null;
    private loadingLayer: Node = null;
    private netLoadingLayer: Node = null;
    private lineLayer: Node = null;


    public static rest() {
        FOXLoadManager.ins.bundle = null;
        if (isValid(FOXLoadManager.ins.loadingLayer)) FOXLoadManager.ins.loadingLayer.destroy()
        FOXLoadManager.ins.loadingLayer = null;
        if (isValid(FOXLoadManager.ins.loadingLayer)) FOXLoadManager.ins.lineLayer.destroy()
        FOXLoadManager.ins.lineLayer = null;
        if (isValid(FOXLoadManager.ins.netLoadingLayer)) FOXLoadManager.ins.netLoadingLayer.destroy();
        FOXLoadManager.ins.netLoadingLayer = null;
        FOXLoadManager._ins = null;
    }

    public init(): boolean {
        this.bundle = assetManager.getBundle(FOXConstant.BUNDLENAME);
        return this.bundle != null;
    }

    public preLoadDir<T extends Asset>(onProgress: LoadProgressCallback | null, onComplete: LoadCompleteCallback<T[]> | null) {
        foxframe.res.loadDir(FOXConstant.BUNDLENAME, FOXConstant.LOADDIR, onProgress, onComplete);
    }

    public getPrefab(path: string): Prefab {
        let prefab: Prefab = foxframe.res.get(path, Prefab, FOXConstant.BUNDLENAME);
        if (prefab) return prefab;
        else foxframe.log.logError("getPrefab path :" + path + " error")
    }

    get<T extends Asset>(path: string, type: __private._cocos_core_asset_manager_shared__AssetType<T>): T | null {
        let asset: T = foxframe.res.get(path, type, FOXConstant.BUNDLENAME);
        if (asset) return asset;
        else foxframe.log.logError("get" + type + " path :" + path + " error")
    }
    getSpriteFrame(path: string): SpriteFrame {
        let asset: SpriteFrame = foxframe.res.get(path, SpriteFrame, FOXConstant.BUNDLENAME);
        if (asset) return asset;
        else foxframe.log.logError("getSpriteFrame" + " path :" + path + " error")
    }

    public loadScene(sceneName: string) {
        this.bundle.loadScene(sceneName, (err: Error, scene: SceneAsset) => {
            if (err) {
                foxframe.log.logError(sceneName, "加载失败")
            }
            director.runScene(scene);
        })
    }

    showNetLoading(tipStr?: string) {
        console.log("showNetLoading===<", this.netLoadingLayer)
        foxframe.message.dispatchEvent(FOXEventName.SHOW_LOADING, true)
        // if (!this.netLoadingLayer) {
        //     let loadingPre = this.getPrefab(FOXConstant.LOADDIR + "/prefab/loading/LoadingLayer");
        //     this.netLoadingLayer = instantiate(loadingPre)
        // }
        // console.log("showNetLoading===<===", this.netLoadingLayer, xNodeFOX.find("Canvas"))
        // if (this.netLoadingLayer && xNodeFOX.find("Canvas")) {

        //     this.netLoadingLayer.parent = xNodeFOX.find("Canvas");
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
        foxframe.message.dispatchEvent(FOXEventName.SHOW_LOADING, true)
        // if (!this.loadingLayer) {
        //     let loadingPre = this.getPrefab(FOXConstant.LOADDIR + "/prefab/loading/LoadingLayer");
        //     this.loadingLayer = instantiate(loadingPre)
        // }
        // this.loadingLayer.parent = xNodeFOX.find("Canvas");
    }
    hideLoading() {
        foxframe.message.dispatchEvent(FOXEventName.SHOW_LOADING, false)
        // if (this.loadingLayer && isValid(this.loadingLayer)) {
        //     // this.loadingLayer.removeFromParent();
        // }
    }

    async loadPrefab(path: string): Promise<Prefab> {
        return new Promise((reject) => {
            foxframe.res.load(FOXConstant.BUNDLENAME, path, Prefab, (err: Error, asset: Prefab) => {
                if (err) {
                    foxframe.log.logError("loadPrefab" + " path :" + path + " error")
                }
                reject(asset)
            })
        })
    }

    showGetPrefab(path: string, parent: Node): Node {
        let prefab: Prefab = foxframe.res.get(path, Prefab, FOXConstant.BUNDLENAME);
        if (!prefab) {

            foxframe.log.logError("showGetPrefab" + " path :" + path + " error")
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

}
