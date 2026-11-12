import { _decorator } from "cc";
import { xNodeWBS } from "../../../src/xtools/xNodeWBS";
import { WBSBaseLayer } from "../../../src/wbsgame/base/WBSBaseLayer";

const { ccclass, property } = _decorator;

@ccclass('WBSAlertLayer')
export class WBSAlertLayer extends WBSBaseLayer {
    private yesFun: Function = null;

    onLoad() {
        super.onLoad()
        // xNodeWBS.addClick("bg/btn_close", this.node, this.onClickCloseBtn.bind(this))

    }

    showAlert(tip: string, yseFun: Function) {

        xNodeWBS.setLabel("bg/lab_tip", this.node, tip);
        // WBSUtils.translateAll(this.node)
        this.yesFun = yseFun;
    }

    onClickCloseBtn() {
        this.yesFun && this.yesFun();
        this.closeLayer();
    }

}

