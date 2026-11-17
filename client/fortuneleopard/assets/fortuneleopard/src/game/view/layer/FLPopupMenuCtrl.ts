import { _decorator, Button, Component, find, Label, math, Node, Size, Toggle, Tween, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { xNodeFL } from '../../../xtools/xNodeFL';
import { showMoney } from '../../common/FLUtils';
import { FLBaseNode } from '../../base/FLBaseNode';
import { FLGameLayerCtrl } from './FLGameLayerCtrl';
import { FLGameManager } from '../../mgr/FLGameManager';
import FLLoadManager from '../../load/FLLoadManager';
import { FLBetOptionCtrl } from './FLBetOptionCtrl';
import { FLAudioMgr } from './FLAudioMgr';
import { FLGlobal } from './FLGlobal';
import { FLConstant } from '../../FLConstant/FLConstant';
import { FLPanel } from './FLPanel';
const { ccclass, property } = _decorator;

@ccclass('FLPopupMenuCtrl')
export class FLPopupMenuCtrl extends FLBaseNode {

    layerCtrl: FLGameLayerCtrl;
    bgBtn: Button = null;
    bgOpa: UIOpacity = null;

    protected initAttribute() {
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FLGameLayerCtrl);
    }

    protected start(): void {
        this.initAttribute();

        this.bgBtn = xNodeFL.findComponent("SpriteSplash", this.node, Button);
        this.bgOpa = xNodeFL.findComponent("SpriteSplash", this.node, UIOpacity);
        xNodeFL.addClick("", this.bgBtn.node, this.onClickBg.bind(this));
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

        node.position = new Vec3(0, 0, 0);
        node.active = true;
        tween(node)
            .to(0.5, { position: new Vec3(0, nodeUIransform.height, 0) })
            .start()
    }

    hidePanel(node) {
        let widSize = this.node.getComponent(UITransform).contentSize;
        let nodeUIransform = node.getComponent(UITransform);

        tween(node)
            .to(0.5, { position: new Vec3(0, 0, 0) })
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
            betLab.string = showMoney(FLGameManager.getTotalBitNum(), false);
        }
        if (winLab) {
            winLab.string = showMoney(FLGameManager.getWinMoney(), false);
        }
    }
    getHistoryUrl() {
        let url = "https://testgame.ab3.bet/gamehistroy/index.html?uid=";
        if (FLGlobal.env == "master") {
            url = "https://game.vs2gjm.com//gamehistroy/index.html?uid=";
        }
        url += FLGlobal.USER.uid + "&game_id=" + FLConstant.GAMEID + "&env=" + FLGlobal.env + "&sid=" + FLGlobal.USER.accessToken
        return url;
    }
    showHistoryPanel() {
        this.bgOpa.node.active = true;

        let panel_com = xNodeFL.find("panel_com", this.node);
        if (!panel_com) {
            panel_com = FLLoadManager.ins.showGetPrefab("res/load/prefab/games/panel_com", this.node);
            panel_com.name = "panel_com";
            panel_com.getComponent(UITransform).contentSize = this.node.getComponent(UITransform).contentSize;
        }
        panel_com.getChildByName("tit").getChildByName("lab").getComponent(Label).string = "History";
        let url = this.getHistoryUrl();
        const panelCtrl = panel_com.getComponent(FLPanel);
        panelCtrl?.openUrl("History", url);
        this.showPanel(panel_com);
        let closeFunc = () => {
            FLAudioMgr.Instance.playSound("games/list_item_click");
            this.hidePanel(panel_com);
        }
        xNodeFL.addClick("ic_close", panel_com, closeFunc);
    }
    showAudoPanel() {
        this.bgOpa.node.active = true;
        this.bgOpa.opacity = 0;

        let panel_auto = xNodeFL.find("panel_auto", this.node);
        if (!panel_auto) {
            panel_auto = FLLoadManager.ins.showGetPrefab("res/load/prefab/games/panel_auto", this.node);
            panel_auto.name = "panel_auto";
        }
        this.showPanel(panel_auto);
        this.updateMoney(xNodeFL.findComponent("node_all/lab", panel_auto, Label), xNodeFL.findComponent("node_bet/lab", panel_auto, Label), xNodeFL.findComponent("node_win/lab", panel_auto, Label));

        let closeFunc = () => {
            FLAudioMgr.Instance.playSound("games/list_item_click");
            this.hidePanel(panel_auto);
        }

        let endFunc = async () => {
            // FLAudioMgr.Instance.playSound("games/list_item_click");
            let cnt = 0;
            for (let i = 1; i <= 5; i++) {
                let toggle: Toggle = xNodeFL.findComponent("auto_panel2/ToggleGroup/Toggle" + i, panel_auto, Toggle);
                if (toggle.isChecked) {
                    cnt = [10, 30, 50, 80, 1000][i - 1];
                    break;
                }
            }

            this.layerCtrl.optCtrl.onAutoSelectClick(cnt);
            this.hidePanel(panel_auto);
        }

        xNodeFL.addClick("btn", panel_auto, endFunc);
        xNodeFL.addClick("ic_close", panel_auto, closeFunc);
    }

    showRulePanel() {
        this.bgOpa.node.active = true;
        this.bgOpa.opacity = 0;

        let panel_rule = xNodeFL.find("panel_rule", this.node);
        if (!panel_rule) {
            panel_rule = FLLoadManager.ins.showGetPrefab("res/load/prefab/games/panel_rule", this.node);
            panel_rule.name = "panel_rule";
            panel_rule.getComponent(UITransform).contentSize = new Size(  panel_rule.getComponent(UITransform).contentSize.width, this.node.getComponent(UITransform).contentSize.height)
        }
        this.showPanel(panel_rule);


        let closeFunc = () => {
            FLAudioMgr.Instance.playSound("games/list_item_click");
            this.hidePanel(panel_rule);
        }
        xNodeFL.addClick("menu_close_button", panel_rule, closeFunc);
    }

    showAllMoneyPanel() {
        this.bgOpa.node.active = true;
        this.bgOpa.opacity = 0;

        let panel_balance = xNodeFL.find("panel_balance", this.node);
        if (!panel_balance) {
            panel_balance = FLLoadManager.ins.showGetPrefab("res/load/prefab/games/panel_balance", this.node);
            panel_balance.name = "panel_balance";
        }

        this.showPanel(panel_balance);

        xNodeFL.setLabel("auto_info_panel2/lab", panel_balance, showMoney(this.layerCtrl.optCtrl.curAllMoney));

        let closeFunc = () => {
            FLAudioMgr.Instance.playSound("games/list_item_click");
            this.hidePanel(panel_balance);
        }
        xNodeFL.addClick("ic_close", panel_balance, closeFunc);
    }

    showBetPanel() {
        this.bgOpa.node.active = true;
        this.bgOpa.opacity = 0;

        let panel_bet = xNodeFL.find("panel_bet", this.node);
        if (!panel_bet) {
            panel_bet = FLLoadManager.ins.showGetPrefab("res/load/prefab/games/panel_bet", this.node);
            panel_bet.name = "panel_bet";
            this.scheduleOnce(() => {
                panel_bet.getComponent(FLBetOptionCtrl).init(this);
            }, 0)
        } else {
            panel_bet.getComponent(FLBetOptionCtrl).showUI();
        }
        this.showPanel(panel_bet);

    }

}

