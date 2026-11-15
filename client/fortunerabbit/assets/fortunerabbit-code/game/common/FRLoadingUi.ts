import { _decorator, Component, isValid, Node } from 'cc';
import { xNodeFR } from '../../xtools/xNodeFR';

const { ccclass, property } = _decorator;


@ccclass('FRLoadingUi')
export class FRLoadingUi extends Component {

    img_light: Node = null

    rotateTween = null




    hide() {
        if (isValid(this.node)) this.node.active = false
    }
    start() {

    }






}

