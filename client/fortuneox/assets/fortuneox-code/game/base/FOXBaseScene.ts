import { _decorator, Component, Node, UIOpacity, tween, isValid } from 'cc';
import { foxframe } from '../../foxframe/foxframe';

import { xNodeFOX } from '../../xtools/xNodeFOX';
import { getAdapterScale } from '../common/FOXUtils';
import { FOXEventName } from '../../foxframe/event/FOXEventName';

const { ccclass, property } = _decorator;

@ccclass('FOXBaseScene')
export abstract class FOXBaseScene extends Component {
    @property(Node)
    loadingLayer: Node = null;

    protected abstract initAttribute(): void;
    
    onLoad() {
        foxframe.message.on(FOXEventName.SHOW_LOADING, this.updateLoading.bind(this), this)
        // this.runReplaceSceneAction();
    }
    private updateLoading(eventname:string,boolean:boolean) {

        if (isValid(this.loadingLayer)) this.loadingLayer.active = boolean;

    }
    runReplaceSceneAction() {
        xNodeFOX.setProperty("", this.node, UIOpacity, "opacity", 0);
        let opacity: UIOpacity = xNodeFOX.findComponent("", this.node, UIOpacity);
        if (opacity)
            tween(opacity).to(0.4, { opacity: 255 }).start()
    }

    onDestroy() {
        foxframe.message.offByTarger(this);
    }
}

