import { Asset, AssetManager, AudioClip, Component, Constructor, Label, Node, Prefab, SceneAsset, SpriteFrame, UITransform, __private, _decorator, assetManager, director, instantiate, isValid, js, path, url } from "cc";
import { WBSResLoader, ProgressCallback, CompleteCallback } from "../loader/WBSResLoader";
import { WBSConstant } from "../constant/WBSConstant";
import { consoleLog, consoleLogError } from "../../xtools/WBSUtils";
import { wbsgame } from "../wbsgame";
import { WBSEventName } from "../constant/WBSEventName";
import { xNodeWBS } from "../../xtools/xNodeWBS";



const { ccclass } = _decorator;
@ccclass('WBSLoadManager')

export class WBSLoadManager extends Component {
    private res: WBSResLoader = null;
    private bundle: AssetManager.Bundle = null;
    private spriteFrameCache: Object = {}
    private prefabCache: Object = {}
    private audioCache: Object = {}
    private preList = {

    }


    protected onLoad(): void {
        this.bundle = assetManager.getBundle(WBSConstant.BUNDLENAME);
        this.res = new WBSResLoader()
    }


    preLoad() {

    }

    public preLoadDir<T extends Asset>(onProgress: ProgressCallback | null, onComplete: CompleteCallback<T[]> | null) {
        this.res.loadDir(WBSConstant.BUNDLENAME, WBSConstant.LOADDIR, onProgress, onComplete);
    }

    public getCheSpriteFrameByName(cacheName: string) {
        if (this.spriteFrameCache[cacheName]) return this.spriteFrameCache[cacheName]
        else return this.getSpriteFrame(cacheName)
    }

    public getChePrefabByName(cacheName: string) {
        if (this.spriteFrameCache[cacheName]) return this.prefabCache[cacheName]
        else return this.getPrefab(cacheName)
    }

    public loadScene(sceneName: string) {
        this.bundle.loadScene(sceneName, (err: Error, scene: SceneAsset) => {
            if (err) {
                consoleLogError(sceneName, "loadScene error")
            }
            director.runScene(scene);
        })
    }
    async loadPrefab(uri: string): Promise<Prefab> {
        return new Promise((reject) => {
            if (this.prefabCache[uri]) {
                reject(this.prefabCache[uri])
                return
            }
            this.res.load(WBSConstant.BUNDLENAME, uri, Prefab, (err: Error, asset: Prefab) => {
                if (err) {
                    consoleLogError("loadPrefab" + " uri :" + uri + " error")
                }
                consoleLog("loadPrefab", uri)
                this.prefabCache[uri] = asset;
                consoleLog(this.prefabCache)
                reject(asset)
            })
        })
    }

    loadAudio(uri: string, onComplete?: CompleteCallback<AudioClip> | null) {

        if (this.audioCache[uri]) {
            onComplete(null, this.audioCache[uri])
            return
        }
        let newOnComplete = (err: Error, data: AudioClip) => {
            this.audioCache[uri] = data
            onComplete(err, data)
        }
        this.res.load(WBSConstant.BUNDLENAME, uri, newOnComplete)
    }


    public getPrefabNotInLoadDir(uri: string) {
        let prefab: Prefab = this.res.get(uri, Prefab, WBSConstant.BUNDLENAME);
        if (prefab) return prefab;
        else consoleLogError("getPrefabNotInLOADDIR uri :" + uri + " error")
    }

    public getPrefab(uri: string): Prefab {
        uri = path.join(WBSConstant.LOADDIR, uri)
        let prefab: Prefab = this.res.get(uri, Prefab, WBSConstant.BUNDLENAME);
        if (prefab) return prefab;
        else consoleLogError("getPrefab uri :" + uri + " error")
    }


    get<T extends Asset>(uri: string, type: Constructor<T>): T | null {
        uri = path.join(WBSConstant.LOADDIR, uri)
        let asset: T = this.res.get(uri, type, WBSConstant.BUNDLENAME);
        if (asset) return asset;
        else consoleLogError("get" + type + " uri :" + uri + " error")
    }


    getSpriteFrame(uri: string): SpriteFrame {
        uri = path.join(WBSConstant.LOADDIR, uri, "spriteFrame")
        // consoleLog("uri", uri)
        let asset: SpriteFrame = this.res.get(uri, SpriteFrame, WBSConstant.BUNDLENAME);
        if (asset) return asset;
        else consoleLog("getSpriteFrame" + " path :" + path + " error")
    }




    async showPrefab(path: string, parent: Node): Promise<Node> {
        let prefab: Prefab = await this.loadPrefab(path);
        if (!prefab) {
            consoleLogError("showPrefabWithLoading" + " path :" + path + " error")
            return;
        }
        let node: Node = instantiate(prefab);
        node.parent = parent;
        return node
    }


    async showPrefabWithLoading(path: string, parent: Node): Promise<Node> {
        wbsgame.message.dispatchEvent(WBSEventName.SHOW_LOADING, true)
        let prefab: Prefab = await this.loadPrefab(path);
        wbsgame.message.dispatchEvent(WBSEventName.SHOW_LOADING, false)
        if (!prefab) {
            consoleLogError("showPrefabWithLoading" + " path :" + path + " error")
            return;
        }
        let node: Node = instantiate(prefab);
        node.parent = parent;
        return node
    }

    async showAlert(tip: string, yseFun?: Function, noFun?: Function): Promise<void> {
        let parent = xNodeWBS.find("Canvas/TopLayer");
        if (xNodeWBS.find("AlertLayer", parent)) return;
        let prefab: Prefab = await this.loadPrefab("res/load/prefab/com/AlertLayer");
        if (!prefab) {
            return;
        }
        let node: Node = instantiate(prefab);
        node.parent = parent;
        xNodeWBS.setLabel("alert/lab_message", node, tip);
        xNodeWBS.setPopOpenAni(xNodeWBS.find("alert", node));
        let closeFun = () => {
            xNodeWBS.setPopCloseAni(xNodeWBS.find("alert", node), () => { yseFun && yseFun(); node.destroy() });
        }
        xNodeWBS.addClick("alert/btn_close", node, closeFun)
        xNodeWBS.addClick("alert/btn_yes", node, closeFun)
        xNodeWBS.addClick("alert/icon_guanbi", node, closeFun)

    }
    async showToast(tip: string) {
        let parent = xNodeWBS.find("Canvas/TopLayer");
        if (xNodeWBS.find("TopLayer", parent)) return;
        let prefab: Prefab = await this.loadPrefab("res/load/prefab/com/Toast");
        if (!prefab) {
            return;
        }
        let node: Node = instantiate(prefab);
        node.parent = parent;
        xNodeWBS.setLabel("lab_message", node, tip);
        xNodeWBS.findComponent("lab_message", node, Label).updateRenderer();
        xNodeWBS.setProperty("img_bg", node, UITransform, "height", xNodeWBS.find("lab_message", node).getComponent(UITransform).height + 50)
        xNodeWBS.setPopOpenAni(node);
        let closeFun = () => {
            xNodeWBS.setPopCloseAni(node, () => isValid(node) && node.destroy());
        }
        setTimeout(closeFun, 2000)
    }
    showPanel(panelName: string, parent: Node, ...args): Node {
        let node: Node = xNodeWBS.find(panelName, parent)
        if (node && isValid(node)) {
            node.active = true
        } else {
            panelName = path.join("prefab", panelName)
            let prefab = wbsgame.loadMgr.getChePrefabByName(panelName);
            node = instantiate(prefab)
            node.parent = parent
        }
        consoleLog("showPanel", panelName, ...args, args)
        //@ts-ignore
        if (args.length > 0) node.getComponent(panelName).init(...args)
        return node
    }


}

