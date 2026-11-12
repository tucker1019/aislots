import { _decorator, CCString, Component, Node } from 'cc';
import { En, Pt, WBSLanguage } from './WBSlanguage';
import { xNodeWBS } from '../../xtools/xNodeWBS';
import { WBSConfig } from '../cfg/WBSConfig';
const { ccclass, property } = _decorator;

@ccclass('WBSLanguageLabel')
export class WBSLanguageLabel extends Component {
    @property(CCString)
    key = "";


    start() {
        if (this.key && WBSLanguage[this.key]) {
            let language = WBSConfig.lang;
            let languageDict = language == "br" ? Pt : En;

            xNodeWBS.setLabel("", this.node, languageDict[WBSLanguage[this.key]]);
        }

    }
}

