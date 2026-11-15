import { _decorator, CCString, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FRLanguageLabel')
export class FRLanguageLabel extends Component {
    @property(CCString)
    key = "";


    start() {


    }
}

