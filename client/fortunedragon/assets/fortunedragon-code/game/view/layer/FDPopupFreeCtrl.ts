import { _decorator, Animation, Component, instantiate, Label, Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { xNodeFD } from '../../../xtools/xNodeFD';
import FDLoadManager from '../../load/FDLoadManager';
import { showMoney } from '../../common/FDUtils';
import { FDAudioMgr } from './FDAudioMgr';
const { ccclass, property } = _decorator;

@ccclass('FDPopupFreeCtrl')
export class FDPopupFreeCtrl extends Component {
    start() {

    }

    endFreeGame(award: number, cnt: number, changeFunc?: Function) {
        return new Promise<void>((resolve, reject) => {
            FDAudioMgr.Instance.stopMusic()
            FDAudioMgr.Instance.playLongEffect("bgm_totalwin")


            let free_end = xNodeFD.find("free_end", this.node);
            if (!free_end) {
                free_end = instantiate(FDLoadManager.ins.getPrefab("res/load/prefab/games/free_end"));
                free_end.parent = this.node;
            }
            free_end.active = true;

            let panel = xNodeFD.find("panel", free_end);
            panel.getComponent(Animation).play();

            let awardLab: Label = xNodeFD.findComponent("panel/award_win", free_end, Label)
            xNodeFD.setLabelRollAni(awardLab, award, 0, 5);

            let button = xNodeFD.find("panel/btn", free_end);
            button.active = false;
            button.scale = new Vec3(0, 0, 1);

            let endFunc = () => {
                this.unscheduleAllCallbacks();
                Tween.stopAllByTag(1);
                FDAudioMgr.Instance.playSound("uiCollect")
                FDAudioMgr.Instance.stopLongEffect("bgm_totalwin_end");
                xNodeFD.offClick("", button, endFunc);
                // tween(panel_opa).to(0.5, { opacity: 0 }).call(() => {
                free_end.active = false;
                resolve();
                // }).start();

            }
            let func1 = (bClick=false) => {
                if (changeFunc) changeFunc();
                this.unschedule(func1);
                xNodeFD.offClick("panel", free_end, func1);
                FDAudioMgr.Instance.stopLongEffect("bgm_totalwin");
                FDAudioMgr.Instance.playLongEffect("bgm_totalwin_end");
                button.active = true;
                tween(button).to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" }).start();

                Tween.stopAllByTarget(awardLab.node);
                let str1 = awardLab.string;
                let str2 = showMoney(award);
                if (str1 != str2) {
                    xNodeFD.setLabel("", awardLab.node, showMoney(award));
                }

                this.scheduleOnce(() => {
                    xNodeFD.addClick("", button, endFunc);
                }, 0.5)

                let tw_vfx_b_screen = xNodeFD.find("tw_vfx_b_screen", panel);
                let bw_vfx_a_add_opa = tw_vfx_b_screen.getComponent(UIOpacity);
                tw_vfx_b_screen.active = true
                tw_vfx_b_screen.scale = new Vec3(0, 0, 1);
                tween(tw_vfx_b_screen).tag(1).to(0.5, { scale: new Vec3(3, 3, 1) }).start();
                bw_vfx_a_add_opa.opacity = 255;
                tween(bw_vfx_a_add_opa).tag(1).delay(0.5).to(0.2, { opacity: 0 }).start();

                this.scheduleOnce(endFunc, 6);
            }
            xNodeFD.addClick("panel", free_end, func1.bind(this, true));
            this.scheduleOnce(func1, 6);
        })
    }


}


