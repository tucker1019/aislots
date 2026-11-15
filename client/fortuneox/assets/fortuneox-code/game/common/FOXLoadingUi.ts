import { _decorator, Component, isValid, Node } from 'cc';


const { ccclass, property } = _decorator;


@ccclass('FOXLoadingUi')
export class FOXLoadingUi extends Component {

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

