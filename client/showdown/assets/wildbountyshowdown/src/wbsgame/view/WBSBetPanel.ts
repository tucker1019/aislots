import { NodeEventType, UITransform, Vec3, _decorator, find, instantiate } from "cc";
import { xNodeWBS } from "../../xtools/xNodeWBS";
import { WBSBaseLayer } from "../base/WBSBaseLayer";
import { WBSOptLayer } from "./WBSOptLayer";
import { wbsgame } from "../wbsgame";
import { showMoney } from "../../xtools/WBSUtils";
const { ccclass, property } = _decorator;

@ccclass('WBSBetPanel')
export class WBSBetPanel extends WBSBaseLayer {
    // private yesFun: Function = null;
    private optCtrl: WBSOptLayer = null;
    onLoad() {
        this.optCtrl = find("Canvas/gamelayer/bottom").getComponent(WBSOptLayer)
        this.updateBet()
    }

    onEnable() {
        this.updateBet();
    }

    updateBet() {
        let panel = xNodeWBS.find("bg", this.node);
        panel.children.forEach(node => { node.active = false });
        panel.position = this.node.getComponent(UITransform).convertToNodeSpaceAR(xNodeWBS.find("btn_bet", this.optCtrl.node).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 45)));
        let item0 = xNodeWBS.find("item0", panel);

        let _multiples = wbsgame.gameMgr.getMultiples()
        for (let i = 0; i < _multiples.length; i++) {
            let item = xNodeWBS.find("item" + i, panel);
            if (!item) {
                item = instantiate(item0);
                item.parent = panel;
                item.name = "item" + i;
            }
            item.active = true;
            let num = wbsgame.gameMgr.getIsDouble() ? _multiples[i] * 1.5 : _multiples[i];
            xNodeWBS.setLabel("Label", item, showMoney(num))
            xNodeWBS.setActive("CheckBg", item, i == wbsgame.gameMgr.getBitIndex());
            item.off(NodeEventType.TOUCH_START);
            xNodeWBS.addTouchStartClick("", item, this.clickBetItem.bind(this, i));
        }
    }

    updateBetChoose() {
        let panel = xNodeWBS.find("bg", this.node);
        for (let i = 0; i < panel.children.length; i++) {
            xNodeWBS.setActive("CheckBg", panel.children[i], i == wbsgame.gameMgr.getBitIndex());
        }
    }

    clickBetItem(idx) {
        wbsgame.audioMgr.playSound("menu_icon_press")
        this.optCtrl.updateBitView(idx);
        this.updateBetChoose();
        this.onClickCloseBtn(false);
    }

    onClickCloseBtn(bClick = true) {
        if (this.node) {
            if (bClick) {
                wbsgame.audioMgr.playSound("COMMON_CANCEL_BTN")
            }
            // this.node.destroy()
            this.node.active = false;
        }
    }

}
