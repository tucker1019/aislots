import { resolutionFit } from '../../network/display';
import { __private, _decorator, Component, director, find, isValid, Node, ResolutionPolicy, sys, view, Widget } from 'cc';

import { WBSConfig } from '../cfg/WBSConfig';
import { consoleLog } from '../../xtools/WBSUtils';
import { WBSBgAdaptCtrl } from '../base/WBSBgAdaptCtrl';

const { ccclass, property } = _decorator;


@ccclass('WBSViewManager')
export class WBSViewManager extends Component {
    protected onLoad(): void {
        if (sys.isNative) return
        this.applyResolution();
        view.setResizeCallback(this.refreshUI.bind(this))
    }
    private applyResolution() {
        const frame=view.getFrameSize();
        const policy=resolutionFit(frame.width,frame.height)==='width'?ResolutionPolicy.FIXED_WIDTH:ResolutionPolicy.FIXED_HEIGHT;
        if(WBSConfig.adaptation!==policy){WBSConfig.adaptation=policy;view.setResolutionPolicy(policy);}
    }
    refreshUI() {
        this.applyResolution();
        consoleLog("web 窗口发生变化.....>刷新ui")
        if (["game", "WBSGameScene"].indexOf(director.getScene().name) > -1) {
            this.refreshComp(find("Canvas"))
        }
    }

    refreshComp(node: Node) {
        if (!isValid(node)) return
        if (node.children) {
            node.children.forEach(child => {
                this.refreshCompChildren(child)
            });
        }
    }

    refreshCompChildren(node: Node) {
        let widgets = node.getComponentsInChildren(Widget);
        widgets.forEach(widget => { widget && widget.updateAlignment() });
        let bgs = node.getComponentsInChildren(WBSBgAdaptCtrl);
        bgs.forEach(bg => { bg && bg.updateAlignment() });
    }
}


