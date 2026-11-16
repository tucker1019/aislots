import { _decorator, Component, Node, sp, Tween } from 'cc';

import { ANI_TYPE } from './FTAniLayerCtrl';
import { FTAwardNumRollCtrl } from './FTAwardNumRollCtrl';

const { ccclass, property } = _decorator;

@ccclass('FTAwardAniCtrl')
export class FTAwardAniCtrl extends Component {

    ani_coin: sp.Skeleton
    ani_award: sp.Skeleton
    awardNumCtrl: FTAwardNumRollCtrl

    award = 0

    showTween = null
    callback = null
    delayCbTween = null

    onLoad() {
        // super.onLoad()

        this.ani_coin = this.node.getChildByName('ani_coin').getComponent(sp.Skeleton)
        this.ani_award = this.node.getChildByName('ani_award').getComponent(sp.Skeleton)
        this.awardNumCtrl = this.node.getChildByName('node_award_num').getComponent(FTAwardNumRollCtrl)
        this.ani_coin.node.active = false

        this.node.on(Node.EventType.TOUCH_END, this.onTouch, this)

    }

    // 只可以点一次
    onTouch() {
        this.showTween.stop()
        this.awardNumCtrl.setTargetNum(this.award)
        this.node.off(Node.EventType.TOUCH_END, this.onTouch, this)

        this.delayCbTween = new Tween(this.node).delay(1.0).call(() => {
            this.callback && this.callback()
        }).removeSelf()
        this.delayCbTween.start()
    }

    getShowTime(type: ANI_TYPE) {

        let time = 0

        switch (type) {
            case ANI_TYPE.YOU_WIN:
                time = 3
                break

            case ANI_TYPE.BIG_WIN:
                time = 3
                break

            case ANI_TYPE.SUPER_WIN:
                time = 3
                break

            case ANI_TYPE.MEGA_WIN:
                time = 3
                break
        }

        return time

    }


    show(aniType: ANI_TYPE, award, bitNum, countType, callEnd, ) {

        this.ani_award.setAnimation(0, "a1", false)

        let showTime = this.getShowTime(countType)

        award = award / 100
        let step = award / (showTime / 0.05)

        this.callback = callEnd
        this.award = award

        this.showTween = new Tween(this.node).delay(0.5).call(() => {
            this.ani_award.setAnimation(1, "a2", true)
            this.ani_coin.node.active = true

            switch (aniType) {
                case ANI_TYPE.YOU_WIN:
                    this.ani_coin.setAnimation(0, "a1", true)
                    break

                case ANI_TYPE.BIG_WIN:
                    this.ani_coin.setAnimation(0, "a2", true)
                    break

                case ANI_TYPE.SUPER_WIN:
                    this.ani_coin.setAnimation(0, "a2", true)
                    break

                case ANI_TYPE.MEGA_WIN:
                    this.ani_coin.setAnimation(0, "a3", true)
                    break

                // case ANI_TYPE.JACKPOT:
                //     this.ani_coin.setAnimation(0, "a3", true)
                //     break
            }

            this.awardNumCtrl.toNum(award, step)

        }).to(showTime, {}, {

        }).call(() => {
            this.awardNumCtrl.setTargetNum(this.award)
            this.node.off(Node.EventType.TOUCH_END, this.onTouch, this)
        }).delay(1.0).call(() => {
            callEnd && callEnd()
        }).removeSelf()
        this.showTween.start()
    }

}

