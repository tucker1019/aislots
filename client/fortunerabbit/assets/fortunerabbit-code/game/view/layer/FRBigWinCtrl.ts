import { _decorator, Animation, Component, Label, Node, ParticleSystem2D, sp, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { xNodeFR } from '../../../xtools/xNodeFR';
import { FRAudioMgr } from './FRAudioMgr';
import { showMoney } from '../../common/FRUtils';;
import { FRBaseNode } from '../../base/FRBaseNode';
import { FRSpriteCtrl } from './FRSpriteCtrl';
const { ccclass, property } = _decorator;

@ccclass('FRBigWinCtrl')
export class FRBigWinCtrl extends FRBaseNode {

    protected initAttribute() {
    }

    _winCoin: number = 0;   // 总赢钱
    _winType: number = 0;   // bigwin类型 1-bigwin 2-megawin 3-superwin
    _endFunc: Function = null;
    _oneRollT: number = 0;

    // bw mw smw
    playBigWin(coin, type, endFunc) {
        FRAudioMgr.Instance.stopMusic();
        FRAudioMgr.Instance.playMusic("games/Prize_Bgm");
        FRAudioMgr.Instance.playSound("games/Fireworks");

        this._winCoin = coin;
        this._winType = type;
        this._endFunc = endFunc;
        this._oneRollT = 5;

        this.node.active = true;

        let rollT = this._winType * this._oneRollT; // 金币滚动时间
        let award_num: Label = xNodeFR.findComponent("panel/num/award_num", this.node, Label);
        xNodeFR.setLabelRollAni(award_num, this._winCoin, 0, rollT);
        // FRAudioMgr.Instance.playLongEffect("games/bgm_bigwin_coins");

        this.playOneAnim(0)
    }


    // 播放一个bigwin的时间
    playOneAnim(index, stop?) {
        Tween.stopAllByTag(1)
        let panel = xNodeFR.find("panel", this.node);

        let triT = 0.5;
        let delT = 0.2;
        let rollT = this._oneRollT;

        let guangquanAnim: Animation = xNodeFR.findComponent("guangquan", panel, Animation);
        guangquanAnim.node.active = true;
        guangquanAnim.play("bigwin_f");

        let baiguang = xNodeFR.find("bw_vfx_b_add", panel);
        baiguang.active = true;
        baiguang.scale = new Vec3(1, 1, 1);
        tween(baiguang)
            .tag(1).to(delT, { scale: new Vec3(10, 10, 10) }).delay(0.1)
            .call(() => { baiguang.active = false })
            .start()
        let bw_vfx_a_screen = xNodeFR.find("bw_vfx_a_screen", panel);
        bw_vfx_a_screen.active = true;
        bw_vfx_a_screen.scale = new Vec3(1, 1, 1);
        tween(bw_vfx_a_screen)
            .tag(1).to(delT, { scale: new Vec3(10, 10, 10) }).delay(0.1)
            .call(() => { bw_vfx_a_screen.active = false })
            .start()

        let bw_vfx_h = xNodeFR.find("bw_vfx_h", panel);
        xNodeFR.find("bw_vfx_h_screen_01", bw_vfx_h).getComponent(FRSpriteCtrl).setSpriteIndex(index);
        xNodeFR.find("bw_vfx_h_screen_02", bw_vfx_h).getComponent(FRSpriteCtrl).setSpriteIndex(index);
        tween(bw_vfx_h)
            .tag(1).delay(delT)
            .call(() => { bw_vfx_h.active = true })
            .start()

        let bw_vfx_g_add_01 = xNodeFR.find("bw_vfx_g_add_01", panel);
        bw_vfx_g_add_01.getComponent(FRSpriteCtrl).setSpriteIndex(index);

        let bw_coin = xNodeFR.find("bw_coin", panel);
        bw_coin.getComponent(FRSpriteCtrl).setSpriteIndex(index);
        bw_coin.position = new Vec3(0, [-363, -344, -328][index], 0);
        tween(bw_coin)
            .tag(1).delay(delT)
            .call(() => { bw_coin.active = true })
            .start()

        let bw_a = xNodeFR.find("bw_a", panel);
        bw_a.getComponent(FRSpriteCtrl).setSpriteIndex(index);
        bw_a.position = new Vec3(0, [-30, 25, 25][index], 0);
        tween(bw_a)
            .tag(1).delay(delT)
            .call(() => { bw_a.active = true })
            .start()

        let par_coin: ParticleSystem2D = xNodeFR.findComponent("par_coin", panel, ParticleSystem2D);
        par_coin.node.active = index > 0;
        par_coin.resetSystem();

        let bw_frame_01 = xNodeFR.find("bw_frame_01", panel);
        let bw_frame_02 = xNodeFR.find("bw_frame_02", panel);
        bw_frame_01.getComponent(FRSpriteCtrl).setSpriteIndex(index);
        bw_frame_02.getComponent(FRSpriteCtrl).setSpriteIndex(index);
        bw_frame_01.getChildByName("bw_vfx_d_screen_01").getComponent(FRSpriteCtrl).setSpriteIndex(index);
        bw_frame_02.getChildByName("bw_vfx_d_screen_02").getComponent(FRSpriteCtrl).setSpriteIndex(index);
        bw_frame_01.position = new Vec3(0, [309, 365, 441][index], 0);
        bw_frame_02.position = new Vec3(0, [-371, -466, -445][index], 0);
        tween(bw_frame_01)
            .tag(1).delay(delT).call(() => { bw_frame_01.active = true })
            .repeat(Number.MAX_SAFE_INTEGER, tween().by(0.3, { position: new Vec3(0, -20, 0) }).by(0.3, { position: new Vec3(0, 20, 0) }))
            .start()
        tween(bw_frame_02)
            .tag(1).delay(delT).call(() => { bw_frame_02.active = true })
            .repeat(Number.MAX_SAFE_INTEGER, tween().by(0.3, { position: new Vec3(0, 20, 0) }).by(0.3, { position: new Vec3(0, -20, 0) }))
            .start()

        let bw_rabbit = xNodeFR.find("bw_rabbit", panel);
        bw_rabbit.getComponent(FRSpriteCtrl).setSpriteIndex(index);
        bw_rabbit.position = new Vec3(0, [105, 205, 172][index], 0);
        tween(bw_rabbit)
            .tag(1).delay(delT).call(() => { bw_rabbit.active = true })
            .repeat(Number.MAX_SAFE_INTEGER, tween().by(0.2, { position: new Vec3(0, -20, 0) }).by(0.2, { position: new Vec3(0, 20, 0) }))
            .start()

        let title = xNodeFR.find("title", panel);
        title.getComponent(FRSpriteCtrl).setSpriteIndex(index);
        title.position = new Vec3(0, -240, 0);
        title.scale = new Vec3(0, 0, 0)
        tween(title)
            .tag(1)
            .to(triT, { position: new Vec3(0, [-132, -132, -60][index], 0), scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
            .start()

        let num = xNodeFR.find("num", panel);
        if (index == 0) {
            num.scale = new Vec3(0, 0, 0);
            tween(num)
                .tag(1)
                .to(triT, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                .start()
        }

   
        let self = this;
        let clickFunc = async (bStop) => {
            this.unscheduleAllCallbacks();
            let btn = xNodeFR.find("btn", this.node);
            btn.off("click");

            if (bStop) {   // 手动点击关闭
                // FRAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_coins");
                let award_num: Label = xNodeFR.findComponent("panel/num/award_num", this.node, Label);
                Tween.stopAllByTarget(award_num.node);
                let str1 = award_num.string;
                let str2 = showMoney(this._winCoin);
                if (str1 != str2) {
                    xNodeFR.setLabel("", award_num.node, showMoney(this._winCoin));

                    if (index < this._winType - 1) {
                        this?.playOneAnim(index + 1, 0.5);
                    } else {
                        this?.closeNode();
                    }
                } else {
                    this?.closeNode();
                }
            } else {
                if (index < this._winType - 1) {
                    this?.playOneAnim(index + 1);
                } else {
                    this?.closeNode();
                }
            }
        }

        if (stop) {
            this.scheduleOnce(clickFunc.bind(this, true), triT);
        } else {
            let btn = xNodeFR.find("btn", this.node);
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


    async closeNode() {

        FRAudioMgr.Instance.stopMusic();
        // FRAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_coins");
        // FRAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_firework");
        FRAudioMgr.Instance.playLongEffect("games/Prize_Stop");

        await this.delayTime(0.5);
        FRAudioMgr.Instance.playMusic();

        this.node.active = false;
        if (this._endFunc) {
            Tween.stopAllByTag(1)
            // Tween.stopAllByTarget()
            this._endFunc();
        }
    }
}

