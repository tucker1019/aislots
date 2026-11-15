import { _decorator, Component, director, Node, sp } from 'cc';
import { xNodeFOX } from '../../xtools/xNodeFOX';
const { ccclass, property } = _decorator;

@ccclass('PGFW')
export class PGFW extends Component {
    onEnable() {
        const pgSpine: sp.Skeleton = xNodeFOX.findComponent("pg", this.node, sp.Skeleton)
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


