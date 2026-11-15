import { _decorator, Animation, Component, instantiate, Label, Node, ParticleSystem2D, sp, tween, Tween, UI, UIOpacity, UITransform, Vec3 } from 'cc';
import { xNodeFOX } from '../../../xtools/xNodeFOX';
import { FOXAudioMgr } from './FOXAudioMgr';
import { showMoney } from '../../common/FOXUtils';;
import { FOXBaseNode } from '../../base/FOXBaseNode';
import { FOXSpriteCtrl } from './FOXSpriteCtrl';
import FOXLoadManager from '../../load/FOXLoadManager';
const { ccclass, property } = _decorator;

@ccclass('FOXBigWinCtrl')
export class FOXBigWinCtrl extends FOXBaseNode {

    protected initAttribute() {
    }

    _winCoin: number = 0;   // 总赢钱
    _winType: number = 0;   // bigwin类型 1-bigwin 2-megawin 3-superwin
    _endFunc: Function = null;
    _oneRollT: number = 0;

    // bw mw smw
    playBigWin(coin, type, endFunc) {
        FOXAudioMgr.Instance.stopMusic();
        FOXAudioMgr.Instance.playMusic("games/bgm_bigwin_main");

        this._winCoin = coin;
        this._winType = type;
        this._endFunc = endFunc;
        this._oneRollT = 5;

        this.node.active = true;

        let rollT = this._winType * this._oneRollT; // 金币滚动时间
        let award_num: Label = xNodeFOX.findComponent("panel/bw_num_board/award_num", this.node, Label);
        xNodeFOX.setLabelRollAni(award_num, this._winCoin, 0, rollT);
        // FOXAudioMgr.Instance.playLongEffect("games/bgm_bigwin_coins");

        this.playAvatarAnim("tri");
        this.playOneAnim(0)
    }


    // 播放一个bigwin的时间
    async playOneAnim(index, bLast?) {
        let panel = xNodeFOX.find("panel", this.node);

        let triT = 0.5;
        let rollT = this._oneRollT;


        if (bLast) {
            FOXAudioMgr.Instance.stopMusic();
            FOXAudioMgr.Instance.playLongEffect("games/bgm_bigwin_end");


            let award_num: Label = xNodeFOX.findComponent("panel/bw_num_board/award_num", this.node, Label);
            Tween.stopAllByTarget(award_num.node);
            let str1 = award_num.string;
            let str2 = showMoney(this._winCoin);
            if (str1 != str2) {
                xNodeFOX.setLabel("", award_num.node, showMoney(this._winCoin));
            }

            let bw_num_board = xNodeFOX.find("bw_num_board", panel);
            tween(bw_num_board).to(0.3, { scale: new Vec3(1.2, 1.2, 1) }).to(0.2, { scale: new Vec3(1, 1, 1) }).start();

            this.playAvatarAnim("end");

        } else {

            let bw_bg = xNodeFOX.find("bw_bg", panel);
            bw_bg.active = true;
            bw_bg.getComponent(FOXSpriteCtrl).sprIndex = index;
            bw_bg.scale = new Vec3(0, 0);
            tween(bw_bg).to(0.3, { scale: new Vec3(1, 1) }, { easing: "backOut" }).start();
            bw_bg.position = new Vec3(0, [0, 10, 50][index], 0);

            if (index == 0) {
                let bw_bg_spark_00: Animation = xNodeFOX.findComponent("bw_bg_spark_00", panel, Animation);
                bw_bg_spark_00.node.active = true;
                bw_bg_spark_00.play();
                let bw_bg_spark_01: Animation = xNodeFOX.findComponent("bw_bg_spark_01", panel, Animation);
                bw_bg_spark_01.node.active = true;
                bw_bg_spark_01.play();
                let bw_bg_spark_02: Animation = xNodeFOX.findComponent("bw_bg_spark_02", panel, Animation);
                bw_bg_spark_02.node.active = true;
                bw_bg_spark_02.play();
                let bw_bg_spark_03: Animation = xNodeFOX.findComponent("bw_bg_spark_03", panel, Animation);
                bw_bg_spark_03.node.active = true;
                bw_bg_spark_03.play();

                this.playfireworkAnim();
            }

            let bw_shine: Animation = xNodeFOX.findComponent("bw_shine", panel, Animation);
            bw_shine.node.active = true;
            bw_shine.play();

            let bw_glow = xNodeFOX.find("bw_glow", panel);
            bw_glow.active = true;
            bw_glow.scale = new Vec3(0, 0);
            tween(bw_glow).to(0.5, { scale: new Vec3(1, 1) }, { easing: "backOut" }).start();

            let bw_num_board_opa: UIOpacity = xNodeFOX.findComponent("bw_num_board", panel, UIOpacity);
            bw_num_board_opa.node.active = true;
            bw_num_board_opa.opacity = 0;
            tween(bw_num_board_opa).to(0.5, { opacity: 255 }).start();

            let title = xNodeFOX.find("title", panel);
            title.getComponent(FOXSpriteCtrl).setSpriteIndex(index);
            title.scale = new Vec3(0, 0);
            tween(title).to(0.5, { scale: new Vec3(1, 1) }, { easing: "backOut" }).start();
            let title_opa: UIOpacity = title.getComponent(UIOpacity);
            title_opa.opacity = 0;
            tween(title_opa).to(0.5, { opacity: 255 }).start();

            let par_dd: ParticleSystem2D = xNodeFOX.findComponent("par_dd", panel, ParticleSystem2D)
            par_dd.node.active = true;
            par_dd.resetSystem();
            if (index == 2) {
                this.playCoinAnim();
            }
        }

        let self = this;
        let clickFunc = async (bLast, bClick) => {
            this.unscheduleAllCallbacks();
            let btn = xNodeFOX.find("btn", this.node);
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

        let btn = xNodeFOX.find("btn", this.node);
        btn.off("click");
        if (bLast) {
            btn.on("click", clickFunc.bind(this, true, true));
            this.scheduleOnce(clickFunc.bind(this, bLast, false), 0.8);
        } else {
            this.scheduleOnce(() => {
                btn.on("click", clickFunc.bind(this, bLast, true));
            }, index == 0 ? 0.2 : 0)
            this.scheduleOnce(clickFunc.bind(this, bLast, false), rollT);
        }
    }


    // 背景烟花动画
    playfireworkAnim() {
        let firework = xNodeFOX.find("panel/firework", this.node);

        for (let i = 0; i < firework.children.length; i++) {
            let node = firework.children[i];
            let sPos = new Vec3(node.position.x, node.position.y, 0);
            tween(node)
                .tag(1)
                .repeatForever(
                    tween()
                        .delay(Math.random())
                        .call(() => {
                            node.position = new Vec3(sPos.x + Math.random() * 300 - 150, sPos.y + Math.random() * 200 - 100, 0);
                            node.active = true;
                            let scaleR = Math.random() + 1;
                            node.scale = new Vec3(scaleR, scaleR, 1);
                            node.getComponent(Animation).play();
                        })
                        .delay(Math.random() * 1.8 + 1)
                )
                .start()
        }
    }

    playCoinAnim() {
        let bw_coin = xNodeFOX.find("panel/bw_coin", this.node);

        let length = Math.max(this.node.getComponent(UITransform).width, this.node.getComponent(UITransform).height);
        tween(bw_coin)
            .tag(1)
            .repeatForever(tween().call(() => {
                let coin = instantiate(FOXLoadManager.ins.getPrefab("res/load/prefab/games/bw_coin"));
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


    playAvatarAnim(type) {
        let avaterSp: sp.Skeleton = xNodeFOX.findComponent("panel/avatar_ox_atlas_avatar_ox", this.node, sp.Skeleton);

        if (type == "tri") {
            avaterSp.setAnimation(0, "rsg_spawn", false);
            avaterSp.addAnimation(0, "rsg_win_idle2", true);
        } else if (type == "end") {
            avaterSp.setAnimation(0, "rsg_win_exit2", false);
            avaterSp.addAnimation(0, "rs_idle2", true);
        }
    }

    async close() {

        await this.delayTime(0.5);
        FOXAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_end");
        this.node.active = false;
        Tween.stopAllByTag(1);
        FOXAudioMgr.Instance.playMusic();
        if (this._endFunc) {
            this._endFunc();
        }
    }
}

