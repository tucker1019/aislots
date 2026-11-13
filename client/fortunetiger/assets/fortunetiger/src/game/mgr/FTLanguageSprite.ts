import { _decorator, Component, Node, SpriteFrame, Sprite } from 'cc';
import { xNodeFT } from '../../xtools/xNodeFT';
import { FTPlatformMgr } from '../3rd/FTPlatformMgr';
const { ccclass, property } = _decorator;

@ccclass('FTLanguageSprite')
export class FTLanguageSprite extends Component {

    @property(SpriteFrame)
    enSp: SpriteFrame = null
    @property(SpriteFrame)
    brSp: SpriteFrame = null


    start() {
        let language = FTPlatformMgr.getLanguage();
        language = "en"
        let sp = language == "en" ? this.enSp : this.brSp;
        xNodeFT.setSpriteFrame("", this.node, sp)
    }


}

