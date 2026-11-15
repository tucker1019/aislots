import { _decorator, Node } from 'cc';
import { FDBaseNode } from '../base/FDBaseNode';


const { ccclass } = _decorator;


@ccclass('FDToggleSwitchCtrl')
export class FDToggleSwitchCtrl extends FDBaseNode {

    node_on: Node = null
    node_off: Node = null
    caller = null

    callback = null

    isChecked = false
    interactable = true
    initAttribute() { }
    onLoad() {
        this.node_on = this.node.children[0]
        this.node_off = this.node.children[1]
        this.node_on.on(Node.EventType.TOUCH_END, this.on, this)
        this.node_off.on(Node.EventType.TOUCH_END, this.off, this)

    }
    start() {
        this.initAttribute()
    }

    setCheck(isChecked) {
        this.isChecked = isChecked
        this.node_on.active = isChecked
        this.node_off.active = !isChecked
    }

    setCallback(callback, caller) {
        this.callback = callback
        this.caller = caller
    }

    on() {
        if (!this.interactable) {
            return
        }
        this.setCheck(false)
        //  FDAudioMgr.Instance.playToggleSwitch()
        this.callback && this.callback.call(this.caller, false)
    }

    off() {
        if (!this.interactable) {
            return
        }

        this.setCheck(true)
        // FDAudioMgr.Instance.playToggleSwitch()
        this.callback && this.callback.call(this.caller, true)
    }

}

