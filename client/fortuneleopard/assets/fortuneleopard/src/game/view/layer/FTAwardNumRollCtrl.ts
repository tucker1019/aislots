import { _decorator, Component, Node, Label, Tween } from 'cc';
const { ccclass, property } = _decorator;

let RUN_COUNT = 10000

@ccclass('FTAwardNumRollCtrl')
export class FTAwardNumRollCtrl extends Component {


    lab_num1: Label = null
    lab_num2: Label = null

    startNum = 0
    targetNum = 0
    curNum = 0

    passTime = 0

    rollTween = null

    step = 1

    onLoad() {
        this.lab_num1 = this.node.getChildByName('lab_num1').getComponent(Label)
        this.lab_num2 = this.node.getChildByName('lab_num2').getComponent(Label)
        this.lab_num1.string = ""
        this.lab_num2.string = ""

        let oneTween = new Tween(this.node).delay(0.05).call(() => {
            this.oneStep()
        })

        this.rollTween = new Tween(this.node).repeat(RUN_COUNT, oneTween)
    }

    start() {
    }

    toNum(num, step = 0.01) {
        this.targetNum = num


        // this.step = 0.01

        this.step = step

        this.rollTween.start()
    }

    oneStep() {

        let nextNum = this.curNum + this.step

        if (nextNum > this.targetNum) {
            nextNum = this.targetNum
        }

        this.setNum(nextNum)
    }

    setNum(num) {
        this.curNum = num

        let num1 = Math.floor(num)
        // 加上000000001，避免误算
        let num2 = Math.floor((num - num1 + 0.000000001) * 100) / 100

        this.lab_num1.string = String(num1)

        if (num2 == 0) {
            this.lab_num2.string = ".00"
        } else {
            let num2Str = String(num2).split(".")[1]

            if (!num2Str) {
                return
            }
            if (num2Str && num2Str.length == 2) {
                this.lab_num2.string = "." + num2Str
            } else {
                this.lab_num2.string = "." + num2Str + "0"
            }
        }
    }

    setTargetNum(targetNum) {
        this.rollTween.stop()
        this.setNum(targetNum)
    }

}

