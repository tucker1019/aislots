import { _decorator, CCString, Component, Node } from 'cc';
import { FOXLanguage } from '../view/layer/FOXLanguage';
import { xNodeFOX } from '../../xtools/xNodeFOX';
import { FOXConfigCtrl } from '../view/layer/FOXConfigCtrl';
const { ccclass, property } = _decorator;

@ccclass('FOXLanguageLabel')
export class FOXLanguageLabel extends Component {
    @property(CCString)
    key = "";

    
    start() {

        if(this.key && FOXLanguage[this.key]){
            xNodeFOX.setLabel("", this.node, FOXConfigCtrl.Instance.getLanguageText(FOXLanguage[this.key]));
        }
    
    }
}

