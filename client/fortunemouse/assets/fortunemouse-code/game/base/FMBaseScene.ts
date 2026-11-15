import { _decorator, Component, Node, UIOpacity, tween, isValid, find, view } from 'cc';
import { fmframe } from '../../fmframe/fmframe';

import { xNodeFM } from '../../xtools/xNodeFM';
import { getAdapterScale } from '../common/FMUtils';
import { FMEventName } from '../../fmframe/event/FMEventName';
import { FMGlobal } from '../view/layer/FMGlobal';

const { ccclass, property } = _decorator;

@ccclass('FMBaseScene')
export abstract class FMBaseScene extends Component {
    @property(Node)
    loadingLayer: Node = null;

    protected abstract initAttribute(): void;

    onLoad() {
    

        fmframe.message.on(FMEventName.SHOW_LOADING, this.updateLoading.bind(this), this)
        // this.runReplaceSceneAction();
    }
    private updateLoading(eventname: string, boolean: boolean) {

        if (isValid(this.loadingLayer)) this.loadingLayer.active = boolean;

    }
    runReplaceSceneAction() {
        xNodeFM.setProperty("", this.node, UIOpacity, "opacity", 0);
        let opacity: UIOpacity = xNodeFM.findComponent("", this.node, UIOpacity);
        if (opacity)
            tween(opacity).to(0.4, { opacity: 255 }).start()
    }

    onDestroy() {
        fmframe.message.offByTarger(this);
    }
}

