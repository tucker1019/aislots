import { _decorator, CCString, Component, Node } from 'cc';

import { xNodeFM } from '../../xtools/xNodeFM';
import { FMConfigCtrl } from '../view/layer/FMConfigCtrl';
const { ccclass, property } = _decorator;

@ccclass('FMLanguageLabel')
export class FMLanguageLabel extends Component {
    @property(CCString)
    key = "";

    
    start() {

  
    
    }
}

