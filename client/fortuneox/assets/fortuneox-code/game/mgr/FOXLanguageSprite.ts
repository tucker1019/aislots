import { _decorator, Component, Node, SpriteFrame, Sprite } from 'cc';
import { xNodeFOX } from '../../xtools/xNodeFOX';
const { ccclass, property } = _decorator;

@ccclass('FOXLanguageSprite')
export class FOXLanguageSprite extends Component {

    @property(SpriteFrame)
    enSp: SpriteFrame = null
    @property(SpriteFrame)
    brSp: SpriteFrame = null


    start() {
        xNodeFOX.setSpriteFrame("", this.node, this.enSp);
    }


}

