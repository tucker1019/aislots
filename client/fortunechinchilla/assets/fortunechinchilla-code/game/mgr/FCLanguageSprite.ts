import { _decorator, Component, Node, SpriteFrame, Sprite } from 'cc';
import { xNodeFC } from '../../xtools/xNodeFC';
import { FCPlatformMgr } from '../3rd/FCPlatformMgr';
const { ccclass, property } = _decorator;

@ccclass('FCLanguageSprite')
export class FCLanguageSprite extends Component {

    @property(SpriteFrame)
    enSp: SpriteFrame = null
    @property(SpriteFrame)
    brSp: SpriteFrame = null


    start() {
        let language = FCPlatformMgr.getLanguage();
        let sp = language == "en" ? this.enSp : this.brSp;
        xNodeFC.setSpriteFrame("", this.node, sp)
    }


}

