import { _decorator, Component, Node, SpriteFrame, Sprite } from 'cc';
import { xNodeFL } from '../../xtools/xNodeFL';
const { ccclass, property } = _decorator;

@ccclass('FLLanguageSprite')
export class FLLanguageSprite extends Component {

    @property(SpriteFrame)
    enSp: SpriteFrame = null
    @property(SpriteFrame)
    brSp: SpriteFrame = null


    start() {
        let sp = this.enSp;
        xNodeFL.setSpriteFrame("", this.node, sp)
    }


}

