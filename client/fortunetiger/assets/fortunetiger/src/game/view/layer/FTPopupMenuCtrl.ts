import { _decorator, Button, Component, find, Label, math, Node, Toggle, Tween, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { xNodeFT } from '../../../xtools/xNodeFT';
import { showMoney } from '../../common/FTUtils';
import { RulesPage } from '../../ui/rules_page';
import { FTBaseNode } from '../../base/FTBaseNode';
import { FTGameLayerCtrl } from './FTGameLayerCtrl';
import { FTGameManager } from '../../mgr/FTGameManager';
import FTLoadManager from '../../load/FTLoadManager';
import { FTBetOptionCtrl } from './FTBetOptionCtrl';
import { FTAudioMgr } from './FTAudioMgr';
import { FTPlatformMgr } from '../../3rd/FTPlatformMgr';
import { FTConstant } from '../../FTConstant/FTConstant';
const { ccclass, property } = _decorator;

@ccclass('FTPopupMenuCtrl')
export class FTPopupMenuCtrl extends FTBaseNode {

    layerCtrl: FTGameLayerCtrl;
    bgBtn: Button = null;
    bgOpa: UIOpacity = null;

    protected initAttribute() {
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FTGameLayerCtrl);
    }

    protected start(): void {
        this.initAttribute();

        this.bgBtn = xNodeFT.findComponent("SpriteSplash", this.node, Button);
        this.bgOpa = xNodeFT.findComponent("SpriteSplash", this.node, UIOpacity);
        xNodeFT.addClick("", this.bgBtn.node, this.onClickBg.bind(this));
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
        Tween.stopAllByTarget(this.bgOpa);
        this.bgBtn.interactable = true;
        tween(this.bgOpa)
            .to(0.5, { opacity: 130 })
            .start()


        let widSize = this.node.getComponent(UITransform).contentSize;
        let nodeUIransform = node.getComponent(UITransform);

        node.active = true;
        node.position = new Vec3(0, -widSize.height / 2 - 20, 0);
        tween(node)
            .to(0.5, { position: new Vec3(0, -widSize.height / 2 + nodeUIransform.height, 0) })
            .start()
    }

    hidePanel(node) {
        let widSize = this.node.getComponent(UITransform).contentSize;
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
            betLab.string = showMoney(FTGameManager.getTotalBitNum(), false);
        }
        if (winLab) {
            winLab.string = showMoney(FTGameManager.getWinMoney(), false);
        }
    }

    showAudoPanel() {
        this.bgOpa.node.active = true;
        this.bgOpa.opacity = 0;

        let panel_auto = xNodeFT.find("panel_auto", this.node);
        if (!panel_auto) {
            panel_auto = FTLoadManager.ins.showGetPrefab("res/load/prefab/games/panel_auto", this.node);
            panel_auto.name = "panel_auto";
        }
        this.showPanel(panel_auto);
        this.updateMoney(xNodeFT.findComponent("node_all/lab", panel_auto, Label), xNodeFT.findComponent("node_bet/lab", panel_auto, Label), xNodeFT.findComponent("node_win/lab", panel_auto, Label));

        let closeFunc = () => {
            FTAudioMgr.Instance.playSound("games/list_item_click");
            this.hidePanel(panel_auto);
        }

        let endFunc = async () => {
            FTAudioMgr.Instance.playSound("games/list_item_click");
            let cnt = 0;
            for (let i = 1; i <= 5; i++) {
                let toggle: Toggle = xNodeFT.findComponent("auto_panel2/ToggleGroup/Toggle" + i, panel_auto, Toggle);
                if (toggle.isChecked) {
                    cnt = [10, 30, 50, 80, 1000][i - 1];
                    break;
                }
            }

            this.layerCtrl.optCtrl.onAutoSelectClick(cnt);
            this.hidePanel(panel_auto);
        }

        xNodeFT.addClick("btn", panel_auto, endFunc);
        xNodeFT.addClick("ic_close", panel_auto, closeFunc);
    }

    private rulesPage: RulesPage = null;

    showRulePanel() {
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        this.rulesPage ??= new RulesPage(canvas);
        this.rulesPage.open();
    }

    onDestroy() {
        this.rulesPage?.close();
        super.onDestroy();
    }

    showAllMoneyPanel() {
        this.bgOpa.node.active = true;
        this.bgOpa.opacity = 0;

        let panel_balance = xNodeFT.find("panel_balance", this.node);
        if (!panel_balance) {
            panel_balance = FTLoadManager.ins.showGetPrefab("res/load/prefab/games/panel_balance", this.node);
            panel_balance.name = "panel_balance";
        }

        this.showPanel(panel_balance);

        xNodeFT.setLabel("auto_info_panel2/lab", panel_balance, showMoney(this.layerCtrl.optCtrl.curAllMoney));

        let closeFunc = () => {
            FTAudioMgr.Instance.playSound("games/list_item_click");
            this.hidePanel(panel_balance);
        }
        xNodeFT.addClick("ic_close", panel_balance, closeFunc);
    }

    showBetPanel() {
        this.bgOpa.node.active = true;
        this.bgOpa.opacity = 0;

        let panel_bet = xNodeFT.find("panel_bet", this.node);
        if (!panel_bet) {
            panel_bet = FTLoadManager.ins.showGetPrefab("res/load/prefab/games/panel_bet", this.node);
            panel_bet.name = "panel_bet";
            this.scheduleOnce(() => {
                panel_bet.getComponent(FTBetOptionCtrl).init(this);
            }, 0)
        } else {
            panel_bet.getComponent(FTBetOptionCtrl).showUI();
        }
        this.showPanel(panel_bet);

    }

}

