import { _decorator, Component, Node, SpriteFrame, Sprite } from 'cc';
import { xNodeFR } from '../../xtools/xNodeFR';
import { FRPlatformMgr } from '../3rd/FRPlatformMgr';
const { ccclass, property } = _decorator;

@ccclass('FRLanguageSprite')
export class FRLanguageSprite extends Component {

    @property(SpriteFrame)
    enSp: SpriteFrame = null
    @property(SpriteFrame)
    brSp: SpriteFrame = null


    start() {
        let language = FRPlatformMgr.getLanguage();
        let sp = language == "br" ? this.brSp : this.enSp;
        xNodeFR.setSpriteFrame("", this.node, sp)
    }


}

