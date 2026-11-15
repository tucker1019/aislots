import { _decorator, Color, Component, instantiate, Label, Node, sp, Sprite, tween, Vec3 } from 'cc';
import { xNodeFOX } from '../../../xtools/xNodeFOX';
import { FOXConstant } from '../../FOXConstant/FOXConstant';
import FOXLoadManager from '../../load/FOXLoadManager';
import { FOXGameManager } from '../../mgr/FOXGameManager';
import FOXCenterRollCtrl from './FOXCenterRollCtrl';
const { ccclass, property } = _decorator;

@ccclass('FOXCellItem')
export class FOXCellItem extends Component {

    slotsCtrl: FOXCenterRollCtrl;

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


    initTypeView(type: number, slotsCtrl?: FOXCenterRollCtrl) {
        this.slotsCtrl = slotsCtrl;
        this._cfg = FOXConstant.PRAFAB_LIST;

        // this.node.children.forEach(node => {
        //     node.active = false;
        // })
        this.setTypeView(type);
    }

    setTypeView(type: number, bBlur = false) {
        if (type == 0) type = FOXGameManager.getRandomType();
        this.type = type;

        if (this.showNode) {
            this.showNode.active = false;
        }
        if (bBlur) {
            this.showNode = xNodeFOX.find(this._cfg[this.type].blur_node, this.node);
        } else {
            this.showNode = xNodeFOX.find(this._cfg[this.type].node, this.node);
        }

        // console.log(this.type,  this.showNode, this.node)
        if (this.showNode) {
            this.showNode.active = true;
        }
        this.node.active = true;

    }

    resumeNormal() {
        if (this.showNode) {
            this.showNode.active = true;
        }
        // xNodeFOX.show(FOXConstant.PRAFAB_LIST[this.type].node, this.node);
        // xNodeFOX.hide(this._cfg[this.type].win_node, this.node);

        // this.setColor(false);
    }


    onClickCell() {
        console.log("  click cell item ")

        if (this.slotsCtrl) {
            // this.slotsCtrl.show
        }


    }

    /**
     * 中线动画
     */
    playWinAni(bloop = true) {
        if (this._cfg[this.type].win_anim) {
            // this.showNode.active = false;
            // xNodeFOX.hide(FOXConstant.PRAFAB_LIST[this.type].node, this.node);
            xNodeFOX.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFOX.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].win_anim, bloop);

            if (this._cfg[this.type].win_idle_anim) {
                sps.addAnimation(0, this._cfg[this.type].win_idle_anim, true);
            }
        }
    }

    /**
     * idle动画
     */
    playIdleAnim() {
        if (this._cfg[this.type].idle_anim) {
            xNodeFOX.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFOX.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].idle_anim, true);
        }
    }

    /**
     * 触发动画
     */
    playTriAnim() {
        if (this._cfg[this.type].tri_anim) {
            // this.showNode.active = false;
            xNodeFOX.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFOX.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].tri_anim, true);
        }
    }

    playStopAnim() {
        if (this._cfg[this.type].stop_anim) {
            xNodeFOX.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFOX.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].stop_anim, false);
            if (this._cfg[this.type].idle_anim) {
                sps.addAnimation(0, this._cfg[this.type].idle_anim, true);
            }
        }
    }

    playSpawnAnim() {
        if (this._cfg[this.type].spawn_anim) {
            xNodeFOX.show(this._cfg[this.type].win_node, this.node);
            let sps: sp.Skeleton = xNodeFOX.findComponent(this._cfg[this.type].win_node, this.node, sp.Skeleton);
            sps.setAnimation(0, this._cfg[this.type].spawn_anim, false);
            if (this._cfg[this.type].idle_anim) {
                sps.addAnimation(0, this._cfg[this.type].idle_anim, true);
            }
        }
    }


}

