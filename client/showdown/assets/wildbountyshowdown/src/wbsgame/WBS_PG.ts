import { _decorator, Component, director, Node, sp } from 'cc';
import { xNodeWBS } from '../xtools/xNodeWBS';
const { ccclass, property } = _decorator;

@ccclass('WBS_PG')
export class WBS_PG extends Component {
    onEnable() {
        const pgSpine: sp.Skeleton = xNodeWBS.findComponent("pg", this.node, sp.Skeleton)
        if (director.getScene().name == "game") {
            // @ts-ignore
            pgSpine._updateSkeletonData()
            pgSpine.setAnimation(0, "1", false)
            this.scheduleOnce(() => {
                // @ts-ignore
                pgSpine._updateSkeletonData()
                pgSpine.setAnimation(0, "xh", true)
            }, 2.5)
        } else {
            // @ts-ignore
            pgSpine._updateSkeletonData()
            pgSpine.setAnimation(0, "xh", true)
        }

    }
}

