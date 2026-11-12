import { _decorator, Component, Node, tween, Vec3 } from 'cc';
import { xNodeWBS } from '../../xtools/xNodeWBS';
import { wbsgame } from '../wbsgame';
const { ccclass, property } = _decorator;

@ccclass('WBSQuikTipPanel')
export class WBSQuikTipPanel extends Component {

    _bHide: boolean = true;

    showPanel() {
        let panel = xNodeWBS.find("panel", this.node);
        this._bHide = false;

        panel.scale = new Vec3(0.6, 0.6, 1)
        tween(panel)
            .to(.2, { scale: new Vec3(1.1, 1.1, 1) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start()
    }

    onClickClose() {
        if (this.node && !this._bHide) {
            this._bHide = true;
            wbsgame.audioMgr.playSound("COMMON_CANCEL_BTN");
            let panel = xNodeWBS.find("panel", this.node);
            tween(panel)
                .to(.1, { scale: new Vec3(1.1, 1.1, 1) })
                .to(0.2, { scale: new Vec3(.6, .6, .6) })
                .call(() => {
                    this.node.active = false;
                })
                .start()
        }
    }
}


