import { _decorator, Button, Color, Component, Node, NodeEventType, Sprite } from 'cc';
const { ccclass, property } = _decorator;


@ccclass('WBSButtonTrans')
export class WBSButtonTrans extends Component {
    @property(Color)
    normalColor: Color = new Color(255, 255, 255, 255);
    @property(Color)
    pressedColor: Color = new Color(255, 255, 255, 255);
    @property(Color)
    hoverColor: Color = new Color(255, 255, 255, 255);
    @property(Color)
    disabledColor: Color = new Color(255, 255, 255, 255);

    _isLocked = false;  // 是否锁定为禁用状态
    parentBtnState: NodeEventType = NodeEventType.TOUCH_END;
    parentBtnComp: Button = null;
    spriteComp: Sprite = null;

    onLoad() {

        this.parentBtnComp = this.node.parent.getComponent(Button);
        if (!this.parentBtnComp) {
            return
        }
        this.spriteComp = this.node.parent.getComponent(Sprite);

        this.node.parent.on(NodeEventType.TOUCH_START, this.onButtonTouchStart, this);
        this.node.parent.on(NodeEventType.TOUCH_MOVE, this.onButtonTouchMove, this);
        this.node.parent.on(NodeEventType.TOUCH_END, this.onButtonTouchEnd, this);
        this.node.parent.on(NodeEventType.TOUCH_CANCEL, this.onButtonTouchCancel, this);
    }

    onDestroy() {
        if (this.node.parent) {
            this.node.parent.off(NodeEventType.TOUCH_START, this.onButtonTouchStart, this);
            this.node.parent.off(NodeEventType.TOUCH_MOVE, this.onButtonTouchMove, this);
            this.node.parent.off(NodeEventType.TOUCH_END, this.onButtonTouchEnd, this);
            this.node.parent.off(NodeEventType.TOUCH_CANCEL, this.onButtonTouchCancel, this);
        }
    }

    setLocked(locked: boolean) {
        this._isLocked = locked;
        if (locked) {
            this.spriteComp!.color = this.disabledColor;
        } else {
            this.updateSpriteColor();
        }
    }

    updateSpriteColor() {
        if (this._isLocked || !this.parentBtnComp || !this.spriteComp) return;

        if (!this.parentBtnComp.interactable) {
            this.spriteComp.color = this.disabledColor;
        } else {
            if (this.parentBtnState == NodeEventType.TOUCH_START) {
                this.spriteComp!.color = this.pressedColor;
            } else if (this.parentBtnState == NodeEventType.TOUCH_MOVE) {
                this.spriteComp!.color = this.pressedColor;
            } else if (this.parentBtnState == NodeEventType.TOUCH_END) {
                this.spriteComp!.color = this.normalColor;
            } else if (this.parentBtnState == NodeEventType.TOUCH_CANCEL) {
                this.spriteComp!.color = this.normalColor;
            } 
            
        }
    }

    onButtonTouchStart() {
        this.parentBtnState = NodeEventType.TOUCH_START;
        if (!this._isLocked) {
            this.spriteComp!.color = this.pressedColor;
        }
    }

    onButtonTouchMove() {
        this.parentBtnState = NodeEventType.TOUCH_MOVE;
        if (!this._isLocked) {
            this.spriteComp!.color = this.pressedColor;
        }
    }

    onButtonTouchEnd() {
        this.parentBtnState = NodeEventType.TOUCH_END;
        if (!this._isLocked) {
            this.spriteComp!.color = this.normalColor;
        }
    }

    onButtonTouchCancel() {
        this.parentBtnState = NodeEventType.TOUCH_CANCEL;
        if (!this._isLocked) {
            this.spriteComp!.color = this.normalColor;
        }
    }
}


