import { _decorator, Component, UITransform, view } from 'cc';

@_decorator.ccclass('FDBgAdaptCtrl')
export class FDBgAdaptCtrl extends Component {
    onEnable() {
        view.on('canvas-resize', this.fit, this);
        view.on('design-resolution-changed', this.fit, this);
        this.fit();
    }

    onDisable() {
        view.off('canvas-resize', this.fit, this);
        view.off('design-resolution-changed', this.fit, this);
    }

    private fit() {
        const size = view.getVisibleSize();
        const content = this.node.getComponent(UITransform).contentSize;
        if (!content.width || !content.height || !size.width || !size.height) return;
        const scale = Math.max(size.width / content.width, size.height / content.height);
        this.node.setScale(scale, scale, 1);
    }
}
