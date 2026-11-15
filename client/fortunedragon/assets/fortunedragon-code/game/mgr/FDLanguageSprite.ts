import { _decorator, Component, Node, SpriteFrame, Sprite } from 'cc';
import { xNodeFD } from '../../xtools/xNodeFD';
import { FDGlobal } from '../view/layer/FDGlobal';
const { ccclass, property } = _decorator;

@ccclass('FDLanguageSprite')
export class FDLanguageSprite extends Component {

    @property({ type: SpriteFrame, displayName: "英语" })
    ensp: SpriteFrame = null
    @property({ type: SpriteFrame, displayName: "西班牙语" })
    mxsp: SpriteFrame = null
    protected onLoad(): void {


        if (FDGlobal.LANG == "es" && this.mxsp) {
            this.node.getComponent(Sprite).spriteFrame = this.mxsp
        } else if (this.ensp) {
            this.node.getComponent(Sprite).spriteFrame = this.ensp
        }

    }

}

