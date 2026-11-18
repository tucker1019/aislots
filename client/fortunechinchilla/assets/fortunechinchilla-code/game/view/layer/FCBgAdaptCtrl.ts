import { _decorator, Component, math, Node, UITransform, View, view } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FCBgAdaptCtrl')
export class FCBgAdaptCtrl extends Component {

    onLoad() {


        let widSize: math.Size =  view.getVisibleSize();
        let bgUIransform = this.node.getComponent(UITransform);
        let scale = Math.max(widSize.width / bgUIransform.width, widSize.height / bgUIransform.height);
        this.node.setScale(scale, scale, 1);
    }

    start() {

    }

    update(deltaTime: number) {

    }
}

