import { _decorator, Component, Node, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FTAwardBlueCtrl')
export class FTAwardBlueCtrl extends Component {

    onLoad() {
        this.showView();
    }

    start() {
    }

    showView() {
        for (let i = 0; i < this.node.children.length; i++) {
            let time1 = 0.4
            let time2 = 0.2
            let node = this.node.children[i]
            tween(node)
                .by(time1, { position: new Vec3(0, -480, 0) })
                .by(time2, { position: new Vec3(160, 0, 0) })
                .by(time1, { position: new Vec3(0, 480, 0) })
                .by(time2, { position: new Vec3(-160, 0, 0) })
                .call(() => {
                    if (i == this.node.children.length - 1) {
                        this.showView();
                    }
                })
                .start()
        }
    }

    update(deltaTime: number) {

    }
}

