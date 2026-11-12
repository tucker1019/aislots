import { _decorator, BlockInputEvents, Button, Component, find, instantiate, Label, math, Node, Toggle, Tween, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { xNodeWBS } from '../../xtools/xNodeWBS';
import { showMoney } from '../../xtools/WBSUtils';
import { wbsgame } from '../wbsgame';
import { WBSBetOptionCtrl } from './WBSBetOptionCtrl';
const { ccclass, property } = _decorator;

@ccclass('WBSPopupMenuCtrl')
export class WBSPopupMenuCtrl extends Component {

    // layerCtrl: WBSGameLayerCtrl;
    bgBtn: Button = null;
    bgOpa: UIOpacity = null;

    PopupBlock: BlockInputEvents;

    protected initAttribute() {
        // wbsgame.gamelayer = find("Canvas").getChildByName("GameLayer").getComponent(WBSGameLayerCtrl);

        this.PopupBlock = this.node.getComponent(BlockInputEvents);
    }

    protected start(): void {
        this.initAttribute();

        this.bgBtn = xNodeWBS.findComponent("SpriteSplash", this.node, Button);
        this.bgOpa = xNodeWBS.findComponent("SpriteSplash", this.node, UIOpacity);
        xNodeWBS.addClick("", this.bgBtn.node, this.onClickBg.bind(this));
        this.bgOpa.node.active = false;
        this.PopupBlock.enabled = false;
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
        this.bgBtn.interactable = false;
        tween(this.bgOpa)
            .to(0.5, { opacity: 130 })
            .start()


        let widSize = this.node.getComponent(UITransform).contentSize;
        let nodeUIransform = node.getComponent(UITransform);

        node.active = true;
        node.position = new Vec3(0, -widSize.height / 2 - 20, 0);
        tween(node)
            .to(0.5, { position: new Vec3(0, -widSize.height / 2 + nodeUIransform.height, 0) })
            .call(() => {
                this.bgBtn.interactable = true;
            })
            .start()
    }

    hidePanel(node) {
        let widSize = this.node.getComponent(UITransform).contentSize;
        let nodeUIransform = node.getComponent(UITransform);;

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
                this.PopupBlock.enabled = false;
            })
            .start()

    }

    updateMoney(allLab: Label, betLab: Label, winLab: Label) {
        if (allLab) {
            allLab.string = showMoney(wbsgame.gameMgr.getUserData().coin);
        }
        if (betLab) {
            betLab.string = showMoney(wbsgame.gameMgr.getTotalBitNum(), false);
        }
        if (winLab) {
            winLab.string = showMoney(wbsgame.gameMgr.getWinMoney(), false);
        }
    }

    showAudoPanel() {
        this.bgOpa.node.active = true;
        this.PopupBlock.enabled = true;
        this.bgOpa.opacity = 0;

        let closeFunc = () => {
            wbsgame.audioMgr.playSound("list_item_click");
            this.hidePanel(panel_auto);
        }

        let endFunc = async () => {
           wbsgame.audioMgr.playSound("list_item_click");
            let cnt = 0;
            for (let i = 1; i <= 5; i++) {
                let toggle: Toggle = xNodeWBS.findComponent("auto_panel2/ToggleGroup/Toggle" + i, panel_auto, Toggle);
                if (toggle.isChecked) {
                    cnt = [10, 30, 50, 80, 1000][i - 1];
                    break;
                }
            }

            wbsgame.gamelayer.optCtrl.onAutoSelectClick(cnt);
            this.hidePanel(panel_auto);
        }

        let panel_auto = xNodeWBS.find("panel_auto", this.node);
        if (!panel_auto) {
            panel_auto = instantiate(wbsgame.gamelayer.panelAutoPrefab);
            panel_auto.parent = this.node;
            panel_auto.name = "panel_auto";

            xNodeWBS.addClick("btn", panel_auto, endFunc);
            xNodeWBS.addClick("ic_close", panel_auto, closeFunc);
        }
        this.showPanel(panel_auto);
        this.updateMoney(xNodeWBS.findComponent("node_all/lab", panel_auto, Label), xNodeWBS.findComponent("node_bet/lab", panel_auto, Label), xNodeWBS.findComponent("node_win/lab", panel_auto, Label));
    }

    showRulePanel() {

        this.bgOpa.node.active = true;
        this.PopupBlock.enabled = true;
        this.bgOpa.opacity = 0;

        let closeFunc = () => {
           wbsgame.audioMgr.playSound("list_item_click");
            this.hidePanel(panel_rule);
        }
        let panel_rule = xNodeWBS.find("panel_rule", this.node);
        if (!panel_rule) {
            panel_rule = instantiate(wbsgame.gamelayer.panelRulePrefab);
            panel_rule.parent = this.node;
            panel_rule.name = "panel_rule";
            panel_rule.getComponent(UITransform).contentSize = this.node.getComponent(UITransform).contentSize;
            xNodeWBS.addClick("menu_close_button", panel_rule, closeFunc);
        }
        this.showPanel(panel_rule);
    }

    showAllMoneyPanel() {
        this.bgOpa.node.active = true;
        this.PopupBlock.enabled = true;
        this.bgOpa.opacity = 0;

        let closeFunc = () => {
           wbsgame.audioMgr.playSound("list_item_click");
            this.hidePanel(panel_balance);
        }
        let panel_balance = xNodeWBS.find("panel_balance", this.node);
        if (!panel_balance) {
            panel_balance = instantiate(wbsgame.gamelayer.panelBalancePrefab);
            panel_balance.parent = this.node;
            panel_balance.name = "panel_balance";
            xNodeWBS.addClick("ic_close", panel_balance, closeFunc);
        }

        this.showPanel(panel_balance);
        xNodeWBS.setLabel("auto_info_panel2/lab", panel_balance, showMoney(wbsgame.gameMgr.getUserData().coin));
    }

    showBetPanel() {
        this.bgOpa.node.active = true;
        this.PopupBlock.enabled = true;
        this.bgOpa.opacity = 0;

        let panel_bet = xNodeWBS.find("panel_bet", this.node);
        if (!panel_bet) {
            panel_bet = instantiate(wbsgame.gamelayer.panelBetPrefab);;
            panel_bet.parent = this.node;
            panel_bet.name = "panel_bet";
            this.scheduleOnce(() => {
                panel_bet.getComponent(WBSBetOptionCtrl).init(this);
            }, 0)
        } else {
            panel_bet.getComponent(WBSBetOptionCtrl).showUI();
        }
        this.showPanel(panel_bet);
    }

}

