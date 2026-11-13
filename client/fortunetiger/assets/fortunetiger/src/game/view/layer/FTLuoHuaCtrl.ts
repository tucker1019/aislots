import { _decorator, Component, find, instantiate, Node, NodePool, Tween, tween, UITransform, Vec3 } from 'cc';
import FTLoadManager from '../../load/FTLoadManager';
const { ccclass, property } = _decorator;

@ccclass('FTLuoHuaCtrl')
export class FTLuoHuaCtrl extends Component {

    _huaPool = new NodePool();
    _huaList = [];

    protected start(): void {
        this.playLuohuaAnim();
    }

    playLuohuaAnim() {

        tween(this.node)
            .repeatForever(
                tween().call(() => {
                    let cnt = Math.floor(Math.random() * 2 + 3);
                    for (let i = 0; i < cnt; i++) {
                        this.playOneHuaAnim();
                    }
                })
                    .delay(2 + Math.random() * 2)
            )
            .start()
    }

    playOneHuaAnim() {

        let hua;
        if (this._huaPool.size() > 0) {
            hua = this._huaPool.get();
        } else {
            hua = instantiate(FTLoadManager.ins.getPrefab("res/load/prefab/games/hua"));
        }

        this.node.addChild(hua);
        let size = this.node.getComponent(UITransform).contentSize;

        let sPos = new Vec3(this.getRandomNumber(-size.width / 2, size.width / 2), size.height / 2 + 50, 1);
        let ePos = new Vec3(sPos.x + this.getRandomNumber(300, 450), 0, 1);


        this._huaList.push(hua);
        hua.position = sPos;
        hua.eulerAngles = new Vec3(0, 0, this.getRandomNumber(-150, 50));
        let scaleR = Math.random() * 0.3 + 0.4;
        hua.scale = new Vec3(scaleR, scaleR, 1);
        tween(hua)
            .delay(Math.random() * 3)
            .to(5, { position: ePos })
            .call(() => {
                this._huaPool.put(hua);
            })
            .start();

    }

    protected onDestroy(): void {
        Tween.stopAll();
        this._huaList.forEach((hua) => {
            this._huaPool.put(hua);
        })
    }


    getRandomNumber(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }


}




