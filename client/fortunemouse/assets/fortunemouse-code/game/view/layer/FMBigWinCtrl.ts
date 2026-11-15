import { _decorator, Animation, Component, instantiate, Label, Node, ParticleSystem2D, sp, tween, Tween, UI, UIOpacity, UITransform, Vec3 } from 'cc';
import { xNodeFM } from '../../../xtools/xNodeFM';
import { FMAudioMgr } from './FMAudioMgr';
import { showMoney } from '../../common/FMUtils';;
import { FMBaseNode } from '../../base/FMBaseNode';
import { FMSpriteCtrl } from './FMSpriteCtrl';
import FMLoadManager from '../../load/FMLoadManager';
const { ccclass, property } = _decorator;

@ccclass('FMBigWinCtrl')
export class FMBigWinCtrl extends FMBaseNode {

    protected initAttribute() {
    }

    _winCoin: number = 0;   // 总赢钱
    _winType: number = 0;   // bigwin类型 1-bigwin 2-megawin 3-superwin
    _endFunc: Function = null;
    _oneRollT: number = 0;

    // bw mw smw
    playBigWin(coin, type, endFunc) {
        FMAudioMgr.Instance.stopMusic();
        FMAudioMgr.Instance.playMusic("games/bgmBigwinMain");

        this._winCoin = coin;
        this._winType = type;
        this._endFunc = endFunc;
        this._oneRollT = 5;

        this.node.active = true;

        let rollT = this._winType * this._oneRollT; // 金币滚动时间
        let award_num: Label = xNodeFM.findComponent("panel/bw_num_board/award_num", this.node, Label);
        xNodeFM.setLabelRollAni(award_num, this._winCoin, 0, rollT);
        // FMAudioMgr.Instance.playLongEffect("games/bgm_bigwin_coins");

        this.playfireworkAnim();
        this.playOneAnim(0)
    }


    // 播放一个bigwin的时间
    playOneAnim(index, stop?) {
        let panel = xNodeFM.find("panel", this.node);

        let triT = 0.5;

        let bw_glow_a_0 = xNodeFM.find("bw_glow_a_0", panel);
        bw_glow_a_0.scale = new Vec3(0, 0, 0);
        bw_glow_a_0.active = true;
        tween(bw_glow_a_0)
            .tag(1)
            .to(triT - 0.2, { scale: new Vec3(5, 5, 0) })
            .call(() => { bw_glow_a_0.active = false; })
            .start()

        let bw_glow_a = xNodeFM.find("bw_glow_a", panel);
        if (index == 0) bw_glow_a.scale = new Vec3(0, 0, 0);
        bw_glow_a.active = true;
        tween(bw_glow_a)
            .tag(1)
            .delay(triT)
            .call(() => { bw_glow_a.active = true; })
            .to(0.5, { scale: new Vec3([1.2, 1.5, 1.8][index], [1.2, 1.5, 1.8][index], 1) }, { easing: "backOut" })
            .start()

        let bw_glow_b = xNodeFM.find("bw_glow_b", panel);
        if (index == 0) bw_glow_b.scale = new Vec3(0, 0, 0);
        bw_glow_b.active = false;
        tween(bw_glow_b)
            .tag(1)
            .delay(triT)
            .call(() => { bw_glow_b.active = true; })
            .to(0.5, { scale: new Vec3([0.9, 1.2, 1.5][index], [0.9, 1.2, 1.5][index], 1) }, { easing: "backOut" })
            .start()

        let bw_shine = xNodeFM.find("bw_shine", panel);
        if (index == 0) bw_shine.scale = new Vec3(0, 0, 0);
        tween(bw_shine)
            .tag(1)
            .delay(triT - 0.2)
            .to(0.2, { scale: new Vec3([1, 1.3, 1.6][index], [1, 1.3, 1.6][index], 1) }, { easing: "backOut" })
            .to(15, { eulerAngles: new Vec3(0, 0, -360) })
            .start()

        let spark_01 = xNodeFM.find("spark_01", panel);
        let spark_02 = xNodeFM.find("spark_02", panel);
        let spark_03 = xNodeFM.find("spark_03", panel);
        let spark_04 = xNodeFM.find("spark_04", panel);
        if (index == 0) {
            spark_01.active = true;
            spark_02.active = true;
            spark_03.active = true;
            spark_04.active = true;
            spark_01.scale = new Vec3(0, 0, 0);
            spark_02.scale = new Vec3(0, 0, 0);
            spark_03.scale = new Vec3(0, 0, 0);
            spark_04.scale = new Vec3(0, 0, 0);
        }
        let sparkAnim = tween().delay(triT - 0.2).to(0.2, { scale: new Vec3([1.3, 1.6, 1.9][index], [1.3, 1.6, 1.9][index], 1) }, { easing: "backOut" });
        sparkAnim.clone(spark_01).start();
        sparkAnim.clone(spark_02).start();
        sparkAnim.clone(spark_03).start();
        sparkAnim.clone(spark_04).start();

        let title = xNodeFM.find("title", panel);
        title.getComponent(FMSpriteCtrl).setSpriteIndex(index);
        if (index > 0) {
            tween(title)
                .tag(1)
                .to(triT - 0.2, { scale: new Vec3(0, 0, 0), position: new Vec3(0, 0, 0) })
                .to(0.3, { position: new Vec3(0, 180, 0), scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                .start()
        } else {
            title.position = new Vec3(0, 0, 0);
            title.scale = new Vec3(0, 0, 0);
            tween(title)
                .tag(1)
                .to(triT, { position: new Vec3(0, 180, 0), scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                .start()
        }

        let bw_num_board = xNodeFM.find("bw_num_board", panel);
        if (index > 0) {
            tween(bw_num_board)
                .tag(1)
                .to(triT - 0.2, { scale: new Vec3(1.1, 1.1, 1) })
                .to(0.2, { scale: new Vec3(1, 1, 1) })
                .start()
        } else {
            bw_num_board.scale = new Vec3(0, 0, 0);
            tween(bw_num_board)
                .tag(1)
                .to(triT, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                .start();
        }

        let par_dd: ParticleSystem2D = xNodeFM.findComponent("par_dd", panel, ParticleSystem2D)
        par_dd.node.active = index == 1;
        if (index == 1) {
            par_dd.resetSystem();
        }

        if (index == 2) {
            this.playCoinAnim();
        }


        let self = this;
        let clickFunc = async (bStop) => {
            this.unscheduleAllCallbacks();
            let btn = xNodeFM.find("btn", this.node);
            btn.off("click");

            if (bStop) {   // 手动点击关闭
                // FMAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_coins");
                let award_num: Label = xNodeFM.findComponent("panel/bw_num_board/award_num", this.node, Label);
                Tween.stopAllByTarget(award_num.node);
                let str1 = award_num.string;
                let str2 = showMoney(this._winCoin);
                if (str1 != str2) {
                    xNodeFM.setLabel("", award_num.node, showMoney(this._winCoin));

                    if (index < this._winType - 1) {
                        this.playOneAnim(index + 1, 0.5);
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
            let btn = xNodeFM.find("btn", this.node);
            btn.off("click");
            if (index == 0) {
                this.scheduleOnce(() => {
                    btn.on("click", clickFunc.bind(this, true));
                    this.scheduleOnce(clickFunc.bind(this, false), this._oneRollT);
                }, 0.2)
            } else {
                btn.on("click", clickFunc.bind(this, true));
                this.scheduleOnce(clickFunc.bind(this, false), this._oneRollT);
            }
        }
    }


    // 背景烟花动画
    playfireworkAnim() {
        let firework = xNodeFM.find("panel/firework", this.node);

        for (let i = 0; i < firework.children.length; i++) {
            let node = firework.children[i];
            let sPos = new Vec3(node.position.x, node.position.y, 0);
            tween(node)
                .tag(1)
                .repeatForever(
                    tween()
                        .delay(Math.random() + 1)
                        .call(() => {
                            node.position = new Vec3(sPos.x + Math.random() * 300 - 150, sPos.x + Math.random() * 400 - 200, 0);
                            node.active = true;
                            let scaleR = Math.random() + 1.5;
                            node.scale = new Vec3(scaleR, scaleR, 1);
                            node.getComponent(Animation).play();
                        })
                        .delay(Math.random() * 1.2)
                )
                .start()
        }
    }

    playCoinAnim() {
        let bw_coin = xNodeFM.find("panel/bw_coin", this.node);

        let length = Math.max(this.node.getComponent(UITransform).width, this.node.getComponent(UITransform).height);
        tween(bw_coin)
            .tag(1)
            .repeatForever(tween().call(() => {
                let coin = instantiate(FMLoadManager.ins.getPrefab("res/load/prefab/games/bw_coin"));
                coin.parent = bw_coin;
                coin.position = new Vec3(0, 0, 0);
                let angle = Math.random() * 360;
                let x = length * Math.cos(angle)
                let y = length * Math.sin(angle)
                tween(coin)
                    .to(2.5, { position: new Vec3(x, y, 0) })
                    .call(() => {
                        coin.destroy();
                    })
                    .start()
            }).delay(0.05))
            .start()
    }



    async close() {
        FMAudioMgr.Instance.stopMusic();
        FMAudioMgr.Instance.playLongEffect("games/bgmBigwinEnd");

        await this.delayTime(0.5);
        this.node.active = false;
        Tween.stopAllByTag(1);
        FMAudioMgr.Instance.playMusic();
        if (this._endFunc) {
            this._endFunc();
        }
    }
}

