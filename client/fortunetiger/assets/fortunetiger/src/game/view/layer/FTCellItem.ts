import { _decorator, Color, Component, instantiate, Label, Node, sp, Sprite, tween, Vec3 } from 'cc';
import { xNodeFT } from '../../../xtools/xNodeFT';
import { FTConstant } from '../../FTConstant/FTConstant';
import FTLoadManager from '../../load/FTLoadManager';
import { FTGameManager } from '../../mgr/FTGameManager';
import FTCenterRollCtrl from './FTCenterRollCtrl';
const { ccclass, property } = _decorator;

@ccclass('FTCellItem')
export class FTCellItem extends Component {

    slotsCtrl: FTCenterRollCtrl;

    type: number = -1;
    data: number = -1;
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


    initTypeView(type: number, slotsCtrl?: FTCenterRollCtrl) {
        this.slotsCtrl = slotsCtrl;
        this._cfg = FTConstant.PRAFAB_LIST;

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
        if(bBlur){
            this.showNode = xNodeFT.find(this._cfg[this.type].blur_node, this.node);
        } else {
            this.showNode = xNodeFT.find(this._cfg[this.type].node, this.node);
        }   
        
        // console.log(this.type,  this.showNode, this.node)
        if(this.showNode){
            this.showNode.active = true;
        }        
        this.node.active = true;

    }

    resumeNormal() {
        if (this.showNode) {
            this.showNode.active = true;
        }
        // xNodeFT.show(FTConstant.PRAFAB_LIST[this.type].node, this.node);
        // xNodeFT.hide(this._cfg[this.type].win_node, this.node);

        // this.setColor(false);
    }


    onClickCell(){
        console.log("  click cell item ")

        if(this.slotsCtrl){
            // this.slotsCtrl.show
        }


    }






    // setRollView(isRoll: boolean) {
    //     // this.node.children.forEach(node=>{
    //     //     node.active = false;  
    //     // })
    //     if (this.showNode) {
    //         this.showNode.active = true;
    //     }
    //     // xNodeFT.show(FTConstant.PRAFAB_LIST[this.type].node, this.node);
    //     // xNodeFT.hide(this._cfg[this.type].win_node, this.node);

    //     this.setColor(isRoll);
    // }

    // showGray(bGray) {
    //     if (this.showNode && this.type != FTConstant.WHEEL_TYPE && FTConstant.BONUS_TYPE.indexOf(this.type) == -1) {
    //         let spr: Sprite = xNodeFT.findComponent("", this.showNode, Sprite);
    //         spr.grayscale = bGray;
    //     }
    // }

    // setColor(isRoll: boolean) {
    //     if (this.showNode) {
    //         let sprComp: Sprite = xNodeFT.findComponent("", this.showNode, Sprite)
    //         sprComp.color = isRoll ? new Color(160, 160, 160, 255) : new Color(255, 255, 255, 255);
    //         if (this.type == 12 || this.type > 1200) {
    //             // let coinComp: Label = xNodeFT.findComponent("coin", this.node, Label)
    //             // coinComp.color = isRoll ?  new Color(160, 160, 160, 255) : new Color(255, 255, 255, 255);

    //             let jpNode = this.node.getChildByName("jp");
    //             for (let i = 0; i < jpNode.children.length; i++) {
    //                 let jpComp: Sprite = xNodeFT.findComponent("", jpNode.children[i], Sprite)
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
            // xNodeFT.hide(FTConstant.PRAFAB_LIST[this.type].node, this.node);
            xNodeFT.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFT.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].win_anim, bloop);
        }
    }

    /**
     * idle动画
     */
    playIdleAnim() {
        if (this._cfg[this.type].idle_anim) {
            xNodeFT.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFT.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].idle_anim, true);
        }
    }

    /**
     * 触发动画
     */
    playTriAnim() {
        if (this._cfg[this.type].tri_anim) {
            // this.showNode.active = false;
            xNodeFT.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFT.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].tri_anim, true);
        }
    }

    playStopAnim() {

    }

    /**
     * 结算动画
     */
    playSettleAnim() {
        if (this._cfg[this.type].settle_anim) {
            // this.showNode.active = false;
            // xNodeFT.hide(this._cfg[this.type].node, this.node);
            xNodeFT.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFT.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].settle_anim, false);
            // if(FTConstant.PRAFAB_LIST[this.type].idle_anim){
            //     sps.addAnimation(0, FTConstant.PRAFAB_LIST[this.type].idle_anim, true);
            // }
        }
    }

}

