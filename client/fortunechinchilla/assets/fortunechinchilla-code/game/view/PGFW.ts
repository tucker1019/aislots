import { _decorator, Component, Node, sp } from 'cc';
import { xNodeFC } from '../../xtools/xNodeFC';
const { ccclass, property } = _decorator;

@ccclass('PGFW')
export class PGFW extends Component {
    onEnable() {
        const refresh = () => {
            const spineName = ["1", "xh"][Math.floor(Math.random() * 2)];
            const pgSpine: sp.Skeleton = xNodeFC.findComponent("pg", this.node, sp.Skeleton)
            //@ts-ignore
            pgSpine._updateSkeletonData()
            pgSpine.setAnimation(0, spineName, false)
            console.log("spineName", spineName)
        }
        refresh();
        this.schedule(refresh, 5)

    }
}

