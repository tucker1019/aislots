import { _decorator, CCString, Component, Node } from 'cc';
import { FDLanguage } from '../view/layer/FDLanguage';
import { xNodeFD } from '../../xtools/xNodeFD';
import { FDConfigCtrl } from '../view/layer/FDConfigCtrl';
const { ccclass, property } = _decorator;

@ccclass('FDLanguageLabel')
export class FDLanguageLabel extends Component {
    @property(CCString)
    key = "";


    start() {

        if (this.key && FDLanguage[this.key]) {
            xNodeFD.setLabel("", this.node, FDConfigCtrl.Instance.getLanguageText(FDLanguage[this.key]));
        }

    }
}

