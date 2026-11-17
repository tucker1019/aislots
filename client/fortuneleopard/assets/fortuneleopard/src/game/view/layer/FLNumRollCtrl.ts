import { _decorator, Component, Node, Label, Tween, tween, Vec3, Animation, isValid } from 'cc';
import { xNodeFL } from '../../../xtools/xNodeFL';
import { formatStr, showMoney } from '../../common/FLUtils';
import { FLAudioMgr } from './FLAudioMgr';
import { FLGlobal } from './FLGlobal';
const { ccclass, property } = _decorator;

@ccclass('FLNumRollCtrl')
export class FLNumRollCtrl extends Component {


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
                        FLAudioMgr.Instance.playSound("rollpanel/RollNumber")
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
            num = FLGlobal.USER.gold
            if (FLGlobal.MODE == "fun") {
                num = FLGlobal.USER.experienceGold
            };
        }
        if (this.curNum != num) {
            let ani: Animation = xNodeFL.findComponent("goldAni", this.node.parent, Animation);
            if (isValid(ani)) {
                xNodeFL.show("", ani.node)
                ani.play();
                this.scheduleOnce(() => {
                    xNodeFL.hide("", ani.node)
                }, 0.64)
            }
        }
        this.curNum = num;
        this.lab_num.string = showMoney(num)
    }
}