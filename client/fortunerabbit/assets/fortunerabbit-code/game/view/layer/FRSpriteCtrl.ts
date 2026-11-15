import { _decorator, CCInteger, Component, Node, Sprite, SpriteFrame } from 'cc';
import { FRPlatformMgr } from '../../3rd/FRPlatformMgr';
import { Language } from './FRConfigCtrl';
const { ccclass, property, requireComponent } = _decorator;

@ccclass('FRSpriteCtrl')
@requireComponent(Sprite)
export class FRSpriteCtrl extends Component {

    // @property({ type: [SpriteFrame] })
    // spList: SpriteFrame[] = []

    @property({ group: { name: "one" }, type: [SpriteFrame] })
    sprList: SpriteFrame[] = [];

    // @property()
    // set sprList2(val) {
    //     this.sprList = this.spList.slice(0);
    // }

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

        // this.sprList2=2;;
    }

    setSpriteIndex(idx) {
        // this.node.getComponent(Sprite).spriteFrame = this.spList[idx];
        if (this.sprList.length > 0) {
            idx = Math.min(idx, this.sprList.length);
            this.node.getComponent(Sprite).spriteFrame = this.sprList[idx];

        } else if (this.EnSprList.length > 0 && FRPlatformMgr.getLanguage() == Language.EN) {
            idx = Math.min(idx, this.EnSprList.length);
            this.node.getComponent(Sprite).spriteFrame = this.EnSprList[idx];

        } else if (this.PtSprList.length > 0 && FRPlatformMgr.getLanguage() == Language.PT) {
            idx = Math.min(idx, this.PtSprList.length);
            this.node.getComponent(Sprite).spriteFrame = this.PtSprList[idx];

        }
    }


}

