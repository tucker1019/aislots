import { _decorator, Node, tween, isValid, Vec3 } from 'cc';
import  { Component } from 'cc';
import  { flframe } from '../../flframe/flframe';


const { ccclass, property } = _decorator;

@ccclass('FLBaseLayer')
export class FLBaseLayer extends Component {
    @property(Node)
    aniNode: Node = null;


    protected onLoad() {
        if (!isValid(this.aniNode)) return;
        this.aniNode.scale = new Vec3(0.6, 0.6, 1)
        tween(this.aniNode)
            .to(.2, { scale: new Vec3(1.1, 1.1, 1) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start()
    }
    protected onDestroy() {
        flframe.message.offByTarger(this);
    }
    protected closeLayer() {
        tween(this.aniNode)
            .to(.1, { scale: new Vec3(1.1, 1.1, 1) })
            .to(0.2, { scale: new Vec3(.6, .6, .6) })
            .call(() => {
                this.node.destroy();
            })
            .start()
    }
}

