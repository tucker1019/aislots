import { _decorator, Component, Node, Label, Tween, tween, Vec3, Animation, isValid } from 'cc';
import { xNodeFR } from '../../../xtools/xNodeFR';
import { formatStr, showMoney } from '../../common/FRUtils';
import { FRAudioMgr } from './FRAudioMgr';
import { FRGlobal } from './FRGlobal';
const { ccclass, property } = _decorator;

@ccclass('FRNumRollCtrl')
export class FRNumRollCtrl extends Component {


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
            tween(this.lab_num.node)
                .repeat(count,
                    tween(this.lab_num.node).delay(speed).call(() => {
                        showaward += (num - this.curNum) / count;
                       
                        if (showaward >= num) {
                            showaward = num
                        }
                        FRAudioMgr.Instance.playSound("rollpanel/RollNumber")
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
            num = FRGlobal.USER.gold
            if (FRGlobal.MODE == "fun") {
                num = FRGlobal.USER.experienceGold
            };
        }
        if (this.curNum != num) {
            let ani: Animation = xNodeFR.findComponent("goldAni", this.node.parent, Animation);
            if (isValid(ani)) {
                xNodeFR.show("", ani.node)
                ani.play();
                this.scheduleOnce(() => {
                    xNodeFR.hide("", ani.node)
                }, 0.64)
            }
        }
        this.curNum = num;
        this.lab_num.string = showMoney(num)
    }
}