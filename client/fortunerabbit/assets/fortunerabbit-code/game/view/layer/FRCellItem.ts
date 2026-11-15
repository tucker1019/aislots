import { _decorator, BitmapFont, Color, Component, Font, instantiate, Label, Node, sp, Sprite, tween, UIOpacity, Vec3 } from 'cc';
import { xNodeFR } from '../../../xtools/xNodeFR';
import { FRConstant } from '../../FRConstant/FRConstant';
import FRLoadManager from '../../load/FRLoadManager';
import { FRGameManager } from '../../mgr/FRGameManager';
import FRCenterRollCtrl from './FRCenterRollCtrl';
import { showMoney } from '../../common/FRUtils';
import { FRAudioMgr } from './FRAudioMgr';
const { ccclass, property } = _decorator;

@ccclass('FRCellItem')
export class FRCellItem extends Component {

    @property([BitmapFont])
    fntList: BitmapFont[];

    slotsCtrl: FRCenterRollCtrl;

    type: number = -1;
    bonusMult: number = -1;
    // coin: number = -1;
    showNode: Node;
    _cfg: any = null;

    _index = 0; // 在整个slots中的位置，0开始
    set index(index) {
        this._index = index;
    }
    get index() {
        return this._index;
    }


    initTypeView(type: number, slotsCtrl?: FRCenterRollCtrl) {
        this.slotsCtrl = slotsCtrl;
        this._cfg = FRConstant.PRAFAB_LIST;

        // this.node.children.forEach(node => {
        //     node.active = false;
        // })
        this.setTypeView(type);
    }

    setTypeView(type: number, bBlur = false) {
        this.type = type;

        if (this.showNode) {
            this.showNode.active = false;
        }
        if (bBlur && this._cfg[this.type].blur_node) {
            this.showNode = xNodeFR.find(this._cfg[this.type].blur_node, this.node);
        } else {
            this.showNode = xNodeFR.find(this._cfg[this.type].node, this.node);
        }

        // console.log(this.type,  this.showNode, this.node)
        if (this.showNode) {
            this.showNode.active = true;
        }
        // this.node.active = true;

        this.showBonusNum(this._cfg[this.type].BONUS_MULT);
    }

    showBonusNum(mult) {

        if (mult) {
            let lab: Label = xNodeFR.findComponent("c8/s_cash_note/num", this.node, Label);

            let coin = mult * FRGameManager.getTotalBitNum();
            lab.string = showMoney(coin);

            let idx;
            if (mult < 20) {
                idx = 0;
            } else if (mult < 500) {
                idx = 1;
            } else {
                idx = 2;
            }
            lab.font = this.fntList[idx];

            lab.node.getComponent(UIOpacity).opacity = 255;
        }
    }

    getBonusNumNode() {
        return xNodeFR.find("c8/s_cash_note/num", this.node)
    }

    resumeNormal() {
        if (this.showNode) {
            this.showNode.active = true;
        }
        // xNodeFR.show(FRConstant.PRAFAB_LIST[this.type].node, this.node);
        // xNodeFR.hide(this._cfg[this.type].win_node, this.node);

        // this.setColor(false);
    }







    // setRollView(isRoll: boolean) {
    //     // this.node.children.forEach(node=>{
    //     //     node.active = false;  
    //     // })
    //     if (this.showNode) {
    //         this.showNode.active = true;
    //     }
    //     // xNodeFR.show(FRConstant.PRAFAB_LIST[this.type].node, this.node);
    //     // xNodeFR.hide(this._cfg[this.type].win_node, this.node);

    //     this.setColor(isRoll);
    // }

    // showGray(bGray) {
    //     if (this.showNode && this.type != FRConstant.WHEEL_TYPE && FRConstant.BONUS_TYPE.indexOf(this.type) == -1) {
    //         let spr: Sprite = xNodeFR.findComponent("", this.showNode, Sprite);
    //         spr.grayscale = bGray;
    //     }
    // }

    // setColor(isRoll: boolean) {
    //     if (this.showNode) {
    //         let sprComp: Sprite = xNodeFR.findComponent("", this.showNode, Sprite)
    //         sprComp.color = isRoll ? new Color(160, 160, 160, 255) : new Color(255, 255, 255, 255);
    //         if (this.type == 12 || this.type > 1200) {
    //             // let coinComp: Label = xNodeFR.findComponent("coin", this.node, Label)
    //             // coinComp.color = isRoll ?  new Color(160, 160, 160, 255) : new Color(255, 255, 255, 255);

    //             let jpNode = this.node.getChildByName("jp");
    //             for (let i = 0; i < jpNode.children.length; i++) {
    //                 let jpComp: Sprite = xNodeFR.findComponent("", jpNode.children[i], Sprite)
    //                 jpComp.color = isRoll ? new Color(160, 160, 160, 255) : new Color(255, 255, 255, 255);
    //             }

    //         }
    //     }

    // }

    /**
     * 中线动画
     */
    playWinAni(bloop = true) {
        if (this._cfg[this.type].win_anim) {
            // this.showNode.active = false;
            // xNodeFR.hide(FRConstant.PRAFAB_LIST[this.type].node, this.node);
            xNodeFR.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFR.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].win_anim, bloop);
        }
        else if (this._cfg[this.type].BONUS_MULT) {
            xNodeFR.show("c8", this.node);
            let animNode = xNodeFR.find("c8/s_cash_note", this.node);
            tween(animNode)
                .to(0.3, { scale: new Vec3(1.1, 1.1, 1) })
                .to(0.3, { scale: new Vec3(1, 1, 1) })
                .start()
        }
    }

    /**
     * idle动画
     */
    playIdleAnim() {
        if (this._cfg[this.type].idle_anim) {
            xNodeFR.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFR.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].idle_anim, true);
        }
    }

    // /**
    //  * 触发动画
    //  */
    // playTriAnim() {
    //     if (this._cfg[this.type].tri_anim) {
    //         // this.showNode.active = false;
    //         xNodeFR.show(this._cfg[this.type].win_node, this.node);
    //         let sps: sp.Skeleton = xNodeFR.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
    //         sps.setAnimation(0, this._cfg[this.type].tri_anim, true);
    //     }
    // }

    playStopAnim() {
        if (this._cfg[this.type].stop_anim) {
            // this.showNode.active = false;
            xNodeFR.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFR.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].stop_anim, false);
            if (this._cfg[this.type].idle_anim) {
                if(this.type == FRConstant.WILD_TYPE){
                    FRAudioMgr.Instance.playSound("games/Wild1");
                }
                sps.addAnimation(0, this._cfg[this.type].idle_anim, true);
            }
        }
    }

    // /**
    //  * 结算动画
    //  */
    // playSettleAnim() {
    //     if (this._cfg[this.type].settle_anim) {
    //         // this.showNode.active = false;
    //         // xNodeFR.hide(this._cfg[this.type].node, this.node);
    //         xNodeFR.show(this._cfg[this.type].win_node, this.node);
    //         let sps: sp.Skeleton = xNodeFR.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
    //         sps.setAnimation(0, this._cfg[this.type].settle_anim, false);
    //         // if(FRConstant.PRAFAB_LIST[this.type].idle_anim){
    //         //     sps.addAnimation(0, FRConstant.PRAFAB_LIST[this.type].idle_anim, true);
    //         // }
    //     }
    // }

}

