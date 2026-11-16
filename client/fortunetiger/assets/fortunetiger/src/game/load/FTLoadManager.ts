import { Asset, assetManager, AssetManager, ImageAsset, instantiate, isValid, LoadCompleteCallback, LoadProgressCallback, Node, Prefab, SpriteFrame, Texture2D, __private } from "cc";
import { ftframe } from "../../ftframe/ftframe";

import { FTConstant } from "../FTConstant/FTConstant";

import { FTEventName } from "../../ftframe/event/FTEventName";
import { closeGameDialogs, showGameDialog } from "../ui/game_dialogs";
import { FTConfigCtrl } from "../view/layer/FTConfigCtrl";
import { FTLanguage } from "../view/layer/FTLanguage";


export default class FTLoadManager {

    private static _ins: FTLoadManager = null;
    public static get ins() {
        if (this._ins == null) this._ins = new FTLoadManager();
        return this._ins;
    }
    public static set ins(_ins: FTLoadManager) {
        this._ins = _ins
    }
    private bundle: AssetManager.Bundle = null;
    private loadingLayer: Node = null;
    private lineLayer: Node = null;


    public static rest() {
        closeGameDialogs();
        FTLoadManager.ins.bundle = null;
        if (isValid(FTLoadManager.ins.loadingLayer)) FTLoadManager.ins.loadingLayer.destroy()
        FTLoadManager.ins.loadingLayer = null;
        if (isValid(FTLoadManager.ins.loadingLayer)) FTLoadManager.ins.lineLayer.destroy()
        FTLoadManager.ins.lineLayer = null;
        FTLoadManager._ins = null;
    }

    public init(): boolean {
        this.bundle = assetManager.getBundle(FTConstant.BUNDLENAME);
        return this.bundle != null;
    }

    public preLoadDir<T extends Asset>(onProgress: LoadProgressCallback | null, onComplete: LoadCompleteCallback<T[]> | null) {
        ftframe.res.loadDir(FTConstant.BUNDLENAME, FTConstant.LOADDIR, onProgress, onComplete);
    }

    public getPrefab(path: string): Prefab {
        let prefab: Prefab = ftframe.res.get("fortunetiger/" + path, Prefab, FTConstant.BUNDLENAME);
        if (prefab) return prefab;
        else ftframe.log.logError("getPrefab path :" + path + " error")
    }

    get<T extends Asset>(path: string, type: __private._cocos_core_asset_manager_shared__AssetType<T>): T | null {
        let asset: T = ftframe.res.get("fortunetiger/" + path, type, FTConstant.BUNDLENAME);
        if (asset) return asset;
        else ftframe.log.logError("get" + type + " path :" + path + " error")
    }
    getSpriteFrame(path: string): SpriteFrame {
        let asset: SpriteFrame = ftframe.res.get("fortunetiger/" + path, SpriteFrame, FTConstant.BUNDLENAME);
        if (asset) return asset;
        else ftframe.log.logError("getSpriteFrame" + " path :" + path + " error")
    }

    showLoading(tipStr?: string) {
        ftframe.message.dispatchEvent(FTEventName.SHOW_LOADING, true)

    }
    hideLoading() {
        ftframe.message.dispatchEvent(FTEventName.SHOW_LOADING, false)

    }

    async loadPrefab(path: string): Promise<Prefab> {
        return new Promise((reject) => {
            ftframe.res.load(FTConstant.BUNDLENAME, "fortunetiger/" + path, Prefab, (err: Error, asset: Prefab) => {
                if (err) {
                    ftframe.log.logError("loadPrefab" + " path :" + path + " error")
                }
                reject(asset)
            })
        })
    }

    showGetPrefab(path: string, parent: Node): Node {
        let prefab: Prefab = ftframe.res.get("fortunetiger/" + path, Prefab, FTConstant.BUNDLENAME);
        if (!prefab) {

            ftframe.log.logError("showGetPrefab" + " path :" + path + " error")
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
        const config = FTConfigCtrl.Instance;
        const actions = [{ label: config.getLanguageText(FTLanguage.BTN_OK), run: confirm }];
        if (cancel) actions.push({ label: config.getLanguageText(FTLanguage.BTN_CANCEL), run: cancel });
        showGameDialog({ title: "Pemberitahuan", message, actions });
    }

}
