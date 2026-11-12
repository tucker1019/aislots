import { _decorator, Component, instantiate, isValid, Node, tween, Vec3 } from 'cc';
import { wbsgame } from '../wbsgame';

const { ccclass, property } = _decorator;

@ccclass('WBSBaseLayer')
export class WBSBaseLayer extends Component {

    private _scale: Vec3 = null
    private _aniNode: Node = null;

    playShowAni(aniNode: Node) {
        this._scale = aniNode.getScale();
        this._aniNode = aniNode;
        aniNode.scale = new Vec3(this._scale.x * 0.6, this._scale.y * 0.6, 1)
        tween(aniNode)
            .to(.2, { scale: new Vec3(this._scale.x * 1.1, this._scale.x * 1.1, 1) })
            .to(0.1, { scale: new Vec3(this._scale.x, this._scale.x, 1) })
            .start()
    }

    protected onDestroy() {
        wbsgame.message.offByTarger(this);
        this.unscheduleAllCallbacks();
    }
    protected closeLayer() {
        if (!this._aniNode || !isValid(this._aniNode)) {
            this.node.active = false
        } else {
            tween(this._aniNode)
                .to(.1, { scale: new Vec3(this._scale.x * 1.1, this._scale.y * 1.1, 1) })
                .to(0.2, { scale: new Vec3(this._scale.x * .6, this._scale.y * .6, .6) })
                .call(() => {
                    this.node.active = false
                    this._aniNode.setScale(this._scale)
                })
                .start()
        }
    }

    async delayTime(time: number): Promise<void> {
        return new Promise((rej) => {
            this.scheduleOnce(() => { rej() }, time)
        })
    }
}

