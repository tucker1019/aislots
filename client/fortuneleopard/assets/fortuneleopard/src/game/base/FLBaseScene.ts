import { _decorator, Component, Node, UIOpacity, tween, isValid } from 'cc';
import { flframe } from '../../flframe/flframe';

import { xNodeFL } from '../../xtools/xNodeFL';

import { FLEventName } from '../../flframe/event/FLEventName';

const { ccclass, property } = _decorator;

@ccclass('FLBaseScene')
export abstract class FLBaseScene extends Component {
    @property(Node)
    loadingLayer: Node = null;

    protected abstract initAttribute(): void;
    
    onLoad() {
        flframe.message.on(FLEventName.SHOW_LOADING, this.updateLoading.bind(this), this)
        // this.runReplaceSceneAction();
    }
    private updateLoading(eventname:string,boolean:boolean) {

        if (isValid(this.loadingLayer)) this.loadingLayer.active = boolean;

    }
    runReplaceSceneAction() {
        xNodeFL.setProperty("", this.node, UIOpacity, "opacity", 0);
        let opacity: UIOpacity = xNodeFL.findComponent("", this.node, UIOpacity);
        if (opacity)
            tween(opacity).to(0.4, { opacity: 255 }).start()
    }

    onDestroy() {
        flframe.message.offByTarger(this);
    }
}

