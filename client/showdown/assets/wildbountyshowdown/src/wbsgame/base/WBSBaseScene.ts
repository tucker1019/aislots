import { _decorator, Component, Node, UIOpacity, tween, isValid } from 'cc';
import { wbsgame } from '../wbsgame';
import { WBSEventName } from '../constant/WBSEventName';



const { ccclass, property } = _decorator;

@ccclass('WBSBaseScene')
export abstract class WBSBaseScene extends Component {
    @property(Node)
    loadingLayer: Node = null;

    onLoad() {
        wbsgame.message.on(WBSEventName.SHOW_LOADING, this.updateLoading.bind(this), this)
    }
    private updateLoading(eventname: string, boolean: boolean) {
        if (isValid(this.loadingLayer)) this.loadingLayer.active = boolean;
    }

    onDestroy() {
        wbsgame.message.offByTarger(this);
        this.unscheduleAllCallbacks();
    }
}

