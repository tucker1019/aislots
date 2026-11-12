import { _decorator, Node, Component, Animation, Tween, Sprite, tween, Vec3, Color, find, UITransform, sp } from "cc";
import { xNodeWBS } from "../../xtools/xNodeWBS";
import { WBSConstant } from "../constant/WBSConstant";
import { wbsgame } from "../wbsgame";

const { ccclass, property } = _decorator;

@ccclass('WBSCellItem')
export class WBSCellItem extends Component {

    type: number;

    _index = 0; // 在整个slots中的位置，0开始
    set index(index) {
        this._index = index;
    }
    get index() {
        return this._index;
    }


    protected onLoad(): void {
    }


    initTypeView(type: number) {
        this.setTypeView(type);
    }

    initNode() {
        xNodeWBS.show("spr_icon", this.node);
        xNodeWBS.hide("cellSp", this.node);
    }

    setTypeView(type: number, bBlur = false) {
        let anim = this.node.getComponent(Animation);
        if (anim) anim.stop();
        this.node.children.forEach(node => { node.active = false; })
        this.type = type;
        let showType = type % 1000;

        let wild_frame = xNodeWBS.find("wild_frame", this.node);
        let spr_icon = xNodeWBS.find("spr_icon", this.node);
        wild_frame.active = type >= 1000;
        spr_icon.active = true;
        if (bBlur) {
            wild_frame.scale = new Vec3(2, 2, 1);
            spr_icon.scale = new Vec3(2, 2, 1);
            wild_frame.getComponent(Sprite).spriteFrame = wbsgame.gamelayer.CellSprBlur[0];
            spr_icon.getComponent(Sprite).spriteFrame = wbsgame.gamelayer.CellSprBlur[showType];
        } else {
            wild_frame.scale = new Vec3(1, 1, 1);
            spr_icon.scale = new Vec3(1, 1, 1);
            wild_frame.getComponent(Sprite).spriteFrame = wbsgame.gamelayer.CellSprNor[0];
            spr_icon.getComponent(Sprite).spriteFrame = wbsgame.gamelayer.CellSprNor[showType];
        }
    }


    playSpawnAnim(type: number) {
        xNodeWBS.hide("spr_icon", this.node);
        xNodeWBS.show("cellSp", this.node);
        let cellSp: sp.Skeleton = xNodeWBS.findComponent("cellSp", this.node, sp.Skeleton);
        cellSp.skeletonData = wbsgame.gamelayer.CellSp[type % 1000];
        cellSp.setAnimation(0, "spawn", false);
    }

    playIdleAnim(type: number) {
        let anim = this.node.getComponent(Animation);
        if (anim && (type == WBSConstant.SCATTER_TYPE || type % 1000 == WBSConstant.WILD_TYPE)) {
            if (type == WBSConstant.SCATTER_TYPE) {
                anim.play("cellScaIdle");
            } else {
                anim.play("cellWildIdle");
            }
            xNodeWBS.hide("spr_icon", this.node);
            let cellSp: sp.Skeleton = xNodeWBS.findComponent("cellSp", this.node, sp.Skeleton);
            cellSp.skeletonData = wbsgame.gamelayer.CellSp[type % 1000];
            cellSp.node.active = true;
            cellSp.setAnimation(0, "idle", true);
        }
    }

    playScaStopAnim(type: number) {
        let anim = this.node.getComponent(Animation);
        if (anim && type == WBSConstant.SCATTER_TYPE) {
            anim.play("cellScaStop");
            anim.once(Animation.EventType.FINISHED, () => {
                anim.play("cellScaIdle");
            })
            let cellSp: sp.Skeleton = xNodeWBS.findComponent("cellSp", this.node, sp.Skeleton);
            cellSp.skeletonData = wbsgame.gamelayer.CellSp[type % 1000];
            cellSp.node.active = true;
            cellSp.setAnimation(0, "spawn", false);
            cellSp.setAnimation(0, "idle", true);
        }
    }

    playTriAni(type: number) {
        let cellSp: sp.Skeleton = xNodeWBS.findComponent("cellSp", this.node, sp.Skeleton);
        cellSp.skeletonData = wbsgame.gamelayer.CellSp[type % 1000];
        cellSp.node.active = true;
        cellSp.setAnimation(0, "spawn", false);
        cellSp.setAnimation(0, "win_idle", true);
    }

    playFastSpinAnim(type: number) {
        if (type == WBSConstant.SCATTER_TYPE) {
            let cellSp: sp.Skeleton = xNodeWBS.findComponent("cellSp", this.node, sp.Skeleton);
            cellSp.skeletonData = wbsgame.gamelayer.CellSp[type % 1000];
            cellSp.node.active = true;
            cellSp.setAnimation(0, "fastspin_start", false);
            cellSp.setAnimation(0, "fastspin_idle", true);
        }
    }



    playWinAni(type: number, func1: Function, isWild: boolean, func2: Function,) {
        let anim = this.node.getComponent(Animation);
        if (anim) {
            anim.play(isWild ? "cellWinToWild" : "cellWin");
            let cellSp: sp.Skeleton = xNodeWBS.findComponent("cellSp", this.node, sp.Skeleton);
            cellSp.skeletonData = wbsgame.gamelayer.CellSp[type % 1000];
            cellSp.node.active = true;
            cellSp.setAnimation(0, "win", true);

            if (isWild) {
                this.scheduleOnce(() => {
                    let newType = WBSConstant.WILD_TYPE;
                    cellSp.skeletonData = wbsgame.gamelayer.CellSp[newType % 1000];
                    cellSp.setAnimation(0, "spawn", false);
                    cellSp.addAnimation(0, "idle", true);
                    if (func2) func2();
                }, 1.3)
            }
            anim.once(Animation.EventType.FINISHED, () => {
                if (func1) func1();
            })
        }
    }

    update(dt: number) {
    }

}

