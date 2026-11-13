import { showGameDialog, showGameToast, closeGameDialogs } from '../../ui/game_dialogs';
import { Asset, AudioClip, Component, Constructor, Label, Node, Prefab, SpriteFrame, UITransform, __private, _decorator, resources, instantiate, isValid, js, path, url } from "cc";
type ProgressCallback = (completed: number, total: number, item?: unknown) => void;
type CompleteCallback<T = Asset> = (error: Error | null, data: T) => void;
import { WBSConstant } from "../constant/WBSConstant";
import { consoleLog, consoleLogError } from "../../xtools/WBSUtils";
import { wbsgame } from "../wbsgame";
import { xNodeWBS } from "../../xtools/xNodeWBS";



const { ccclass } = _decorator;
@ccclass('WBSLoadManager')

export class WBSLoadManager extends Component {
    private spriteFrameCache: Object = {}
    private prefabCache: Object = {}
    private audioCache: Object = {}
    private preList = {

    }


    public preLoadDir<T extends Asset>(onProgress: ProgressCallback | null, onComplete: CompleteCallback<T[]> | null) {
        resources.loadDir(WBSConstant.LOADDIR, onProgress, onComplete);
    }

    public getCheSpriteFrameByName(cacheName: string) {
        if (this.spriteFrameCache[cacheName]) return this.spriteFrameCache[cacheName]
        else return this.getSpriteFrame(cacheName)
    }

    public getChePrefabByName(cacheName: string) {
        if (this.prefabCache[cacheName]) return this.prefabCache[cacheName]
        else return this.getPrefab(cacheName)
    }

    async loadPrefab(uri: string): Promise<Prefab> {
        if (this.prefabCache[uri]) return this.prefabCache[uri];
        return new Promise((resolve, reject) => {
            resources.load(uri, Prefab, (error, asset) => {
                if (error) { reject(error); return; }
                this.prefabCache[uri] = asset;
                resolve(asset);
            });
        });
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
        resources.load(uri, AudioClip, newOnComplete)
    }


    public getPrefabNotInLoadDir(uri: string) {
        let prefab: Prefab = resources.get(uri, Prefab);
        if (prefab) return prefab;
        else consoleLogError("getPrefabNotInLOADDIR uri :" + uri + " error")
    }

    public getPrefab(uri: string): Prefab {
        uri = path.join(WBSConstant.LOADDIR, uri)
        let prefab: Prefab = resources.get(uri, Prefab);
        if (prefab) return prefab;
        else consoleLogError("getPrefab uri :" + uri + " error")
    }


    get<T extends Asset>(uri: string, type: Constructor<T>): T | null {
        uri = path.join(WBSConstant.LOADDIR, uri)
        let asset: T = resources.get(uri, type);
        if (asset) return asset;
        else consoleLogError("get" + type + " uri :" + uri + " error")
    }


    getSpriteFrame(uri: string): SpriteFrame {
        uri = path.join(WBSConstant.LOADDIR, uri, "spriteFrame")
        // consoleLog("uri", uri)
        let asset: SpriteFrame = resources.get(uri, SpriteFrame);
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
        let prefab: Prefab = await this.loadPrefab(path);
        if (!prefab) {
            consoleLogError("showPrefabWithLoading" + " path :" + path + " error")
            return;
        }
        let node: Node = instantiate(prefab);
        node.parent = parent;
        return node
    }


    showAlert(title: string, confirm?: () => void, message = '', confirmLabel = '确定'): Promise<void> {
        return new Promise(resolve => {
            showGameDialog({title,message,actions:[{label:confirmLabel,run:()=>{confirm?.();resolve();}}]});
        });
    }
    async showToast(tip: string) { showGameToast(tip); }
    protected onDestroy() { closeGameDialogs(); }
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

