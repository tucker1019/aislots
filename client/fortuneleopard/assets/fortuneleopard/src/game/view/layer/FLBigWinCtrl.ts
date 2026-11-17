import { _decorator, Animation, Component, Label, Node, sp, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { xNodeFL } from '../../../xtools/xNodeFL';
import { FLAudioMgr } from './FLAudioMgr';
import { showMoney } from '../../common/FLUtils';;
import { FLBaseNode } from '../../base/FLBaseNode';
import { FLSpriteCtrl } from './FLSpriteCtrl';
const { ccclass, property } = _decorator;

@ccclass('FLBigWinCtrl')
export class FLBigWinCtrl extends FLBaseNode {

    protected initAttribute() {
    }

    _winCoin: number = 0;   // 总赢钱
    _winType: number = 0;   // bigwin类型 1-bigwin 2-megawin 3-superwin
    _endFunc: Function = null;
    _oneRollT: number = 0;

    // bw mw smw
    playBigWin(coin, type, endFunc) {
        FLAudioMgr.Instance.stopMusic();
        FLAudioMgr.Instance.playMusic("bgm_bigwin_main");

        this._winCoin = coin;
        this._winType = type;
        this._endFunc = endFunc;
        this._oneRollT = 5;

        this.node.active = true;

        let rollT = this._winType * this._oneRollT; // 金币滚动时间
        let award_num: Label = xNodeFL.findComponent("panel/num/award_num", this.node, Label);
        xNodeFL.setLabelRollAni(award_num, this._winCoin, 0, rollT);
        FLAudioMgr.Instance.playLongEffect("games/bgm_bigwin_coins");

        this.playOneAnim(0)
    }

    playOneAnim(index, stop?) {
        let triT = 0.5;
        let rollT = this._oneRollT;


        let panel = xNodeFL.find("panel", this.node);
        panel.children.forEach((node) => {
            if (node.getComponent(sp.Skeleton)) {
                node.active = false
            }
        })

        FLAudioMgr.Instance.playLongEffect("games/bgm_bigwin_firework");

        let title = xNodeFL.find("title", panel);
        title.active = true;
        title.getComponent(FLSpriteCtrl).setSpriteIndex(index);
        title.scale = new Vec3(0, 0, 0);
        title.position = new Vec3(0, 0, 0);
        tween(title).to(triT, { scale: new Vec3(1, 1, 1), position: new Vec3(0, [80, 123, 155][index], 0) }, { easing: "backOut" }).start();

        let sp_8: sp.Skeleton = xNodeFL.findComponent("8c1dj", panel, sp.Skeleton);
        this.playSpAnim(sp_8);
        let sp_1: sp.Skeleton = xNodeFL.findComponent("1c1dj", panel, sp.Skeleton);
        this.playSpAnim(sp_1, "animation_blue", "animation2_blue");
        let sp_6: sp.Skeleton = xNodeFL.findComponent("6c1dj", panel, sp.Skeleton);
        this.playSpAnim(sp_6);
        let sp_5: sp.Skeleton = xNodeFL.findComponent("5c1dj", panel, sp.Skeleton);
        this.playSpAnim(sp_5);
        let sp_7: sp.Skeleton = xNodeFL.findComponent("7c1dj", panel, sp.Skeleton);
        this.playSpAnim(sp_7);
        if (index == 0) {
            let sp_4: sp.Skeleton = xNodeFL.findComponent("4c1dj", panel, sp.Skeleton);
            this.playSpAnim(sp_4);
            let sp_3: sp.Skeleton = xNodeFL.findComponent("3c1dj", panel, sp.Skeleton);
            this.playSpAnim(sp_3);
            let sp_2: sp.Skeleton = xNodeFL.findComponent("2c1dj", panel, sp.Skeleton);
            this.playSpAnim(sp_2);
            let num = xNodeFL.find("panel/num", this.node);
            num.scale = new Vec3(0, 0, 0);
            tween(num)
                .to(triT, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                .start()

        } else if (index == 1) {
            let sp_4: sp.Skeleton = xNodeFL.findComponent("4c1dj", panel, sp.Skeleton);
            this.playSpAnim(sp_4);
            let sp_3: sp.Skeleton = xNodeFL.findComponent("3c2dj", panel, sp.Skeleton);
            this.playSpAnim(sp_3);
            let sp_2: sp.Skeleton = xNodeFL.findComponent("2c2dj", panel, sp.Skeleton);
            this.playSpAnim(sp_2);
        } else if (index == 2) {
            let sp_4: sp.Skeleton = xNodeFL.findComponent("4c3dj", panel, sp.Skeleton);
            this.playSpAnim(sp_4);
            let sp_3: sp.Skeleton = xNodeFL.findComponent("3c3dj", panel, sp.Skeleton);
            this.playSpAnim(sp_3);
            let sp_2: sp.Skeleton = xNodeFL.findComponent("2c3dj", panel, sp.Skeleton);
            this.playSpAnim(sp_2);
        }


        let self = this;
        let clickFunc = async (bStop) => {
            this.unscheduleAllCallbacks();
            let btn = xNodeFL.find("btn", this.node);
            btn.off("click");

            if (bStop) {   // 手动点击关闭
                FLAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_coins");
                let award_num: Label = xNodeFL.findComponent("panel/num/award_num", this.node, Label);
                Tween.stopAllByTarget(award_num.node);
                let str1 = award_num.string;
                let str2 = showMoney(this._winCoin);
                if (str1 != str2) {
                    xNodeFL.setLabel("", award_num.node, showMoney(this._winCoin));

                    if (index < this._winType - 1) {
                        this.playOneAnim(this._winType - 1, 0.5);
                    } else {
                        this.close();
                    }
                } else {
                    this.close();
                }
            } else {
                if (index < this._winType - 1) {
                    this.playOneAnim(index + 1);
                } else {
                    this.close();
                }
            }
        }

        if (stop) {
            this.scheduleOnce(clickFunc.bind(this, true), triT);
        } else {
            let btn = xNodeFL.find("btn", this.node);
            btn.off("click");
            if (index == 0) {
                this.scheduleOnce(() => {
                    btn.on("click", clickFunc.bind(this, true));
                    this.scheduleOnce(clickFunc.bind(this, false), rollT);
                }, 0.2)
            } else {
                btn.on("click", clickFunc.bind(this, true));
                this.scheduleOnce(clickFunc.bind(this, false), rollT);
            }
        }


    }

    playSpAnim(nSp: sp.Skeleton, anim1 = "animation", anim2 = "animation2") {
        nSp.node.active = true;
        nSp.setAnimation(0, anim1, false);
        nSp.addAnimation(0, anim2, true);
    }

    async close() {

        FLAudioMgr.Instance.stopMusic();
        FLAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_coins");
        FLAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_firework");
        FLAudioMgr.Instance.playLongEffect("games/bgm_bigwin_end");

        await this.delayTime(0.5);
        FLAudioMgr.Instance.playMusic();

        this.node.active = false;
        if (this._endFunc) {
            Tween.stopAllByTag(1)
            // Tween.stopAllByTarget()
            this._endFunc();
        }
    }
}

