import { _decorator, Component, Node, UIOpacity, tween, isValid } from 'cc';
import { ftframe } from '../../ftframe/ftframe';

import { xNodeFT } from '../../xtools/xNodeFT';

import FTNetController from '../net/FTNetController';
import { FTEventName } from '../../ftframe/event/FTEventName';

const { ccclass, property } = _decorator;

@ccclass('FTBaseScene')
export abstract class FTBaseScene extends Component {
    @property(Node)
    loadingLayer: Node = null;

    protected abstract initAttribute(): void;
    
    onLoad() {
        ftframe.message.on(FTEventName.SHOW_LOADING, this.updateLoading.bind(this), this)
        // this.runReplaceSceneAction();
    }
    private updateLoading(eventname:string,boolean:boolean) {

        if (isValid(this.loadingLayer)) this.loadingLayer.active = boolean;

    }
    runReplaceSceneAction() {
        xNodeFT.setProperty("", this.node, UIOpacity, "opacity", 0);
        let opacity: UIOpacity = xNodeFT.findComponent("", this.node, UIOpacity);
        if (opacity)
            tween(opacity).to(0.4, { opacity: 255 }).start()
    }

    onDestroy() {
        let Node = FTNetController.netNode;
        Node.removeResponeHandlerByTarget(this);
        ftframe.message.offByTarger(this);
    }
}

