import { _decorator, Component, isValid, Node } from 'cc';
import { xNodeFC } from '../../xtools/xNodeFC';

const { ccclass, property } = _decorator;


@ccclass('FCLoadingUi')
export class FCLoadingUi extends Component {

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

