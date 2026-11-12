import { _decorator, CCInteger, Component, Node, Sprite, SpriteFrame } from 'cc';
import { WBSConfig } from '../cfg/WBSConfig';
const { ccclass, property } = _decorator;

@ccclass('WBSSpriteCtrl')
export class WBSSpriteCtrl extends Component {

    @property({ group: { name: "one" }, type: [SpriteFrame] })
    sprList: SpriteFrame[] = [];

    @property({ group: { name: "more" }, type: [SpriteFrame] })
    EnSprList: SpriteFrame[] = [];
    @property({ group: { name: "more" }, type: [SpriteFrame] })
    PtSprList: SpriteFrame[] = [];

    private _sprIndex: number = 0;
    @property({ type: CCInteger, step: 1 })
    get sprIndex() {
        return this._sprIndex;
    }
    set sprIndex(sprIndex: number) {
        this._sprIndex = sprIndex;
        this._sprIndex = Math.max(this._sprIndex, 0);
        this.setSpriteIndex(this._sprIndex);

    }


    setSpriteIndex(idx) {
        // this.node.getComponent(Sprite).spriteFrame = this.spList[idx];
        if (this.sprList.length > 0) {
            idx = Math.min(idx, this.sprList.length);
            this.node.getComponent(Sprite).spriteFrame = this.sprList[idx];

        } else if (this.EnSprList.length > 0 && WBSConfig.lang == "en") {
            idx = Math.min(idx, this.EnSprList.length);
            this.node.getComponent(Sprite).spriteFrame = this.EnSprList[idx];

        } else if (this.PtSprList.length > 0 && WBSConfig.lang == "br") {
            idx = Math.min(idx, this.PtSprList.length);
            this.node.getComponent(Sprite).spriteFrame = this.PtSprList[idx];

        }
    }


}


