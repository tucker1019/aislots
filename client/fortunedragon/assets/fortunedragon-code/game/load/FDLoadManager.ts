import { Asset, assetManager, AssetManager, director, instantiate, LoadCompleteCallback, LoadProgressCallback, Node, Prefab, SceneAsset, SpriteFrame, __private } from "cc";
import { fdframe } from "../../fdframe/fdframe";

import { FDConstant } from "../FDConstant/FDConstant";

import { FDEventName } from "../../fdframe/event/FDEventName";


export default class FDLoadManager {

    private static _ins: FDLoadManager = null;
    public static get ins() {
        if (this._ins == null) this._ins = new FDLoadManager();
        return this._ins;
    }
    public static set ins(_ins: FDLoadManager) {
        this._ins = _ins
    }
    private bundle: AssetManager.Bundle = null;
    public static rest() {
        FDLoadManager._ins = null;
    }

    public init(): boolean {
        this.bundle = assetManager.getBundle(FDConstant.BUNDLENAME);
        return this.bundle != null;
    }

    public preLoadDir<T extends Asset>(onProgress: LoadProgressCallback | null, onComplete: LoadCompleteCallback<T[]> | null) {
        fdframe.res.loadDir(FDConstant.BUNDLENAME, FDConstant.LOADDIR, onProgress, onComplete);
    }

    public getPrefab(path: string): Prefab {
        let prefab: Prefab = fdframe.res.get(path, Prefab, FDConstant.BUNDLENAME);
        if (prefab) return prefab;
        else fdframe.log.logError("getPrefab path :" + path + " error")
    }

    get<T extends Asset>(path: string, type: __private._cocos_core_asset_manager_shared__AssetType<T>): T | null {
        let asset: T = fdframe.res.get(path, type, FDConstant.BUNDLENAME);
        if (asset) return asset;
        else fdframe.log.logError("get" + type + " path :" + path + " error")
    }
    getSpriteFrame(path: string): SpriteFrame {
        let asset: SpriteFrame = fdframe.res.get(path, SpriteFrame, FDConstant.BUNDLENAME);
        if (asset) return asset;
        else fdframe.log.logError("getSpriteFrame" + " path :" + path + " error")
    }

    public loadScene(sceneName: string) {
        this.bundle.loadScene(sceneName, (err: Error, scene: SceneAsset) => {
            if (err) {
                fdframe.log.logError(sceneName, "Gagal Memuat")
            }
            director.runScene(scene);
        })
    }

    showLoading() {
        fdframe.message.dispatchEvent(FDEventName.SHOW_LOADING, true);
    }
    hideLoading() {
        fdframe.message.dispatchEvent(FDEventName.SHOW_LOADING, false);
    }

    async loadPrefab(path: string): Promise<Prefab> {
        return new Promise((reject) => {
            fdframe.res.load(FDConstant.BUNDLENAME, path, Prefab, (err: Error, asset: Prefab) => {
                if (err) {
                    fdframe.log.logError("loadPrefab" + " path :" + path + " error")
                }
                reject(asset)
            })
        })
    }

    showGetPrefab(path: string, parent: Node): Node {
        let prefab: Prefab = fdframe.res.get(path, Prefab, FDConstant.BUNDLENAME);
        if (!prefab) {

            fdframe.log.logError("showGetPrefab" + " path :" + path + " error")
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
