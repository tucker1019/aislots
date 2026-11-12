import { Component, Node, NodePool, _decorator, instantiate } from "cc"
import { WBSConstant } from "../constant/WBSConstant";
import { wbsgame } from "../wbsgame";
import { consoleLogError } from "../../xtools/WBSUtils";

const { ccclass } = _decorator;

@ccclass('WBSPoolManager')
export class WBSPoolManager extends Component {

    private poolMap: Map<string, NodePool> = new Map();

    async initPool(path: string, poolSize: number = 30) {
        let key = `${WBSConstant.BUNDLENAME}/${path}`;
        let pool = new NodePool();
        this.poolMap.set(key, pool);
        for (let i = 0; i < poolSize; i++) {
            let node = instantiate(await wbsgame.loadMgr.loadPrefab(path))
            this.poolMap.get(key).put(node)
        }
    }

    createEnemy(path: string): Node {
        let pool = this.getPool(path)
        if (!pool) return
        let prefab = null;
        if (pool.size() > 0) {
            prefab = pool.get();
        } else {
            prefab = instantiate(wbsgame.loadMgr.getPrefabNotInLoadDir(path));
        }
        return prefab


    }

    onEnemyKilled(path: string, node: Node) {
        let pool = this.getPool(path)
        pool && pool.put(node)
    }

    clearPoolByKey(path: string) {
        let pool = this.getPool(path)
        pool && pool.clear();
    }

    clearAllPools() {
        this.poolMap.forEach(pool => pool && pool.clear())
    }

    private getPool(path: string): NodePool {
        let key = `${WBSConstant.BUNDLENAME}/${path}`;
        let pool = this.poolMap.get(key);
        if (!pool) {
            consoleLogError("还为初始化对象池   " + path)
            return
        }
        return pool
    }
    protected onDestroy(): void {
        this.poolMap.forEach(value => value.clear())
    }

}

