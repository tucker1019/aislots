import { _decorator, Component, Node, Label, Tween, tween, Vec3, Animation, isValid } from 'cc';
import { xNodeFOX } from '../../../xtools/xNodeFOX';
import { formatStr, showMoney } from '../../common/FOXUtils';
import { FOXAudioMgr } from './FOXAudioMgr';
import { FOXGlobal } from './FOXGlobal';
const { ccclass, property } = _decorator;

@ccclass('FOXNumRollCtrl')
export class FOXNumRollCtrl extends Component {


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
                        FOXAudioMgr.Instance.playSound("rollpanel/RollNumber")
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
            num = FOXGlobal.USER.gold
            if (FOXGlobal.MODE == "fun") {
                num = FOXGlobal.USER.experienceGold
            };
        }
        if (this.curNum != num) {
            let ani: Animation = xNodeFOX.findComponent("goldAni", this.node.parent, Animation);
            if (isValid(ani)) {
                xNodeFOX.show("", ani.node)
                ani.play();
                this.scheduleOnce(() => {
                    xNodeFOX.hide("", ani.node)
                }, 0.64)
            }
        }
        this.curNum = num;
        this.lab_num.string = showMoney(num)
    }
}