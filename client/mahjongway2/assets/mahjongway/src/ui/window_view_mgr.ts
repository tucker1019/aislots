import { _decorator, Component, ResolutionPolicy, UITransform, view } from 'cc';
import { printDebug } from '../com/utils';
const { ccclass } = _decorator;

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
        this.fitLaunchBackground();
    }
    /** 封面采用 cover：保持原图比例铺满可视区域，超出屏幕的部分裁掉。 */
    private fitLaunchBackground() {
        const launch = this.node.getChildByName('lauch');
        const transform = launch?.getComponent(UITransform);
        if (!transform || transform.width <= 0 || transform.height <= 0) return;

        // 使用适配后的逻辑尺寸，与 Canvas 子节点的坐标单位一致。
        const visible = view.getVisibleSize();
        const scale = Math.max(visible.width / transform.width, visible.height / transform.height);
        launch.setPosition(0, 0, launch.position.z);
        launch.setScale(scale, scale, 1);
    }
}
