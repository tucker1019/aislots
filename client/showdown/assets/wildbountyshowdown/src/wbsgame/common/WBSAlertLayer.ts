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



    onClickCloseBtn() {
        this.yesFun && this.yesFun();
        this.closeLayer();
    }

}

