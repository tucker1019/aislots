import { _decorator, Label, Button, Vec3, Component } from 'cc';
import { xNodeFL } from '../../../xtools/xNodeFL';
import { FLBaseLayer } from '../../base/FLBaseLayer';


import { FLConfigCtrl } from './FLConfigCtrl';
import { FLLanguage } from './FLLanguage';
const { ccclass, property } = _decorator;

let POS_LIST = [-179.444, 180.615]

@ccclass('FLAlertLayer')
export class FLAlertLayer extends Component {

    lab_tip: Label = null
    lab_ok: Label = null
    lab_cancel: Label = null

    btn_ok: Button = null
    btn_cancel: Button = null

    callback_ok = null
    callback_cancel = null


    init() {

        this.lab_tip = xNodeFL.findComponent("img_bg/lab_tip", this.node, Label)
        this.btn_ok = xNodeFL.findComponent("img_bg/btn_ok", this.node, Button)
        this.btn_cancel = xNodeFL.findComponent("img_bg/btn_cancel", this.node, Button)

        this.lab_ok = xNodeFL.findComponent("img_bg/btn_ok/Label", this.node, Label)
        this.lab_cancel = xNodeFL.findComponent("img_bg/btn_cancel/Label", this.node, Label)

        this.node.active = false

        xNodeFL.addClick("", this.btn_ok.node, this.onBtnOk.bind(this))
        xNodeFL.addClick("", this.btn_cancel.node, this.onBtnCancel.bind(this),)
        xNodeFL.addClick("img_bg/icon_guanbi", this.node, this.onBtnCancel.bind(this),)

        this.lab_tip.string = ""
    }

    setLanguage() {
        this.lab_tip.string = FLConfigCtrl.Instance.getLanguageText(FLLanguage.CONNECT_TIP)
        this.lab_ok.string = FLConfigCtrl.Instance.getLanguageText(FLLanguage.BTN_OK)
        this.lab_cancel.string = FLConfigCtrl.Instance.getLanguageText(FLLanguage.BTN_CANCEL)
    }

    showAlert(content, okCancel, cancelCancel = null) {

        this.init()

        this.setLanguage()

        this.btn_ok.node.active = false
        this.btn_cancel.node.active = false

        let btn_count = 0

        if (okCancel) {
            this.callback_ok = okCancel
            this.btn_ok.node.active = true
            btn_count += 1
        }
        if (cancelCancel) {
            this.callback_cancel = cancelCancel
            btn_count += 1
            this.btn_cancel.node.active = true
        }

        let y = this.btn_ok.node.getPosition().y

        if (btn_count == 1) {
            this.btn_ok.node.setPosition(new Vec3(0, y, 0))
        } else {
            this.btn_ok.node.setPosition(new Vec3(POS_LIST[0], y, 0))
            this.btn_cancel.node.setPosition(new Vec3(POS_LIST[1], y, 0))
        }

        this.node.active = true
        this.lab_tip.string = content
    }

    onBtnOk() {
        this.callback_ok && this.callback_ok()
        this.node.destroy();
    }

    onBtnCancel() {
        this.node.active = false
        this.callback_cancel && this.callback_cancel()
        // this.closeLayer();
        this.node.destroy();
    }

}

