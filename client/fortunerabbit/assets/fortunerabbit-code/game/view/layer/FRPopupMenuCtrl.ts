import { _decorator, Button, Component, find, Label, math, Tween, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { xNodeFR } from '../../../xtools/xNodeFR';
import { showMoney, translateAll } from '../../common/FRUtils';
import { FRBaseNode } from '../../base/FRBaseNode';
import { FRGameLayerCtrl } from './FRGameLayerCtrl';
import { FRGameManager } from '../../mgr/FRGameManager';
import FRLoadManager from '../../load/FRLoadManager';
import { FRAudioMgr } from './FRAudioMgr';
const { ccclass, property } = _decorator;

@ccclass('FRPopupMenuCtrl')
export class FRPopupMenuCtrl extends FRBaseNode {

    layerCtrl: FRGameLayerCtrl;
    bgBtn: Button = null;
    bgOpa: UIOpacity = null;

    protected initAttribute() {
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FRGameLayerCtrl);
    }

    protected start(): void {
        this.initAttribute();

        this.bgBtn = xNodeFR.findComponent("SpriteSplash", this.node, Button);
        this.bgOpa = xNodeFR.findComponent("SpriteSplash", this.node, UIOpacity);
        xNodeFR.addClick("", this.bgBtn.node, this.onClickBg.bind(this));
        this.bgOpa.node.active = false;
    }

    onClickBg() {
        this.bgBtn.interactable = false;
        this.node.children.forEach((node) => {
            if (node.name != "SpriteSplash" && node.active) {
                this.hidePanel(node);
            }
        })
    }

    showPanel(node) {
        translateAll(node)
        Tween.stopAllByTarget(this.bgOpa);
        this.bgBtn.interactable = true;
        tween(this.bgOpa)
            .to(0.5, { opacity: 130 })
            .start()


        let widSize: math.Size = this.node.getComponent(UITransform).contentSize;
        let nodeUIransform = node.getComponent(UITransform);

        node.active = true;
        node.position = new Vec3(0, -widSize.height / 2 - 20, 0);
        tween(node)
            .to(0.5, { position: new Vec3(0, -widSize.height / 2 + nodeUIransform.height, 0) })
            .start()
    }

    hidePanel(node) {
        let widSize: math.Size = this.node.getComponent(UITransform).contentSize;
        let nodeUIransform = node.getComponent(UITransform);

        tween(node)
            .to(0.5, { position: new Vec3(0, -widSize.height / 2 - 20, 0) })
            .call(() => {
                node.active = false;
            })
            .start()
        tween(this.bgOpa)
            .delay(0.2)
            .to(0.3, { opacity: 0 })
            .call(() => {
                this.bgOpa.node.active = false;
            })
            .start()

    }

    updateMoney(allLab: Label, betLab: Label, winLab: Label) {
        if (allLab) {
            allLab.string = showMoney(this.layerCtrl.optCtrl.curAllMoney);
        }
        if (betLab) {
            betLab.string = showMoney(FRGameManager.getTotalBitNum(), false);
        }
        if (winLab) {
            winLab.string = showMoney(FRGameManager.getWinMoney(), false);
        }
    }

    showAllMoneyPanel(){
        this.bgOpa.node.active = true;
        this.bgOpa.opacity = 0;

        let panel_balance = xNodeFR.find("panel_balance", this.node);
        if (!panel_balance) {
            panel_balance = FRLoadManager.ins.showGetPrefab("res/load/prefab/games/panel_balance", this.node);
            panel_balance.name = "panel_balance";
        }
        
        this.showPanel(panel_balance);

        xNodeFR.setLabel("auto_info_panel2/lab", panel_balance, showMoney(this.layerCtrl.optCtrl.curAllMoney));

        let closeFunc = () => {
            FRAudioMgr.Instance.playSound("games/Click");
            this.hidePanel(panel_balance);
        }
        xNodeFR.addClick("ic_close", panel_balance, closeFunc);
    }

}
