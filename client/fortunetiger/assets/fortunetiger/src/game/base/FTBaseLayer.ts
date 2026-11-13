import { _decorator, Node, tween, isValid, Vec3 } from 'cc';
import  { Component } from 'cc';
import  { ftframe } from '../../ftframe/ftframe';


import FTNetController from '../net/FTNetController';
const { ccclass, property } = _decorator;

@ccclass('FTBaseLayer')
export class FTBaseLayer extends Component {
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
        let Node = FTNetController.netNode;
        Node.removeResponeHandlerByTarget(this);
        ftframe.message.offByTarger(this);
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

