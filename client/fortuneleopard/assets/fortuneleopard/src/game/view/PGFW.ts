import { _decorator, Component, director, sp } from 'cc';
import { xNodeFT } from '../../xtools/xNodeFT';
const { ccclass, property } = _decorator;

@ccclass('PGFW')
export class PGFW extends Component {

    // onEnable() {
    //     const refresh = (index = 1) => {
    //         const spineName = ["1", "xh"][index];
    //         const pgSpine: sp.Skeleton = xNodeFT.findComponent("pg", this.node, sp.Skeleton)
    //         //@ts-ignore
    //         pgSpine._updateSkeletonData()
    //         pgSpine.setAnimation(0, spineName, false)
    //         console.log("spineName", spineName)
    //     }
    //     refresh(0);
    //     this.schedule(refresh, 5)

    // }

    protected onEnable(): void {
        const pgSpine: sp.Skeleton = xNodeFT.findComponent("pg", this.node, sp.Skeleton)
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

