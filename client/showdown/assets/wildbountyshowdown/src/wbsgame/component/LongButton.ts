import { _decorator, Button, CCFloat, CCObject, Component, Event, EventTarget, EventTouch, Node, NodeEventType, sys, Touch } from 'cc';
import { consoleLog } from '../../xtools/WBSUtils';
const { ccclass, property } = _decorator;

@ccclass('LongButton')
export class LongButton extends Button {
    @property(CCFloat)
    holdTime: number = 1.5;

    private _falgs: boolean = false;
    private _longTime: number = 0;
    private _clickCallback: Function = null;
    private _longClickCallback: Function = null;
    private _touchStartCallback: Function = null;
    private _touchCancelHandler: Function = null;
    protected onLoad() {
        this.node.on(NodeEventType.TOUCH_START, this.touchStartHandler, this)
        this.node.on(NodeEventType.TOUCH_MOVE, this.touchMoveHandler, this)
        this.node.on(NodeEventType.TOUCH_END, this.touchEndHandler, this)
        this.node.on(NodeEventType.TOUCH_CANCEL, this.touchCancelHandler, this)
    }

    private touchStartHandler() {
        this._falgs = true;
        this._longTime = 0;
        this._touchStartCallback && this._touchStartCallback();
    }
    private touchMoveHandler() {

    }
    private touchEndHandler(event) {

        if (this._longTime >= this.holdTime) {
            consoleLog(`触发长按按钮${event.target.name} 长按时间${this._longTime}`)
            this._longClickCallback && this._longClickCallback(this.node);
        }
        else {
            consoleLog(`触发按钮${event.target.name}`)
            this._clickCallback && this._clickCallback(this.node);
        }

        this._longTime = 0;
        this._falgs = false;
    }
    private touchCancelHandler() {
        this._falgs = false;
        this._longTime = 0;
        this._touchCancelHandler && this._touchCancelHandler();
    }
    addTouchStartEvent(_touchStartCallback: Function) {
        this._touchStartCallback = _touchStartCallback
    }
    addTouchCancelEvent(_touchCancelHandler: Function) {
        this._touchCancelHandler = _touchCancelHandler
    }
    addClickEvent(_clickCallback: Function) {
        this._clickCallback = _clickCallback;
    }


    addLongClickEvent(_longClickCallback: Function) {
        this._longClickCallback = _longClickCallback;
    }

    update(dt: number): void {
        super.update(dt)
        if (this._falgs) this._longTime += dt;
    }
}

