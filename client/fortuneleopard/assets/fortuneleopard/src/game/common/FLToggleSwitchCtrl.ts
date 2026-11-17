import { _decorator, Node } from 'cc';
import { FLBaseNode } from '../base/FLBaseNode';


const { ccclass } = _decorator;


@ccclass('FLToggleSwitchCtrl')
export class FLToggleSwitchCtrl extends FLBaseNode {

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
        //  FLAudioMgr.Instance.playToggleSwitch()
        this.callback && this.callback.call(this.caller, false)
    }

    off() {
        if (!this.interactable) {
            return
        }

        this.setCheck(true)
        // FLAudioMgr.Instance.playToggleSwitch()
        this.callback && this.callback.call(this.caller, true)
    }

}

