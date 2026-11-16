import { _decorator, Component, UITransform, view } from 'cc';
const { ccclass } = _decorator;

@ccclass('FTBgAdaptCtrl')
export class FTBgAdaptCtrl extends Component {
    onEnable() {
        this.fit();
        view.on('design-resolution-changed', this.fit, this);
    }

    onDisable() {
        view.off('design-resolution-changed', this.fit, this);
    }

    private fit() {
        const { width, height } = view.getVisibleSize();
        const background = this.node.getComponent(UITransform);
        if (!background || width <= 0 || height <= 0 || background.width <= 0 || background.height <= 0) return;
        const scale = Math.max(width / background.width, height / background.height);
        this.node.setScale(scale, scale, 1);
    }
}
