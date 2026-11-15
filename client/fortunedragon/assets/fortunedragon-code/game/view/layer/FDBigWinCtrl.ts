import { _decorator, Animation, Component, instantiate, Label, Node, ParticleSystem2D, sp, tween, Tween, UI, UIOpacity, UITransform, Vec3, view } from 'cc';
import { xNodeFD } from '../../../xtools/xNodeFD';
import { FDAudioMgr } from './FDAudioMgr';
import { showMoney } from '../../common/FDUtils';;
import { FDBaseNode } from '../../base/FDBaseNode';
import { FDSpriteCtrl } from './FDSpriteCtrl';
import FDLoadManager from '../../load/FDLoadManager';
import { FDGameManager } from '../../mgr/FDGameManager';
const { ccclass, property } = _decorator;

@ccclass('FDBigWinCtrl')
export class FDBigWinCtrl extends FDBaseNode {

    protected initAttribute() {
    }

    _winCoin: number = 0;   // 总赢钱
    _winType: number = 0;   // bigwin类型 1-bigwin 2-megawin 3-superwin
    _endFunc: Function = null;
    _rollTList: number[] = [];

    _bPlayFire: boolean = false;

    // bw mw smw
    playBigWin(coin, type, endFunc) {
        FDAudioMgr.Instance.stopMusic();
        FDAudioMgr.Instance.playLongEffect("bgm_bigwin");

        this._winCoin = coin;
        this._winType = type;
        this._endFunc = endFunc;
        this._rollTList = [6, 6.5, 11.5];

        this._bPlayFire = false;

        this.node.active = true;

        let rollT = this._winType * (this._rollTList.slice(0, type).reduce((sum, cur) => { return sum + cur }, 0)); // 金币滚动时间
        let award_num: Label = xNodeFD.findComponent("panel/num/award_num", this.node, Label);
        xNodeFD.setLabelRollAni(award_num, this._winCoin, 0, rollT);

        this.playOneAnim(0)

    }


    // 播放一个bigwin的时间
    async playOneAnim(index, bLast?) {
        let triT = 0.5;
        let rollT = this._rollTList[index];

        if (!this._bPlayFire) {
            this._bPlayFire = true;
            this.playfireworkAnim();
        }

        let panel = xNodeFD.find("panel", this.node);
        let bw_cloud_b_l = xNodeFD.find("bw_cloud_b_l", panel);
        let bw_cloud_b_r = xNodeFD.find("bw_cloud_b_r", panel);
        let bw_chac = xNodeFD.find("bw_chac", panel);
        let bw_chac_opa = bw_chac.getComponent(UIOpacity);
        let bw_vfx_b_screen = xNodeFD.find("bw_vfx_b_screen", panel);
        let bw_vfx_c_screen_opa: UIOpacity = xNodeFD.findComponent("bw_vfx_c_screen", panel, UIOpacity);
        let frameList = [];
        frameList[0] = xNodeFD.find("bw_frame_a_l", panel);
        frameList[1] = xNodeFD.find("bw_frame_a_r", panel);
        frameList[2] = xNodeFD.find("bw_frame_b_l", panel);
        frameList[3] = xNodeFD.find("bw_frame_b_r", panel);
        let bw_vfx_a_add = xNodeFD.find("bw_vfx_a_add", this.node);
        let bw_vfx_a_add_opa = bw_vfx_a_add.getComponent(UIOpacity);
        let title = xNodeFD.find("title", panel);
        title.getComponent(FDSpriteCtrl).sprIndex = index;
        let num = xNodeFD.find("num", panel);


        if (bLast) {
            Tween.stopAllByTag(1);

            FDAudioMgr.Instance.stopLongEffect("bgm_bigwin");
            FDAudioMgr.Instance.playLongEffect("bgm_bigwin_end");

            bw_vfx_a_add.active = true
            bw_vfx_a_add.scale = new Vec3(0, 0, 1);
            tween(bw_vfx_a_add).tag(1).to(0.3, { scale: new Vec3(3, 3, 1) }).start();
            bw_vfx_a_add_opa.opacity = 255;
            tween(bw_vfx_a_add_opa).tag(1).delay(0.3).to(0.2, { opacity: 0 }).start();

            bw_cloud_b_l.getComponent(FDSpriteCtrl).sprIndex = index;
            bw_cloud_b_l.active = true;
            bw_cloud_b_l.position = new Vec3(0, 274 + 10 * index)
            bw_cloud_b_r.getComponent(FDSpriteCtrl).sprIndex = index;
            bw_cloud_b_r.active = true;
            bw_cloud_b_r.position = new Vec3(0, 274 + 10 * index)

            bw_chac.active = true;
            bw_chac.scale = new Vec3(1.4, 1.4, 1);
            bw_chac.position = new Vec3(0, [130, 130, 56][index], 0)
            bw_chac.getComponent(FDSpriteCtrl).sprIndex = index;
            bw_chac_opa.opacity = 255;

            bw_vfx_b_screen.active = true;
            bw_vfx_b_screen.scale = new Vec3(1, 1, 1);
            bw_vfx_c_screen_opa.node.active = true;
            bw_vfx_c_screen_opa.opacity = 255;

            for (let i = 0; i < frameList.length; i++) {
                frameList[i].getComponent(FDSpriteCtrl).sprIndex = index;
                frameList[i].position = new Vec3(0, i < 2 ? 210 + 10 * index : -210 - 10 * index);
                frameList[i].opacity = 255;
            }

            title.scale = new Vec3(1, 1, 1);
            title.position = new Vec3(0, 180 + 10 * index);
            num.active = true;
            num.scale = new Vec3(1, 1, 1);

            let award_num: Label = xNodeFD.findComponent("panel/num/award_num", this.node, Label);
            Tween.stopAllByTarget(award_num.node);
            let str1 = award_num.string;
            let str2 = showMoney(this._winCoin);
            if (str1 != str2) {
                xNodeFD.setLabel("", award_num.node, showMoney(this._winCoin));
            }
        } else {
            bw_vfx_a_add.active = true
            bw_vfx_a_add.scale = new Vec3(0, 0, 1);
            tween(bw_vfx_a_add).tag(1).to(0.5, { scale: new Vec3(3, 3, 1) }).start();
            bw_vfx_a_add_opa.opacity = 255;
            tween(bw_vfx_a_add_opa).tag(1).delay(0.5).to(0.2, { opacity: 0 }).start();
            // screenList.forEach(node => {
            //     node.active = false;
            // })
            if (index == 0) {
                bw_cloud_b_l.getComponent(FDSpriteCtrl).sprIndex = index;
                bw_cloud_b_l.active = false;
                bw_cloud_b_l.position = new Vec3(-view.getVisibleSize().width / 2, 274 + 10 * index)
                tween(bw_cloud_b_l).tag(1).delay(0.5).call(() => { bw_cloud_b_l.active = true }).to(0.5, { position: new Vec3(0, 274 + 10 * index) }).start();
                bw_cloud_b_r.getComponent(FDSpriteCtrl).sprIndex = index;
                bw_cloud_b_r.active = false;
                bw_cloud_b_r.position = new Vec3(view.getVisibleSize().width / 2, 274 + 10 * index)
                tween(bw_cloud_b_r).tag(1).delay(0.5).call(() => { bw_cloud_b_r.active = true }).to(0.5, { position: new Vec3(0, 274 + 10 * index) }).start();

                bw_chac.active = false;
                bw_chac.scale = new Vec3(1, 1, 1);
                bw_chac.position = new Vec3(0, [130, 130, 56][index], 0)
                bw_chac.getComponent(FDSpriteCtrl).sprIndex = index;
                tween(bw_chac).tag(1).delay(0.3).call(() => { bw_chac.active = true }).to(0.5, { scale: new Vec3(1.4, 1.4, 1) }).start()
                bw_chac_opa.opacity = 0;
                tween(bw_chac_opa).tag(1).delay(0.3).to(0.5, { opacity: 255 }).start()

                bw_vfx_b_screen.active = false;
                bw_vfx_b_screen.scale = new Vec3(0, 0, 1);
                tween(bw_vfx_b_screen).tag(1).delay(0.3).call(() => { bw_vfx_b_screen.active = true }).to(0.5, { scale: new Vec3(1, 1, 1) }).start();
                bw_vfx_c_screen_opa.node.active = false;
                bw_vfx_c_screen_opa.opacity = 0;
                tween(bw_vfx_c_screen_opa).tag(1).delay(0.3).call(() => { bw_vfx_c_screen_opa.node.active = true }).to(0.5, { opacity: 255 }).start();

                for (let i = 0; i < frameList.length; i++) {
                    frameList[i].getComponent(FDSpriteCtrl).sprIndex = index;
                    frameList[i].position = new Vec3(0, 0);
                    tween(frameList[i]).tag(1)
                        .to(0.3, { position: new Vec3(0, i < 2 ? 180 + 10 * index : -180 - 10 * index) })
                        .by(rollT - 0.5, { position: new Vec3(0, i < 2 ? 30 : -30) })
                        .start();
                    frameList[i].opacity = 0;
                    tween(frameList[i]).tag(1).to(0.5, { opacity: 255 }).start();
                }

                title.scale = new Vec3(0, 0, 1);
                title.position = new Vec3(0, 0);
                tween(title).tag(1).to(0.5, { scale: new Vec3(1, 1, 1), position: new Vec3(0, 180 + 10 * index) }).start();
                num.active = false;
                num.scale = new Vec3(0, 0, 1);
                tween(num).tag(1).call(() => { num.active = true }).to(0.3, { scale: new Vec3(1, 1, 1) }).start();
            } else {
                tween(bw_cloud_b_l).tag(1).to(0.5, { position: new Vec3(-view.getVisibleSize().width / 2, 274 + 10 * index) }).call(() => { bw_cloud_b_l.getComponent(FDSpriteCtrl).sprIndex = index; }).to(0.5, { position: new Vec3(0, 274 + 10 * index) }).start();
                tween(bw_cloud_b_r).tag(1).to(0.5, { position: new Vec3(view.getVisibleSize().width / 2, 274 + 10 * index) }).call(() => { bw_cloud_b_r.getComponent(FDSpriteCtrl).sprIndex = index; }).to(0.5, { position: new Vec3(0, 274 + 10 * index) }).start();

                bw_chac.scale = new Vec3(1, 1, 1);
                bw_chac.position = new Vec3(0, [130, 130, 56][index], 0)
                bw_chac.getComponent(FDSpriteCtrl).sprIndex = index;
                tween(bw_chac).tag(1).to(0.3, { scale: new Vec3(1.4, 1.4, 1) }).start()
                bw_chac_opa.opacity = 0;
                tween(bw_chac_opa).tag(1).to(0.3, { opacity: 255 }).start()

                for (let i = 0; i < frameList.length; i++) {
                    frameList[i].getComponent(FDSpriteCtrl).sprIndex = index;
                    frameList[i].position = new Vec3(0, 0);
                    tween(frameList[i]).tag(1)
                        .to(0.3, { position: new Vec3(0, i < 2 ? 180 + 10 * index : -180 - 10 * index) })
                        .by(rollT - 0.5, { position: new Vec3(0, i < 2 ? 30 : -30) }).start();
                    frameList[i].opacity = 0;
                    tween(frameList[i]).tag(1).to(0.5, { opacity: 255 }).start();
                }
            }
        }

        let self = this;
        let clickFunc = async (bLast, bClick) => {
            this.unscheduleAllCallbacks();
            let btn = xNodeFD.find("btn", this.node);
            btn.off("click");

            if (bLast) {
                this?.close();
            } else {
                if (bClick) {
                    this?.playOneAnim(this._winType - 1, true);
                } else {
                    if (index < this._winType - 1) {
                        this?.playOneAnim(index + 1, false);
                    } else if (index == this._winType - 1) {
                        this?.playOneAnim(index, true);
                    } else {
                        this?.close();
                    }
                }
            }
        }

        let btn = xNodeFD.find("btn", this.node);
        btn.off("click");
        if (bLast) {
            this.scheduleOnce(clickFunc.bind(this, bLast, false), 1);
        } else {
            this.scheduleOnce(() => {
                btn.on("click", clickFunc.bind(this, bLast, true));
            }, index == 0 ? 0.2 : 0)
            this.scheduleOnce(clickFunc.bind(this, bLast, false), rollT);
        }
    }


    // 背景烟花动画
    playfireworkAnim() {
        // FDAudioMgr.Instance.playSound("fireworkBigwinEnd");
        let firework = xNodeFD.find("firework", this.node);

        for (let i = 0; i < firework.children.length; i++) {
            let node = firework.children[i];
            let sPos = new Vec3(node.position.x, node.position.y, 0);
            tween(node)
                .tag(1)
                .repeatForever(
                    tween()
                        .tag(1)
                        .delay(Math.random())
                        .call(() => {
                            node.position = new Vec3(sPos.x + Math.random() * 300 - 150, sPos.y + Math.random() * 200 - 100, 0);
                            node.active = true;
                            let scaleR = Math.random() * 2 + 1;
                            node.scale = new Vec3(scaleR, scaleR, 1);
                            node.getComponent(Animation).play();
                        })
                        .delay(Math.random() * 1.8 + 1)
                )
                .start()
        }
    }

    async close() {
        FDAudioMgr.Instance.stopLongEffect("bgm_bigwin");
        await this.delayTime(0.5);
        this.node.active = false;
        Tween.stopAllByTag(1);
        FDAudioMgr.Instance.stopLongEffect("bgm_bigwin_end");
        FDGameManager.isStateFree() ? FDAudioMgr.Instance.playMusic("bgm_fs_loop") : FDAudioMgr.Instance.playMusic();
        if (this._endFunc) {
            this._endFunc();
        }
    }
}

