import { _decorator, Component, ParticleSystem2D, sp, Sprite } from 'cc';
import { xNodeFD } from '../../../xtools/xNodeFD';
import { FDConstant } from '../../FDConstant/FDConstant';
import FDLoadManager from '../../load/FDLoadManager';
import FDCenterRollCtrl from './FDCenterRollCtrl';
const { ccclass, property } = _decorator;

@ccclass('FDCellItem')
export class FDCellItem extends Component {
    slotsCtrl: FDCenterRollCtrl;

    type: number = -1;
    data: number = -1;
    // coin: number = -1;
    // showNode: Node;
    _cfg: any = null;
    bTopNode: boolean = false;

    _index = 0; // 在整个slots中的位置，0开始
    set index(index) {
        this._index = index;
    }
    get index() {
        return this._index;
    }


    initTypeView(type: number, slotsCtrl?: FDCenterRollCtrl) {
        this.slotsCtrl = slotsCtrl;
        this._cfg = FDConstant.PRAFAB_LIST;

        // this.node.children.forEach(node => {
        //     node.active = false;
        // })
        this.setTypeView(type, false);
    }

    setTypeView(type: number, bBlur = false) {
        this.type = type;

        let showSpr = (bBlur && FDConstant.PRAFAB_LIST[type].blur_spr) ? FDConstant.PRAFAB_LIST[type].blur_spr : FDConstant.PRAFAB_LIST[type].nor_spr;
        let path = "res/load/images/symbols/" + showSpr + "/spriteFrame";
        let sprite = FDLoadManager.ins.getSpriteFrame(path)
        let hideNode = xNodeFD.find(!bBlur ? "icon_blur" : "icon", this.node);
        hideNode && (hideNode.active = false);
        let sprNode = xNodeFD.find(bBlur ? "icon_blur" : "icon", this.node);
        if (sprNode) {
            sprNode.active = true;
            sprNode.getComponent(Sprite).spriteFrame = sprite;
        }
        if (!sprite)
            console.log(type, path)
    }

    // resumeNormal() {
    //     if (this.showNode) {
    //         this.showNode.active = true;
    //     }
    //     // xNodeFD.show(FDConstant.PRAFAB_LIST[this.type].node, this.node);
    //     // xNodeFD.hide(this._cfg[this.type].win_node, this.node);

    //     // this.setColor(false);
    // }


    // onClickCell() {
    //     console.log("  click cell item ")

    //     if (this.slotsCtrl) {
    //         // this.slotsCtrl.show
    //     }


    // }

    /**
     * 中线动画
     */
    playWinAni() {

        let win_node = this.node.getChildByName(this._cfg[this.type].win_node);
        win_node.active = true;
        win_node.getComponent(sp.Skeleton).setAnimation(0, this._cfg[this.type].win_anim, false);
        if (this._cfg[this.type].winidle_anim) {
            win_node.getComponent(sp.Skeleton).addAnimation(0, this._cfg[this.type].winidle_anim, true);
        }

        let shadow_node = this.node.getChildByName(this._cfg[this.type].shadow_winnode);
        if (shadow_node) {
            shadow_node.active = true;
            shadow_node.getComponent(sp.Skeleton).setAnimation(0, this._cfg[this.type].shadow_winanim, true);
        }
    }

    // /**
    //  * idle动画
    //  */
    // playIdleAnim() {
    //     if (this._cfg[this.type].idle_anim) {
    //         this.node.children.forEach(node => { node.active = false; })
    //         xNodeFD.show(this._cfg[this.type].win_node, this.node);
    //         let sps: sp.Skeleton = xNodeFD.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
    //         sps.setAnimation(0, this._cfg[this.type].idle_anim, true);
    //         if (this.type == FDConstant.SCATTER_TYPE) {
    //             let par = xNodeFD.find("Particle2D", this.node);
    //             par.active = true;
    //             par.getComponent(ParticleSystem2D).resetSystem();
    //         }
    //     }
    // }

    // /**
    //  * 触发动画
    //  */
    // playTriAnim() {
    //     if (this._cfg[this.type].tri_anim) {
    //         this.node.children.forEach(node => { node.active = false; })
    //         // this.showNode.active = false;
    //         xNodeFD.show(this._cfg[this.type].win_node, this.node);
    //         let sps: sp.Skeleton = xNodeFD.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
    //         sps.setAnimation(0, this._cfg[this.type].tri_anim, true);
    //     }
    // }

    // playStopAnim() {
    //     if (this._cfg[this.type].stop_anim) {
    //         xNodeFD.show(this._cfg[this.type].win_node, this.node);
    //         let sps: sp.Skeleton = xNodeFD.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
    //         sps.setAnimation(0, this._cfg[this.type].stop_anim, false);
    //         if (this._cfg[this.type].idle_anim) {
    //             sps.addAnimation(0, this._cfg[this.type].idle_anim, true);
    //         }
    //         if (this.type == FDConstant.SCATTER_TYPE) {
    //             let par = xNodeFD.find("Particle2D", this.node);
    //             par.active = true;
    //             par.getComponent(ParticleSystem2D).resetSystem();
    //         }
    //     }
    // }

    playSpawnAnim() {
        if (this._cfg[this.type].spawn_anim) {
            xNodeFD.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFD.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].spawn_anim, false);
            if (this._cfg[this.type].idle_anim) {
                sps.addAnimation(0, this._cfg[this.type].idle_anim, true);
            }
        }
    }


}

