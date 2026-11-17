import { _decorator, Color, Component, instantiate, Label, Node, sp, Sprite, tween, Vec3 } from 'cc';
import { xNodeFL } from '../../../xtools/xNodeFL';
import { FLConstant } from '../../FLConstant/FLConstant';
import FLLoadManager from '../../load/FLLoadManager';
import { FLGameManager } from '../../mgr/FLGameManager';
import FLCenterRollCtrl from './FLCenterRollCtrl';
const { ccclass, property } = _decorator;

@ccclass('FLCellItem')
export class FLCellItem extends Component {

    slotsCtrl: FLCenterRollCtrl;

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


    initTypeView(type: number, slotsCtrl?: FLCenterRollCtrl) {
        this.slotsCtrl = slotsCtrl;
        this._cfg = FLConstant.PRAFAB_LIST;

        // this.node.children.forEach(node => {
        //     node.active = false;
        // })
        this.setTypeView(type);
    }

    setTypeView(type: number, bBlur = false) {
        this.type = type;

        const config = this._cfg?.[type];
        if (!config) {
            console.error(`[AG9] missing symbol config for type ${type}`);
            this.showNode = null;
            this.node.active = false;
            return;
        }

        if (this.showNode) {
            this.showNode.active = false;
        }
        if(bBlur){
            this.showNode = xNodeFL.find(config.blur_node || config.node, this.node);
        } else {
            this.showNode = xNodeFL.find(config.node, this.node);
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
        // xNodeFL.show(FLConstant.PRAFAB_LIST[this.type].node, this.node);
        // xNodeFL.hide(this._cfg[this.type].win_node, this.node);

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
    //     // xNodeFL.show(FLConstant.PRAFAB_LIST[this.type].node, this.node);
    //     // xNodeFL.hide(this._cfg[this.type].win_node, this.node);

    //     this.setColor(isRoll);
    // }

    // showGray(bGray) {
    //     if (this.showNode && this.type != FLConstant.WHEEL_TYPE && FLConstant.BONUS_TYPE.indexOf(this.type) == -1) {
    //         let spr: Sprite = xNodeFL.findComponent("", this.showNode, Sprite);
    //         spr.grayscale = bGray;
    //     }
    // }

    // setColor(isRoll: boolean) {
    //     if (this.showNode) {
    //         let sprComp: Sprite = xNodeFL.findComponent("", this.showNode, Sprite)
    //         sprComp.color = isRoll ? new Color(160, 160, 160, 255) : new Color(255, 255, 255, 255);
    //         if (this.type == 12 || this.type > 1200) {
    //             // let coinComp: Label = xNodeFL.findComponent("coin", this.node, Label)
    //             // coinComp.color = isRoll ?  new Color(160, 160, 160, 255) : new Color(255, 255, 255, 255);

    //             let jpNode = this.node.getChildByName("jp");
    //             for (let i = 0; i < jpNode.children.length; i++) {
    //                 let jpComp: Sprite = xNodeFL.findComponent("", jpNode.children[i], Sprite)
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
            // xNodeFL.hide(FLConstant.PRAFAB_LIST[this.type].node, this.node);
            xNodeFL.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFL.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].win_anim, bloop);
        }
    }

    /**
     * idle动画
     */
    playIdleAnim() {
        if (this._cfg[this.type].idle_anim) {
            xNodeFL.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFL.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].idle_anim, true);
        }
    }

    /**
     * 触发动画
     */
    playTriAnim() {
        if (this._cfg[this.type].tri_anim) {
            // this.showNode.active = false;
            xNodeFL.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFL.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
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
            // xNodeFL.hide(this._cfg[this.type].node, this.node);
            xNodeFL.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFL.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].settle_anim, false);
            // if(FLConstant.PRAFAB_LIST[this.type].idle_anim){
            //     sps.addAnimation(0, FLConstant.PRAFAB_LIST[this.type].idle_anim, true);
            // }
        }
    }

}

