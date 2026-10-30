import { _decorator, Component, ResolutionPolicy, macro, view } from 'cc';
import { printDebug } from '../com/utils';
const { ccclass, property } = _decorator;

@ccclass('window_view_mgr')
export class window_view_mgr extends Component {
    onLoad() {
        this.initOrientation();
        view.setResizeCallback(this.refreshUI.bind(this));
    }
    refreshUI() {
        printDebug('window-resize');
        this.initOrientation();
    }

    // 根据设计与实际屏幕比例选择适配策略，旋转屏幕后重新计算。
    initOrientation() {
        let actual_size = view.getVisibleSizeInPixel();
        let design_resolution = view.getDesignResolutionSize();
        let adaptation = ResolutionPolicy.FIXED_WIDTH;

        if (
            design_resolution.height / design_resolution.width >=
            actual_size.height / actual_size.width
        ) {
            adaptation = ResolutionPolicy.FIXED_HEIGHT;
        } else {
            adaptation = ResolutionPolicy.FIXED_WIDTH;
        }
        view.setResolutionPolicy(adaptation);
    }
}
