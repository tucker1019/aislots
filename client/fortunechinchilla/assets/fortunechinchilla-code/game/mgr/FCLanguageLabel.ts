import { _decorator, CCString, Component, Node } from 'cc';
import { FCLanguage } from '../view/layer/FCLanguage';
import { xNodeFC } from '../../xtools/xNodeFC';
import { FCConfigCtrl } from '../view/layer/FCConfigCtrl';
const { ccclass, property } = _decorator;

@ccclass('FCLanguageLabel')
export class FCLanguageLabel extends Component {
    @property(CCString)
    key = "";


    start() {

        if (this.key && FCLanguage[this.key]) {
            xNodeFC.setLabel("", this.node, FCConfigCtrl.Instance.getLanguageText(FCLanguage[this.key]));
        }

    }
}

