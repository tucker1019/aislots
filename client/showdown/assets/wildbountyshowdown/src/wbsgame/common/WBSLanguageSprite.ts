import { _decorator, Component, SpriteFrame } from "cc";
import { xNodeWBS } from "../../../src/xtools/xNodeWBS";
import { WBSPlatformMgr } from "../../../src/wbsgame/mgr/WBSPlatformMgr";
import { WBSConfig } from "../../../src/wbsgame/cfg/WBSConfig";

const { ccclass, property } = _decorator;

@ccclass('WBSLanguageSprite')
export class WBSLanguageSprite extends Component {

    @property(SpriteFrame)
    enSp: SpriteFrame = null
    @property(SpriteFrame)
    brSp: SpriteFrame = null


    start() {
        let language = WBSConfig.lang;
        let sp = language == "br" ? this.brSp : this.enSp;
        xNodeWBS.setSpriteFrame("", this.node, sp)
    }

}

