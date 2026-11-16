import { _decorator, Component,  instantiate, sp, Tween, Label, Vec3 } from 'cc';
import { ftframe } from '../../../ftframe/ftframe';
import FTLoadManager from '../../load/FTLoadManager';


import { FTAwardAniCtrl } from './FTAwardAniCtrl';
import { FTBonusAniCtr } from './FTBonusAniCtr';
import { FTGameEvent } from './FTGameEvent';
import { FTGlobal } from './FTGlobal';
import { FTAudioMgr } from './FTAudioMgr';
const { ccclass } = _decorator;


// let targetNum = SHOW_NUM_TIME / 0.05 * 0.01 // 5秒后能达到的数字
// targetNum = 1

export enum ANI_TYPE {
    JACKPOT = "ani_jackpot",
    YOU_WIN = "ani_you_win",
    BIG_WIN = "ani_big_win",
    SUPER_WIN = "ani_super_win",
    MEGA_WIN = "ani_mega_win",
    FREE = "ani_free",
}

// 显示动画控件
@ccclass('FTAniLayerCtrl')
export class FTAniLayerCtrl extends Component {

    showTween = null

    // 其他无显示：0~5倍，
    // youwin(5~10倍) 
    // bingwin（10~30倍）
    // superwin（30倍~100倍）
    // megawin（100倍以上）
    static getWinType(award, bitNum): ANI_TYPE {

        let multiCount = award / bitNum

        if (multiCount < 5) {
            return null
        }
        if (multiCount <= 10) {
            return ANI_TYPE.YOU_WIN
        }
        if (multiCount <= 30) {
            return ANI_TYPE.BIG_WIN
        }
        if (multiCount < 100) {
            return ANI_TYPE.SUPER_WIN
        }
        return ANI_TYPE.MEGA_WIN
    }

    // 显示免费游戏次数动画
    showFreeAni(count, setBtnState, callback) {
        this.clearAni()

        this.loadAni(ANI_TYPE.FREE, (aniNode) => {

            this.playAniSound(ANI_TYPE.FREE)

            let ani_show: sp.Skeleton = aniNode.getChildByName('ani_show').getComponent(sp.Skeleton)
            let ani_light: sp.Skeleton = aniNode.getChildByName('ani_light').getComponent(sp.Skeleton)
            let lab_num: Label = aniNode.getChildByName('lab_num').getComponent(Label)

            ani_light.node.active = false
            lab_num.string = ""
            ani_show.setAnimation(0, "a1", false)

            let tween = new Tween(aniNode).delay(0.2).call(() => {
                lab_num.string = count
                ani_light.node.active = true
                ani_light.setAnimation(0, "a3", true)
            }).delay(1.5).call(() => {
                callback && callback()
            })
            tween.start()
            setBtnState && setBtnState()
        })

    }

    showWinAni(award, bitNum, callEnd) {

        award = award

        this.clearAni()

        let aniType = FTAniLayerCtrl.getWinType(award, bitNum)

        if (aniType == null) {

            this.showTween = new Tween(this.node).delay(0.2).call(() => {
                callEnd && callEnd()
            })
            this.showTween.start()
            return
        }

        this.loadAni(aniType, (aniNode) => {

            this.playAniSound(aniType)
            let awardCtrl: FTAwardAniCtrl = aniNode.getComponent(FTAwardAniCtrl)
            awardCtrl.show(aniType, award, bitNum, aniType, callEnd)

        })

    }

    // 播放动画音效
    playAniSound(aniType: ANI_TYPE) {
        // let sound = ""
        // switch (aniType) {
        //     case ANI_TYPE.YOU_WIN:
        //         sound = SOUND_LIST.YOU_WIN
        //         break

        //     case ANI_TYPE.BIG_WIN:
        //         sound = SOUND_LIST.BIG_WIN
        //         break

        //     case ANI_TYPE.SUPER_WIN:
        //         sound = SOUND_LIST.SUPER_WIN
        //         break

        //     case ANI_TYPE.MEGA_WIN:
        //         sound = SOUND_LIST.MEGA_WIN

        //     case ANI_TYPE.JACKPOT:
        //         sound = SOUND_LIST.JACKPOT
        //         break

        //     case ANI_TYPE.FREE:
        //         sound = SOUND_LIST.FREE_GAME
        //         break
        // }

        // if (sound != "") {
        //     FTAudioMgr.Instance.playSound(sound)
        // }
    }

  

    clearAni() {
        this.node.removeAllChildren()
        if (this.showTween) {
            this.showTween.stop()
        }
        this.showTween = null
    }

    loadAni(aniType: ANI_TYPE, callback) {
        let prefab = FTLoadManager.ins.getPrefab("res/load/prefab2/ani/" + aniType)
        if (prefab) {
            let aniNode = instantiate(prefab)
            this.node.addChild(aniNode)
            callback && callback(aniNode)
        }
    }

    playBonusAni(name: string, pos) {
        let prefab = FTLoadManager.ins.getPrefab("/res/load/prefab/ani/ani_bonus");
        if (prefab) {
            let node = instantiate(prefab)
            let comp = node.getComponent(FTBonusAniCtr);
            node.position = new Vec3(pos.x, pos.y, pos.z);
            this.node.addChild(node)
            comp.showAni(name);
        }
    }

}

