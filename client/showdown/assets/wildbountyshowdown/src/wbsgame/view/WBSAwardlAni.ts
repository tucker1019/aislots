import { _decorator, Animation, tween, Vec3, Tween, UITransform, ParticleSystem2D, Node, instantiate, Label, UIOpacity } from "cc";
import { xNodeWBS } from "../../xtools/xNodeWBS";
import { WBSSpriteCtrl } from "./WBSSpriteCtrl";
import { WBSBaseLayer } from "../base/WBSBaseLayer";
import { wbsgame } from "../wbsgame";
import { RollNumLabel } from "../component/RollNumLabel";
import { showMoney } from "../../xtools/WBSUtils";
import { WBSSTATE } from "../constant/WBSConstant";

const { ccclass, property } = _decorator;

@ccclass('WBSAwardlAni')
export class WBSAwardlAni extends WBSBaseLayer {

    onLoad() {
    }

    /**
     * 
     * @param type 开始
     * @param money 
     * @param endFunc 
     */
    playWinAnim(type, money, endFunc) {
        wbsgame.audioMgr.stopMusic();
        wbsgame.audioMgr.playLongSound("bgm_bigwin_main");

        let idleT = 7.5;
        this.node.active = true;
        let panelAnim = this.node.getComponent(Animation);
        let panelOpa = this.node.getComponent(UIOpacity);
        panelOpa.opacity = 255;
        Tween.stopAllByTarget(panelOpa)
        let bw_bg_a = xNodeWBS.find("bw_bg_a", this.node);
        let title = xNodeWBS.find("title", this.node);

        let par1 = xNodeWBS.find("par", this.node);
        par1.active = true;
        par1.getComponent(ParticleSystem2D).resetSystem();

        let awardLab: Label = xNodeWBS.findComponent("lab_win_num", this.node, Label)
        xNodeWBS.setLabelRollAni(awardLab, money, 0, idleT * (type + 1));

        let bl_vfx_d_screen = xNodeWBS.find("bl_vfx_d_screen", this.node);

        Tween.stopAllByTarget(bw_bg_a);
        let playCnt = 0;
        tween(bw_bg_a)
            .repeat(type + 1, tween()
                .call(() => {
                    bw_bg_a.getComponent(WBSSpriteCtrl).sprIndex = playCnt;
                    title.getComponent(WBSSpriteCtrl).sprIndex = playCnt;
                    playCnt += 1;
                    panelAnim.play("bw_tri");
                })
                .delay(idleT)
            )
            .call(() => {
                hideBigWinAnim();
            })
            .start()


        let hideBigWinAnim = () => {
            this.unscheduleAllCallbacks();
            btn.off("click");
            Tween.stopAllByTarget(bw_bg_a);
            wbsgame.audioMgr.stopLongSound("bgm_bigwin_main");
            wbsgame.audioMgr.playSound("bgm_bigwin_end");

            bw_bg_a.scale = new Vec3(1.2, 1.2, 1)
            bw_bg_a.getComponent(WBSSpriteCtrl).sprIndex = type;
            title.getComponent(WBSSpriteCtrl).sprIndex = type;
            Tween.stopAllByTarget(awardLab.node);
            xNodeWBS.setLabel("", awardLab.node, showMoney(money));

            panelAnim.play("bw_tri");
            tween(panelOpa)
                .delay(4.5)
                .to(0.2, { opacity: 0 })
                .call(() => {
                    this.node.active = false;
                    if (wbsgame.gameMgr.getState() == WBSSTATE.FREEING) { wbsgame.audioMgr.playMusic("bgm_fs") }
                    else {  wbsgame.audioMgr.playMusic("bgm_mg");}
                    if (endFunc) {
                        endFunc();
                    }
                })
                .start()
        }

        let btn = xNodeWBS.find("SpriteSplash", this.node);
        btn.off("click");
        btn.on("click", hideBigWinAnim);
        // this.scheduleOnce(hideBigWinAnim, idleT + 0.5)
    }

}

