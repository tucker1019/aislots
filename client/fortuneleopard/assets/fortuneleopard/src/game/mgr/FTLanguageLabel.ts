import { _decorator, CCString, Component, Node } from 'cc';
import { FTLanguage } from '../view/layer/FTLanguage';
import { xNodeFT } from '../../xtools/xNodeFT';
import { FTConfigCtrl } from '../view/layer/FTConfigCtrl';
const { ccclass, property } = _decorator;

@ccclass('FTLanguageLabel')
export class FTLanguageLabel extends Component {
    @property(CCString)
    key = "";

    
    start() {

        // if(this.key && FTLanguage[this.key]){
        //     xNodeFT.setLabel("", this.node, FTConfigCtrl.Instance.getLanguageText(FTLanguage[this.key]));
        // }
    
    }
}

