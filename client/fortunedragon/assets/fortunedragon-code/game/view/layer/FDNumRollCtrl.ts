import { _decorator, Component, Node, Label, Tween, tween, Vec3, Animation, isValid } from 'cc';
import { xNodeFD } from '../../../xtools/xNodeFD';
import { formatStr, showMoney } from '../../common/FDUtils';
import { FDAudioMgr } from './FDAudioMgr';
import { FDGlobal } from './FDGlobal';
const { ccclass, property } = _decorator;

@ccclass('FDNumRollCtrl')
export class FDNumRollCtrl extends Component {


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
                        FDAudioMgr.Instance.playSound("rollpanel/RollNumber")
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
            num = FDGlobal.USER.gold
            if (FDGlobal.MODE == "fun") {
                num = FDGlobal.USER.experienceGold
            };
        }
        if (this.curNum != num) {
            let ani: Animation = xNodeFD.findComponent("goldAni", this.node.parent, Animation);
            if (isValid(ani)) {
                xNodeFD.show("", ani.node)
                ani.play();
                this.scheduleOnce(() => {
                    xNodeFD.hide("", ani.node)
                }, 0.64)
            }
        }
        this.curNum = num;
        this.lab_num.string = showMoney(num)
    }
}