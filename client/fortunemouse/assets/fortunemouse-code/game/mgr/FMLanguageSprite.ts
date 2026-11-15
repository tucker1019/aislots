import { _decorator, Component, Node, SpriteFrame, Sprite } from 'cc';
import { xNodeFM } from '../../xtools/xNodeFM';
import { FMGlobal } from '../view/layer/FMGlobal';
const { ccclass, property } = _decorator;

@ccclass('FMLanguageSprite')
export class FMLanguageSprite extends Component {

    @property({ type: SpriteFrame, displayName: "英语" })
    ensp: SpriteFrame = null
    @property({ type: SpriteFrame, displayName: "西班牙语" })
    mxsp: SpriteFrame = null
    protected onLoad(): void {


        if (FMGlobal.LANG == "mx" && this.mxsp) {
            this.node.getComponent(Sprite).spriteFrame = this.mxsp
        } else if (this.ensp) {
            this.node.getComponent(Sprite).spriteFrame = this.ensp
        }

    }


}

