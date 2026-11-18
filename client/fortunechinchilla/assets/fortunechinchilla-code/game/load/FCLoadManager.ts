import { Asset, Constructor, instantiate, isValid, Node, Prefab, resources, SpriteFrame, __private } from "cc";
import { fcframe } from "../../fcframe/fcframe";

import { alertGame } from "../net/FCGameUI";
import { FCConstant } from "../FCConstant/FCConstant";

import { FCEventName } from "../../fcframe/event/FCEventName";


export default class FCLoadManager {

    private static _ins: FCLoadManager = null;
    public static get ins() {
        if (this._ins == null) this._ins = new FCLoadManager();
        return this._ins;
    }
    public static set ins(_ins: FCLoadManager) {
        this._ins = _ins
    }
    private loadingLayer: Node = null;
    private netLoadingLayer: Node = null;
    private lineLayer: Node = null;


    public static rest() {
        if (isValid(FCLoadManager.ins.loadingLayer)) FCLoadManager.ins.loadingLayer.destroy()
        FCLoadManager.ins.loadingLayer = null;
        if (isValid(FCLoadManager.ins.loadingLayer)) FCLoadManager.ins.lineLayer.destroy()
        FCLoadManager.ins.lineLayer = null;
        if (isValid(FCLoadManager.ins.netLoadingLayer)) FCLoadManager.ins.netLoadingLayer.destroy();
        FCLoadManager.ins.netLoadingLayer = null;
        FCLoadManager._ins = null;
    }

    public preLoadDir<T extends Asset>(onProgress: ((done: number, total: number, item: unknown) => void) | null, onComplete: ((error: Error | null, assets: T[]) => void) | null) {
        resources.loadDir(FCConstant.LOADDIR, onProgress, onComplete);
    }

    public getPrefab(path: string): Prefab {
        let prefab: Prefab = fcframe.res.get(path, Prefab);
        if (prefab) return prefab;
        else fcframe.log.logError("getPrefab path :" + path + " error")
    }

    get<T extends Asset>(path: string, type: Constructor<T>): T | null {
        let asset: T = fcframe.res.get(path, type);
        if (asset) return asset;
        else fcframe.log.logError("get" + type + " path :" + path + " error")
    }
    getSpriteFrame(path: string): SpriteFrame {
        let asset: SpriteFrame = fcframe.res.get(path, SpriteFrame);
        if (asset) return asset;
        else fcframe.log.logError("getSpriteFrame" + " path :" + path + " error")
    }

    showNetLoading(tipStr?: string) {
        console.log("showNetLoading===<", this.netLoadingLayer)
        fcframe.message.dispatchEvent(FCEventName.SHOW_LOADING, true)
        // if (!this.netLoadingLayer) {
        //     let loadingPre = this.getPrefab(FCConstant.LOADDIR + "/prefab/loading/LoadingLayer");
        //     this.netLoadingLayer = instantiate(loadingPre)
        // }
        // console.log("showNetLoading===<===", this.netLoadingLayer, xNodeFC.find("Canvas"))
        // if (this.netLoadingLayer && xNodeFC.find("Canvas")) {

        //     this.netLoadingLayer.parent = xNodeFC.find("Canvas");
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
        fcframe.message.dispatchEvent(FCEventName.SHOW_LOADING, true)
        // if (!this.loadingLayer) {
        //     let loadingPre = this.getPrefab(FCConstant.LOADDIR + "/prefab/loading/LoadingLayer");
        //     this.loadingLayer = instantiate(loadingPre)
        // }
        // this.loadingLayer.parent = xNodeFC.find("Canvas");
    }
    hideLoading() {
        fcframe.message.dispatchEvent(FCEventName.SHOW_LOADING, false)
        // if (this.loadingLayer && isValid(this.loadingLayer)) {
        //     // this.loadingLayer.removeFromParent();
        // }
    }

    async loadPrefab(path: string): Promise<Prefab> {
        return new Promise((reject) => {
            resources.load(path, Prefab, (err: Error, asset: Prefab) => {
                if (err) {
                    fcframe.log.logError("loadPrefab" + " path :" + path + " error")
                }
                reject(asset)
            })
        })
    }

    showGetPrefab(path: string, parent: Node): Node {
        let prefab: Prefab = fcframe.res.get(path, Prefab);
        if (!prefab) {

            fcframe.log.logError("showGetPrefab" + " path :" + path + " error")
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
