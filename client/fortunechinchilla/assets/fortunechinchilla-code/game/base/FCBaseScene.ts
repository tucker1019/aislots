import { _decorator, Component, Node, UIOpacity, tween, isValid, find, view } from 'cc';
import { fcframe } from '../../fcframe/fcframe';

import { xNodeFC } from '../../xtools/xNodeFC';

import { FCEventName } from '../../fcframe/event/FCEventName';
import { FCGlobal } from '../view/layer/FCGlobal';

const { ccclass, property } = _decorator;

@ccclass('FCBaseScene')
export abstract class FCBaseScene extends Component {
    @property(Node)
    loadingLayer: Node = null;

    protected abstract initAttribute(): void;

    onLoad() {

  
        fcframe.message.on(FCEventName.SHOW_LOADING, this.updateLoading.bind(this), this)
        // this.runReplaceSceneAction();
    }
    private updateLoading(eventname: string, boolean: boolean) {

        if (isValid(this.loadingLayer)) this.loadingLayer.active = boolean;

    }
    runReplaceSceneAction() {
        xNodeFC.setProperty("", this.node, UIOpacity, "opacity", 0);
        let opacity: UIOpacity = xNodeFC.findComponent("", this.node, UIOpacity);
        if (opacity)
            tween(opacity).to(0.4, { opacity: 255 }).start()
    }

    onDestroy() {
        fcframe.message.offByTarger(this);
    }
}

