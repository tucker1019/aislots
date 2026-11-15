import { _decorator, Component, Node, UIOpacity, tween, isValid, find, view } from 'cc';
import { frframe } from '../../frframe/frframe';

import { xNodeFR } from '../../xtools/xNodeFR';

import { FREventName } from '../../frframe/event/FREventName';
import { FRGlobal } from '../view/layer/FRGlobal';

const { ccclass, property } = _decorator;

@ccclass('FRBaseScene')
export abstract class FRBaseScene extends Component {
    @property(Node)
    loadingLayer: Node = null;

    protected abstract initAttribute(): void;

    onLoad() {

  
        frframe.message.on(FREventName.SHOW_LOADING, this.updateLoading.bind(this), this)
        // this.runReplaceSceneAction();
    }
    private updateLoading(eventname: string, boolean: boolean) {

        if (isValid(this.loadingLayer)) this.loadingLayer.active = boolean;

    }
    runReplaceSceneAction() {
        xNodeFR.setProperty("", this.node, UIOpacity, "opacity", 0);
        let opacity: UIOpacity = xNodeFR.findComponent("", this.node, UIOpacity);
        if (opacity)
            tween(opacity).to(0.4, { opacity: 255 }).start()
    }

    onDestroy() {
        frframe.message.offByTarger(this);
    }
}

