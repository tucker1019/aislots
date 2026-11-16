import { Asset, assetManager, AssetManager, director, ImageAsset, instantiate, isValid, LoadCompleteCallback, LoadProgressCallback, Node, Prefab, SceneAsset, SpriteFrame, Texture2D, __private } from "cc";
import { fmframe } from "../../fmframe/fmframe";

import { xNodeFM } from "../../xtools/xNodeFM";
import { FMConstant } from "../FMConstant/FMConstant";

import { alertGame } from "../net/FMGameUI";
import { FMEventManager } from "../../fmframe/event/FMEventManager";
import { FMEventName } from "../../fmframe/event/FMEventName";
import { FMGlobal } from "../view/layer/FMGlobal";


export default class FMLoadManager {

    private static _ins: FMLoadManager = null;
    public static get ins() {
        if (this._ins == null) this._ins = new FMLoadManager();
        return this._ins;
    }
    public static set ins(_ins: FMLoadManager) {
        this._ins = _ins
    }
    private bundle: AssetManager.Bundle = null;
    private loadingLayer: Node = null;
    private netLoadingLayer: Node = null;
    private lineLayer: Node = null;


    public static rest() {
        FMLoadManager._ins = null;
    }

    public init(): boolean {
        this.bundle = assetManager.getBundle(FMConstant.BUNDLENAME);
        return this.bundle != null;
    }

    public preLoadDir<T extends Asset>(onProgress: LoadProgressCallback | null, onComplete: LoadCompleteCallback<T[]> | null) {
        fmframe.res.loadDir(FMConstant.BUNDLENAME, FMConstant.LOADDIR, onProgress, onComplete);
    }

    public getPrefab(path: string): Prefab {
        let prefab: Prefab = fmframe.res.get(path, Prefab, FMConstant.BUNDLENAME);
        if (prefab) return prefab;
        else fmframe.log.logError("getPrefab path :" + path + " error")
    }

    get<T extends Asset>(path: string, type: __private._cocos_core_asset_manager_shared__AssetType<T>): T | null {
        let asset: T = fmframe.res.get(path, type, FMConstant.BUNDLENAME);
        if (asset) return asset;
        else fmframe.log.logError("get" + type + " path :" + path + " error")
    }
    getSpriteFrame(path: string): SpriteFrame {
        let asset: SpriteFrame = fmframe.res.get(path, SpriteFrame, FMConstant.BUNDLENAME);
        if (asset) return asset;
        else fmframe.log.logError("getSpriteFrame" + " path :" + path + " error")
    }

    public loadScene(sceneName: string) {
        this.bundle.loadScene(sceneName, (err: Error, scene: SceneAsset) => {
            if (err) {
                fmframe.log.logError(sceneName, "Gagal Memuat")
            }
            director.runScene(scene);
        })
    }

    showNetLoading(tipStr?: string) {
        console.log("showNetLoading===<", this.netLoadingLayer)
        fmframe.message.dispatchEvent(FMEventName.SHOW_LOADING, true)
        // if (!this.netLoadingLayer) {
        //     let loadingPre = this.getPrefab(FMConstant.LOADDIR + "/prefab/loading/LoadingLayer");
        //     this.netLoadingLayer = instantiate(loadingPre)
        // }
        // console.log("showNetLoading===<===", this.netLoadingLayer, xNodeFM.find("Canvas"))
        // if (this.netLoadingLayer && xNodeFM.find("Canvas")) {

        //     this.netLoadingLayer.parent = xNodeFM.find("Canvas");
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
        fmframe.message.dispatchEvent(FMEventName.SHOW_LOADING, true)
        // if (!this.loadingLayer) {
        //     let loadingPre = this.getPrefab(FMConstant.LOADDIR + "/prefab/loading/LoadingLayer");
        //     this.loadingLayer = instantiate(loadingPre)
        // }
        // this.loadingLayer.parent = xNodeFM.find("Canvas");
    }
    hideLoading() {
        fmframe.message.dispatchEvent(FMEventName.SHOW_LOADING, false)
        // if (this.loadingLayer && isValid(this.loadingLayer)) {
        //     // this.loadingLayer.removeFromParent();
        // }
    }

    async loadPrefab(path: string): Promise<Prefab> {
        return new Promise((reject) => {
            fmframe.res.load(FMConstant.BUNDLENAME, path, Prefab, (err: Error, asset: Prefab) => {
                if (err) {
                    fmframe.log.logError("loadPrefab" + " path :" + path + " error")
                }
                reject(asset)
            })
        })
    }

    showGetPrefab(path: string, parent: Node): Node {
        let prefab: Prefab = fmframe.res.get(path, Prefab, FMConstant.BUNDLENAME);
        if (!prefab) {

            fmframe.log.logError("showGetPrefab" + " path :" + path + " error")
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

    async showAlertWithInit(tip: string, yes?: () => void, no?: () => void) {
        return alertGame(tip, yes, no);
    }
}
