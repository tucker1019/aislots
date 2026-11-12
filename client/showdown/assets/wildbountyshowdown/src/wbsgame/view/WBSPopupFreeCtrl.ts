import { _decorator, Component, instantiate, Label, Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { wbsgame } from '../wbsgame';
import { xNodeWBS } from '../../xtools/xNodeWBS';
import { showMoney } from '../../xtools/WBSUtils';
const { ccclass, property } = _decorator;

@ccclass('WBSPopupFreeCtrl')
export class WBSPopupFreeCtrl extends Component {
    start() {

    }

    triFreeGame(freeCnt: number, changeFunc = null) {
        return new Promise<void>(async (resolve, reject) => {
            wbsgame.audioMgr.playSound("fsTrans");
            let pop = xNodeWBS.find("popup_tri_free", this.node)
            if (!pop) {
                pop = instantiate(wbsgame.gamelayer.popupTriFreePrefab);
                pop.parent = this.node;
                pop.name = "popup_tri_free";
            }
            pop.active = true;
            let popOpa = pop.getComponent(UIOpacity);
            popOpa.opacity = 0;
            tween(popOpa).to(0.5, { opacity: 255 }).start();

            let labCnt = xNodeWBS.find("cnt", pop);
            xNodeWBS.setLabel("", labCnt, "" + freeCnt);
            labCnt.scale = new Vec3(0, 0, 1);
            tween(labCnt).to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" }).start();

            let btn = xNodeWBS.find("btn", pop)
            btn.scale = new Vec3(0, 0, 1);
            tween(btn).delay(0.5).to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" }).start();

            let endFunc = () => {
                if (changeFunc) changeFunc();
                // wbsgame.audioMgr.playSound("");
                this.unscheduleAllCallbacks();
                xNodeWBS.offClick("", btn, endFunc);
                tween(popOpa).to(0.3, { opacity: 0 }).call(() => {
                    pop.active = false;
                    resolve();
                }).start()
            }
            xNodeWBS.addClick("", btn, endFunc);
            this.scheduleOnce(endFunc, 8);
        })
    }

    popTriFreeAgain(freeCnt: number, func?: Function) {
        return new Promise<void>(async (resolve, reject) => {
            wbsgame.audioMgr.playSound("fsWonTitle");
            let pop = xNodeWBS.find("popup_extra_free", this.node);
            if (!pop) {
                pop = instantiate(wbsgame.gamelayer.popupExtraFreePrefab);
                pop.parent = this.node;
                pop.name = "popup_extra_free";
            }
            pop.active = true;
            let popOpa = pop.getComponent(UIOpacity);
            popOpa.opacity = 0;
            tween(popOpa).to(0.5, { opacity: 255 })
                .call(() => {
                    if (func) func()
                })
                .delay(3).to(0.3, { opacity: 0 }).call(() => {
                    pop.active = false;
                    resolve();
                })
                .start();

            let labCnt = xNodeWBS.find("cnt", pop);
            xNodeWBS.setLabel("", labCnt, "+" + freeCnt);
            labCnt.scale = new Vec3(0, 0, 1);
            tween(labCnt).to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" }).start();

        })
    }

    popEndFree(coin: number, changeFunc = null) {
        return new Promise<void>(async (resolve, reject) => {
            wbsgame.audioMgr.playLongSound("bgm_totalwin_main");

            let pop = xNodeWBS.find("popup_end_free", this.node);
            if (!pop) {
                pop = instantiate(wbsgame.gamelayer.popupEndFreePrefab);
                pop.parent = this.node;
                pop.name = "popup_end_free";
            }
            pop.active = true;
            let popOpa = pop.getComponent(UIOpacity);
            popOpa.opacity = 0;
            tween(popOpa).to(0.5, { opacity: 255 }).start();

            let layout = xNodeWBS.find("layout", pop);
            layout.scale = new Vec3(0, 0, 1);
            tween(layout).to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" }).start();

            let awardLab: Label = xNodeWBS.findComponent("layout/award", pop, Label)
            xNodeWBS.setLabelRollAni(awardLab, coin, 0, 5);

            let btn = xNodeWBS.find("btn", pop);
            btn.active = false;
            btn.scale = new Vec3(0, 0, 0);

            let endFunc = () => {
                wbsgame.audioMgr.stopLongSound("bgm_totalwin_main");
                this.unscheduleAllCallbacks();
                xNodeWBS.offClick("", btn, endFunc);
                Tween.stopAllByTag(1);
                tween(popOpa).to(0.5, { opacity: 0 }).call(() => {
                    pop.active = false;
                    resolve();
                }).start();

            }
            let func1 = () => {
                if (changeFunc) changeFunc();
                xNodeWBS.offClick("", pop, func1);
                wbsgame.audioMgr.stopLongSound("bgm_totalwin_main");
                wbsgame.audioMgr.playSound("bgm_totalwin_end");
                btn.active = true;
                tween(btn).to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" }).start();

                Tween.stopAllByTarget(awardLab.node);
                let str1 = awardLab.string;
                let str2 = showMoney(coin);
                if (str1 != str2) {
                    xNodeWBS.setLabel("", awardLab.node, showMoney(coin));
                }

                this.scheduleOnce(() => {
                    xNodeWBS.addClick("", btn, endFunc);
                }, 0.5)

                this.scheduleOnce(endFunc, 4);
            }
            xNodeWBS.addClick("", pop, func1);
            this.scheduleOnce(func1, 5);
        })
    }

}


