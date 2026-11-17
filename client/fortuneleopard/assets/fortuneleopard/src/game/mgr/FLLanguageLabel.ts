import { _decorator, CCString, Component, Node } from 'cc';
import { FLLanguage } from '../view/layer/FLLanguage';
import { xNodeFL } from '../../xtools/xNodeFL';
import { FLConfigCtrl } from '../view/layer/FLConfigCtrl';
const { ccclass, property } = _decorator;

@ccclass('FLLanguageLabel')
export class FLLanguageLabel extends Component {
    @property(CCString)
    key = "";

    
    start() {

        // if(this.key && FLLanguage[this.key]){
        //     xNodeFL.setLabel("", this.node, FLConfigCtrl.Instance.getLanguageText(FLLanguage[this.key]));
        // }
    
    }
}

