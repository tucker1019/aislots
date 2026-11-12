import { _decorator, Component, Node, tween, Vec3 } from 'cc';
import { wbsgame } from '../wbsgame';
import { xNodeWBS } from '../../xtools/xNodeWBS';
const { ccclass, property } = _decorator;

@ccclass('WBSWinMorePanel')
export class WBSWinMorePanel extends Component {


    showPanel(delayTime: number) {

        if (delayTime > 0) {
            this.node.children.forEach(node => node.active = false);
            this.scheduleOnce(() => {
                this.node.children.forEach(node => node.active = true);

                let panel = xNodeWBS.find("panel", this.node);
                panel.scale = new Vec3(0, 0, 1)
                tween(panel)
                    .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                    .start()

            }, delayTime)
        }
    }

    onClickCloseBtn() {
        wbsgame.audioMgr.playSound("menu_icon_press");
        this.node.destroy();
    }

}


