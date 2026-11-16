import { _decorator, Component, Node, SpriteFrame, Sprite } from 'cc';
import { xNodeFT } from '../../xtools/xNodeFT';
const { ccclass, property } = _decorator;

@ccclass('FTLanguageSprite')
export class FTLanguageSprite extends Component {

    @property(SpriteFrame)
    enSp: SpriteFrame = null
    @property(SpriteFrame)
    brSp: SpriteFrame = null


    start() {
        let sp = this.enSp;
        xNodeFT.setSpriteFrame("", this.node, sp)
    }


}

