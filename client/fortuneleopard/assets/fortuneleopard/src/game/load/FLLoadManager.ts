import { Asset, assetManager, AssetManager, ImageAsset, instantiate, isValid, LoadCompleteCallback, LoadProgressCallback, Node, Prefab, SpriteFrame, Texture2D, __private } from "cc";
import { flframe } from "../../flframe/flframe";

import { FLConstant } from "../FLConstant/FLConstant";

import { FLEventName } from "../../flframe/event/FLEventName";
import { closeGameDialogs, showGameDialog } from "../ui/game_dialogs";
import { FLConfigCtrl } from "../view/layer/FLConfigCtrl";
import { FLLanguage } from "../view/layer/FLLanguage";


export default class FLLoadManager {

    private static _ins: FLLoadManager = null;
    public static get ins() {
        if (this._ins == null) this._ins = new FLLoadManager();
        return this._ins;
    }
    public static set ins(_ins: FLLoadManager) {
        this._ins = _ins
    }
    private bundle: AssetManager.Bundle = null;
    private loadingLayer: Node = null;
    private lineLayer: Node = null;


    public static rest() {
        closeGameDialogs();
        FLLoadManager.ins.bundle = null;
        if (isValid(FLLoadManager.ins.loadingLayer)) FLLoadManager.ins.loadingLayer.destroy()
        FLLoadManager.ins.loadingLayer = null;
        if (isValid(FLLoadManager.ins.loadingLayer)) FLLoadManager.ins.lineLayer.destroy()
        FLLoadManager.ins.lineLayer = null;
        FLLoadManager._ins = null;
    }

    public init(): boolean {
        this.bundle = assetManager.getBundle(FLConstant.BUNDLENAME) || assetManager.getBundle("main");
        return this.bundle != null;
    }

    public preLoadDir<T extends Asset>(onProgress: LoadProgressCallback | null, onComplete: LoadCompleteCallback<T[]> | null) {
        flframe.res.loadDir(FLConstant.BUNDLENAME, FLConstant.LOADDIR, onProgress, onComplete);
    }

    private normalizePath(path: string): string {
        return path.replace(/^\/+/, '').replace(/^fortuneleopard\//, '');
    }

    public getPrefab(path: string): Prefab {
        let prefab: Prefab = flframe.res.get(this.normalizePath(path), Prefab, FLConstant.BUNDLENAME);
        if (prefab) return prefab;
        else flframe.log.logError("getPrefab path :" + path + " error")
    }

    get<T extends Asset>(path: string, type: __private._cocos_core_asset_manager_shared__AssetType<T>): T | null {
        let asset: T = flframe.res.get(this.normalizePath(path), type, FLConstant.BUNDLENAME);
        if (asset) return asset;
        else flframe.log.logError("get" + type + " path :" + path + " error")
    }
    getSpriteFrame(path: string): SpriteFrame {
        let asset: SpriteFrame = flframe.res.get(this.normalizePath(path), SpriteFrame, FLConstant.BUNDLENAME);
        if (asset) return asset;
        else flframe.log.logError("getSpriteFrame" + " path :" + path + " error")
    }

    showLoading(tipStr?: string) {
        flframe.message.dispatchEvent(FLEventName.SHOW_LOADING, true)

    }
    hideLoading() {
        flframe.message.dispatchEvent(FLEventName.SHOW_LOADING, false)

    }

    async loadPrefab(path: string): Promise<Prefab> {
        return new Promise((reject) => {
            flframe.res.load(FLConstant.BUNDLENAME, this.normalizePath(path), Prefab, (err: Error, asset: Prefab) => {
                if (err) {
                    flframe.log.logError("loadPrefab" + " path :" + path + " error")
                }
                reject(asset)
            })
        })
    }

    showGetPrefab(path: string, parent: Node): Node {
        let prefab: Prefab = flframe.res.get(this.normalizePath(path), Prefab, FLConstant.BUNDLENAME);
        if (!prefab) {

            flframe.log.logError("showGetPrefab" + " path :" + path + " error")
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
        if (document.querySelector('.ag4-game-dialog')) return;
        const config = FLConfigCtrl.Instance;
        const actions = [{ label: config.getLanguageText(FLLanguage.BTN_OK), run: confirm }];
        if (cancel) actions.push({ label: config.getLanguageText(FLLanguage.BTN_CANCEL), run: cancel });
        showGameDialog({ title: "Pemberitahuan", message, actions });
    }

}
