import { _decorator, Animation, Component, Label, Node, sp, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { xNodeFT } from '../../../xtools/xNodeFT';
import { FTAudioMgr } from './FTAudioMgr';
import { showMoney } from '../../common/FTUtils';;
import { FTBaseNode } from '../../base/FTBaseNode';
import { FTSpriteCtrl } from './FTSpriteCtrl';
const { ccclass, property } = _decorator;

@ccclass('FTBigWinCtrl')
export class FTBigWinCtrl extends FTBaseNode {

    protected initAttribute() {
    }

    _winCoin: number = 0;   // 总赢钱
    _winType: number = 0;   // bigwin类型 1-bigwin 2-megawin 3-superwin
    _endFunc: Function = null;
    _oneRollT: number = 0;

    // bw mw smw
    playBigWin(coin, type, endFunc) {
        FTAudioMgr.Instance.stopMusic();
        FTAudioMgr.Instance.playMusic("bgm_bigwin_main");

        this._winCoin = coin;
        this._winType = type;
        this._endFunc = endFunc;
        this._oneRollT = 5;

        this.node.active = true;

        let rollT = this._winType * this._oneRollT; // 金币滚动时间
        let award_num: Label = xNodeFT.findComponent("panel/num/award_num", this.node, Label);
        xNodeFT.setLabelRollAni(award_num, this._winCoin, 0, rollT);
        FTAudioMgr.Instance.playLongEffect("games/bgm_bigwin_coins");

        this.playOneAnim(0)
    }


    // 播放一个bigwin的时间
    playOneAnim(index, stop?) {
        let panel = xNodeFT.find("panel", this.node);

        let triT = 0.5;
        let rollT = this._oneRollT;
        let xiangYunOpa: UIOpacity = xNodeFT.findComponent("xiangYun", panel, UIOpacity);
        xiangYunOpa.node.getComponent(FTSpriteCtrl).setSpriteIndex(index)
        xiangYunOpa.opacity = 0;
        tween(xiangYunOpa)
            .tag(1)
            .to(triT, { opacity: 255 })
            .start();
        xiangYunOpa.node.scale = new Vec3(1.5, 1.5, 0);
        tween(xiangYunOpa.node)
            .tag(1)
            .delay(triT)
            .to(0.8, { scale: new Vec3(1.4, 1.4, 0) })
            .start()

        let guang1 = xNodeFT.find("guang1", panel);
        guang1.getComponent(FTSpriteCtrl).setSpriteIndex(index)
        guang1.scale = new Vec3(0, 0, 0);
        tween(guang1)
            .tag(1)
            .to(triT, { scale: new Vec3(5, 5, 0) })
            .to(triT, { scale: new Vec3(3, 3, 0) })
            .start()

        let yuanQuan = xNodeFT.find("yuanQuan", panel);
        tween(yuanQuan)
            .tag(1)
            .repeatForever(
                tween()
                    .call(() => {
                        yuanQuan.eulerAngles = new Vec3(0, 0, 0)
                    }))
            .to(15, { eulerAngles: new Vec3(0, 0, -360) })
            .start()

        let daHua = xNodeFT.find("daHua", panel);
        daHua.scale = new Vec3(1.8, 1.8, 0);
        tween(daHua)
            .tag(1)
            .to(rollT, { scale: new Vec3(2, 2, 0) })
            .start()

        let daYuanBao = xNodeFT.find("daYuanBao", panel);
        daYuanBao.scale = new Vec3(1.8, 1.8, 0);
        tween(daYuanBao)
            .tag(1)
            .to(rollT, { scale: new Vec3(2, 2, 0) })
            .start()

        let frame_guang = xNodeFT.find("frame_guang", panel);
        frame_guang.getComponent(FTSpriteCtrl).setSpriteIndex(index)
        frame_guang.active = false;

        let frameT = xNodeFT.find("frameT", panel);
        frameT.getComponent(FTSpriteCtrl).setSpriteIndex(index)
        frameT.position = new Vec3(0, -22, 0);
        tween(frameT)
            .tag(1)
            .to(triT, { position: new Vec3(0, [200, 233, 299][index], 0) }, { easing: "backOut" })
            .call(() => {
                frame_guang.active = true;
            })
            .start()

        let frameB = xNodeFT.find("frameB", panel);
        frameB.getComponent(FTSpriteCtrl).setSpriteIndex(index)
        frameB.position = new Vec3(0, -99, 0);
        tween(frameB)
            .tag(1)
            .to(triT, { position: new Vec3(0, [-238, -262, -266][index], 0) }, { easing: "backOut" })
            .start()

        let character_sp: sp.Skeleton = xNodeFT.findComponent("ui_winscreens", panel, sp.Skeleton);
        character_sp.setAnimation(0, `${["bw", "mw", "smw"][index]}_spawn`, false);
        character_sp.addAnimation(0, `${["bw", "mw", "smw"][index]}_idle`, true);
        character_sp.node.position = new Vec3(0, [195, 227, 296][index], 0);

        let title = xNodeFT.find("title", panel);
        title.getComponent(FTSpriteCtrl).setSpriteIndex(index)
        title.position = new Vec3(0, -25, 0);
        title.scale = new Vec3(0, 0, 0)
        tween(title)
            .tag(1)
            .to(triT, { position: new Vec3(0, [104, 136, 152][index], 0), scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
            .start()

        let num = xNodeFT.find("num", panel);
        if (index == 0) {
            num.scale = new Vec3(0, 0, 0);
            tween(num)
                .tag(1)
                .to(triT, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                .start()
        }

        let xiaoYanHua1: Animation = xNodeFT.findComponent("xiaoYanHua1", panel, Animation);
        xiaoYanHua1.play("xiaoYanHua");
        let xiaoYanHua2: Animation = xNodeFT.findComponent("xiaoYanHua2", panel, Animation);
        xiaoYanHua2.play("xiaoYanHua");
        let daYanHua: Animation = xNodeFT.findComponent("daYanHua", panel, Animation);
        daYanHua.play("xiaoYanHua");
        FTAudioMgr.Instance.playLongEffect("games/bgm_bigwin_firework");

        let self = this;
        let clickFunc = async (bStop) => {
            this.unscheduleAllCallbacks();
            let btn = xNodeFT.find("btn", this.node);
            btn.off("click");

            if (bStop) {   // 手动点击关闭
                FTAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_coins");
                let award_num: Label = xNodeFT.findComponent("panel/num/award_num", this.node, Label);
                Tween.stopAllByTarget(award_num.node);
                let str1 = award_num.string;
                let str2 = showMoney(this._winCoin);
                if (str1 != str2) {
                    xNodeFT.setLabel("", award_num.node, showMoney(this._winCoin));

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
            let btn = xNodeFT.find("btn", this.node);
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


    async close() {

        FTAudioMgr.Instance.stopMusic();
        FTAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_coins");
        FTAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_firework");
        FTAudioMgr.Instance.playLongEffect("games/bgm_bigwin_end");

        await this.delayTime(0.5);
        FTAudioMgr.Instance.playMusic();

        this.node.active = false;
        if (this._endFunc) {
            Tween.stopAllByTag(1)
            // Tween.stopAllByTarget()
            this._endFunc();
        }
    }
}

