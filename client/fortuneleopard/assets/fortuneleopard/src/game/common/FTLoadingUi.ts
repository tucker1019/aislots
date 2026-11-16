import { _decorator, Component, isValid, Node } from 'cc';
import { xNodeFT } from '../../xtools/xNodeFT';

const { ccclass, property } = _decorator;


@ccclass('FTLoadingUi')
export class FTLoadingUi extends Component {

    img_light: Node = null

    rotateTween = null


    protected onEnable(): void {
        this.unschedule(this.hide);
        this.scheduleOnce(this.hide, 10)
    }

    hide() {
        if (isValid(this.node)) this.node.active = false
    }
    start() {

    }






}

