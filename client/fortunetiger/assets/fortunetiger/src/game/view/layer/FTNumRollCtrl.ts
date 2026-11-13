import { _decorator, Component, Node, Label, Tween, tween, Vec3, Animation, isValid } from 'cc';
import { xNodeFT } from '../../../xtools/xNodeFT';
import { formatStr, showMoney } from '../../common/FTUtils';
import { FTAudioMgr } from './FTAudioMgr';
import { FTGlobal } from './FTGlobal';
const { ccclass, property } = _decorator;

@ccclass('FTNumRollCtrl')
export class FTNumRollCtrl extends Component {


    lab_num: Label = null;
    curNum = 0;

    onLoad() {
        this.lab_num = this.node.getComponent(Label);

    }
    setNumAni(num: number, time: number = 0.4, speed: number = 0.02) {
        if (Number.isNaN(num)) {
            console.error("user gold is ", num)
            return
        }
        this.lab_num.string = String(this.curNum)
        if (this.curNum != num) {
            let showaward: number = 0;
            let count = time / speed;
            let index = 0;
            tween(this.lab_num.node)
                .repeat(count,
                    tween(this.lab_num.node).delay(speed).call(() => {
                        showaward += (num - this.curNum) / count;
                        showaward = Math.floor(showaward ) ;
                        index++;
                        if (showaward >= num) {
                            showaward = num
                        }
                        if (index >= count) {
                            showaward = num
                        }
                        FTAudioMgr.Instance.playSound("rollpanel/RollNumber")
                        let gold = showMoney(showaward);
                        this.lab_num.string = gold;
                    })
                )
                .start()

        }
    }

    setNum(nums: number = null) {
        Tween.stopAllByTarget(this.lab_num.node);
        let num = nums;
        if (!nums) {
            num = FTGlobal.USER.gold
            if (FTGlobal.MODE == "fun") {
                num = FTGlobal.USER.experienceGold
            };
        }
        if (this.curNum != num) {
            let ani: Animation = xNodeFT.findComponent("goldAni", this.node.parent, Animation);
            if (isValid(ani)) {
                xNodeFT.show("", ani.node)
                ani.play();
                this.scheduleOnce(() => {
                    xNodeFT.hide("", ani.node)
                }, 0.64)
            }
        }
        this.curNum = num;
        this.lab_num.string = showMoney(num)
    }
}