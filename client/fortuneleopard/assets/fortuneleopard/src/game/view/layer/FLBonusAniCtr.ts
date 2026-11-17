import { _decorator, Component, Node, sp } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FLBonusAniCtr')
export class FLBonusAniCtr extends Component {


    onLoad() {
    }

    start() {

    }

    showAni(name: string) {
        if (!this.node || !this.node.isValid) {
            return
        }
        this.node.getComponent(sp.Skeleton).setAnimation(0, name, false);
        this.scheduleOnce(() => {
            this.node.destroy();
        }, 1)
    }

    update(deltaTime: number) {

    }
}

