import { Label, NodeEventType, Slider, Tween, UITransform, _decorator, find, tween } from "cc";
import { xNodeWBS } from "../../xtools/xNodeWBS";
import { WBSOptLayer } from "./WBSOptLayer";
import { WBSBaseLayer } from "../base/WBSBaseLayer";
import { wbsgame } from "../wbsgame";

const { ccclass, property } = _decorator;

@ccclass('WBSAutoPanel')
export class WBSAutoPanel extends WBSBaseLayer {
    private optCtrl: WBSOptLayer = null;

    _spinsCnt: number = 0;
    _ratioCnt: number = 0;
    _minBalanceCnt: number = 0;
    _maxBalanceCnt: number = 0;
    _isChooseRadio: boolean = false;
    _isChooseMinBalance: boolean = false;
    _isChooseMaxBalance: boolean = false;

    bindTarget = { value: 0 };

    onLoad() {
        this.init()
    }

    init() {
        this.optCtrl = find("Canvas/gamelayer/bottom").getComponent(WBSOptLayer);

        let autoList = [10, 50, 200, 500, 1000];
        for (let i = 1; i <= 5; i++) {
            xNodeWBS.setLabel(`bg/panel_totalSpins/node_autos/item${i}/Label`, this.node, "" + autoList[i - 1]);
            xNodeWBS.addClick(`bg/panel_totalSpins/node_autos/item${i}`, this.node, this.onClickAutoCntBtn.bind(this, autoList[i - 1]))
        }

        this._spinsCnt = autoList[1];
        xNodeWBS.setLabel("bg/panel_totalSpins/node_cnts/Label", this.node, "" + this._spinsCnt);
        this._ratioCnt = 100;
        xNodeWBS.setLabel("bg/panel_ratio/node_cnts/Label", this.node, this._ratioCnt + "x");
        this._minBalanceCnt = Math.ceil(wbsgame.gameMgr.getMoney() / 100 / 3);
        xNodeWBS.setLabel("bg/panel_minBalance/node_cnts/Label", this.node, "" + this._minBalanceCnt);
        this._maxBalanceCnt = Math.ceil(wbsgame.gameMgr.getMoney() / 100 * 3 / 2);
        xNodeWBS.setLabel("bg/panel_maxBalance/node_cnts/Label", this.node, "" + this._maxBalanceCnt);

        xNodeWBS.addTouchStartClick("bg/panel_totalSpins/node_cnts/btn_sub", this.node, this.onClickSpinsSubBtn.bind(this));
        xNodeWBS.addTouchCanelAndEndClick("bg/panel_totalSpins/node_cnts/btn_sub", this.node, this.onClickSpinsSubBtnEnd.bind(this));
        xNodeWBS.addTouchStartClick("bg/panel_totalSpins/node_cnts/btn_add", this.node, this.onClickSpinsAddBtn.bind(this));
        xNodeWBS.addTouchCanelAndEndClick("bg/panel_totalSpins/node_cnts/btn_add", this.node, this.onClickSpinsAddBtnEnd.bind(this));

        xNodeWBS.addTouchStartClick("bg/panel_ratio/node_cnts/btn_sub", this.node, this.onClickRatioSubBtn.bind(this));
        xNodeWBS.addTouchCanelAndEndClick("bg/panel_ratio/node_cnts/btn_sub", this.node, this.onClickRatioSubBtnEnd.bind(this));
        xNodeWBS.addTouchStartClick("bg/panel_ratio/node_cnts/btn_add", this.node, this.onClickRatioAddBtn.bind(this));
        xNodeWBS.addTouchCanelAndEndClick("bg/panel_ratio/node_cnts/btn_add", this.node, this.onClickRatioAddBtnEnd.bind(this));

        xNodeWBS.addTouchStartClick("bg/panel_minBalance/node_cnts/btn_sub", this.node, this.onClickMinBalanceSubBtn.bind(this));
        xNodeWBS.addTouchCanelAndEndClick("bg/panel_minBalance/node_cnts/btn_sub", this.node, this.onClickMinBalanceSubBtnEnd.bind(this));
        xNodeWBS.addTouchStartClick("bg/panel_minBalance/node_cnts/btn_add", this.node, this.onClickMinBalanceAddBtn.bind(this));
        xNodeWBS.addTouchCanelAndEndClick("bg/panel_minBalance/node_cnts/btn_add", this.node, this.onClickMinBalanceAddBtnEnd.bind(this));

        xNodeWBS.addTouchStartClick("bg/panel_maxBalance/node_cnts/btn_sub", this.node, this.onClickMaxBalanceSubBtn.bind(this));
        xNodeWBS.addTouchCanelAndEndClick("bg/panel_maxBalance/node_cnts/btn_sub", this.node, this.onClickMaxBalanceSubBtnEnd.bind(this));
        xNodeWBS.addTouchStartClick("bg/panel_maxBalance/node_cnts/btn_add", this.node, this.onClickMaxBalanceAddBtn.bind(this));
        xNodeWBS.addTouchCanelAndEndClick("bg/panel_maxBalance/node_cnts/btn_add", this.node, this.onClickMaxBalanceAddBtnEnd.bind(this));

        xNodeWBS.addClick("bg/panel_ratio/btn_choose", this.node, this.onClickChooseRatioBtn.bind(this, false));
        xNodeWBS.addClick("bg/panel_minBalance/btn_choose", this.node, this.onClickChooseMinBalanceBtn.bind(this, false));
        xNodeWBS.addClick("bg/panel_maxBalance/btn_choose", this.node, this.onClickChooseMaxBalanceBtn.bind(this, false));

        xNodeWBS.setActive("bg/panel_ratio/btn_choose/autoPanel_choose", this.node, this._isChooseRadio);
        xNodeWBS.setActive("bg/panel_minBalance/btn_choose/autoPanel_choose", this.node, this._isChooseMinBalance);
        xNodeWBS.setActive("bg/panel_maxBalance/btn_choose/autoPanel_choose", this.node, this._isChooseMaxBalance);

        xNodeWBS.addClick("bg/btn_cancel", this.node, this.onClickCloseBtn.bind(this));
        xNodeWBS.addClick("bg/btn_start", this.node, this.onClickStartBtn.bind(this));
    }

    onClickAutoCntBtn(cnt) {
        this._spinsCnt = cnt;
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_totalSpins/node_cnts/Label", this.node, Label);
        spinsLab.string = "" + cnt;
    }


    playNumAni(label: Label, sNum: number, eNum: number, bAdd: boolean, firstStep?: number) {
        Tween.stopAllByTarget(this.bindTarget)
        this.bindTarget = { value: sNum };
        let self = this;

        let step = bAdd ? 1 : -1;
        let newVal = this.bindTarget.value + step;
        if (firstStep) {
            newVal = this.bindTarget.value + firstStep;
        }
        if ((bAdd && newVal >= eNum) || (!bAdd && newVal <= eNum)) {
            this.bindTarget.value = eNum;
        } else {
            this.bindTarget.value = newVal;
        }

        if (sNum >= 0 && eNum >= 0 && sNum != eNum) {
            let addCnt = 0;
            tween(this.bindTarget)
                .delay(0.5)
                .repeat(Number.MAX_SAFE_INTEGER,
                    tween().delay(0.01).to(0.01, { value: newVal }, {
                        onUpdate(target: { value }) {
                            label.string = "" + newVal;
                            target.value = newVal;

                            if ((bAdd && newVal >= eNum) || (!bAdd && newVal <= eNum)) {
                                Tween.stopAllByTarget(self.bindTarget);
                                label.string = "" + eNum;
                            } else {
                                if (bAdd) {
                                    newVal = Math.min(eNum, newVal + step);
                                } else {
                                    newVal = Math.max(eNum, newVal + step);
                                }
                                if (addCnt > 500) {
                                    addCnt += Math.floor(addCnt / 500);
                                    step = bAdd ? Math.floor(addCnt / 500) : -Math.floor(addCnt / 500);
                                } else {
                                    addCnt += 1;
                                }
                            }
                        }
                    }))
                .start()

        }
    }

    onClickSpinsSubBtn() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_totalSpins/node_cnts/Label", this.node, Label);
        this.playNumAni(spinsLab, this._spinsCnt, 5, false);
    }
    onClickSpinsSubBtnEnd() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_totalSpins/node_cnts/Label", this.node, Label);
        Tween.stopAllByTarget(this.bindTarget);
        spinsLab.string = "" + this.bindTarget.value;
        this._spinsCnt = this.bindTarget.value;
    }
    onClickSpinsAddBtn() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_totalSpins/node_cnts/Label", this.node, Label);
        this.playNumAni(spinsLab, this._spinsCnt, 1000, true);

    }
    onClickSpinsAddBtnEnd() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_totalSpins/node_cnts/Label", this.node, Label);
        Tween.stopAllByTarget(this.bindTarget);
        spinsLab.string = "" + this.bindTarget.value;
        this._spinsCnt = this.bindTarget.value;
    }


    onClickRatioSubBtn() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_ratio/node_cnts/Label", this.node, Label);
        this.playNumAni(spinsLab, this._ratioCnt, 1, false);
    }
    onClickRatioSubBtnEnd() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_ratio/node_cnts/Label", this.node, Label);
        Tween.stopAllByTarget(this.bindTarget);
        spinsLab.string = "" + this.bindTarget.value + "x";
        this._ratioCnt = this.bindTarget.value;
        this.onClickChooseRatioBtn(true);
    }
    onClickRatioAddBtn() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_ratio/node_cnts/Label", this.node, Label);
        this.playNumAni(spinsLab, this._ratioCnt, 999999999999, true);
    }
    onClickRatioAddBtnEnd() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_ratio/node_cnts/Label", this.node, Label);
        Tween.stopAllByTarget(this.bindTarget);
        spinsLab.string = this.bindTarget.value + "x";
        this._ratioCnt = this.bindTarget.value;
        this.onClickChooseRatioBtn(true);
    }

    onClickMinBalanceSubBtn() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_minBalance/node_cnts/Label", this.node, Label);
        this.playNumAni(spinsLab, this._minBalanceCnt, 0, false, -10);
    }
    onClickMinBalanceSubBtnEnd() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_minBalance/node_cnts/Label", this.node, Label);
        Tween.stopAllByTarget(this.bindTarget);
        spinsLab.string = "" + this.bindTarget.value;
        this._minBalanceCnt = this.bindTarget.value;
        this.onClickChooseMinBalanceBtn(true);
    }
    onClickMinBalanceAddBtn() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_minBalance/node_cnts/Label", this.node, Label);
        this.playNumAni(spinsLab, this._minBalanceCnt, 999999999999, true, 10);
    }
    onClickMinBalanceAddBtnEnd() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_minBalance/node_cnts/Label", this.node, Label);
        Tween.stopAllByTarget(this.bindTarget);
        spinsLab.string = "" + this.bindTarget.value;
        this._minBalanceCnt = this.bindTarget.value;
        this.onClickChooseMinBalanceBtn(true);
    }

    onClickMaxBalanceSubBtn() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_maxBalance/node_cnts/Label", this.node, Label);
        this.playNumAni(spinsLab, this._maxBalanceCnt, 0, false, -10);
    }
    onClickMaxBalanceSubBtnEnd() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_maxBalance/node_cnts/Label", this.node, Label);
        Tween.stopAllByTarget(this.bindTarget);
        spinsLab.string = "" + this.bindTarget.value;
        this._maxBalanceCnt = this.bindTarget.value;
        this.onClickChooseMaxBalanceBtn(true);
    }
    onClickMaxBalanceAddBtn() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_maxBalance/node_cnts/Label", this.node, Label);
        this.playNumAni(spinsLab, this._maxBalanceCnt, 999999999999, true, 10);
    }
    onClickMaxBalanceAddBtnEnd() {
        let spinsLab: Label = xNodeWBS.findComponent("bg/panel_maxBalance/node_cnts/Label", this.node, Label);
        Tween.stopAllByTarget(this.bindTarget);
        spinsLab.string = "" + this.bindTarget.value;
        this._maxBalanceCnt = this.bindTarget.value;
        this.onClickChooseMaxBalanceBtn(true);
    }

    onClickChooseRatioBtn(val: boolean) {
        if (val) {
            this._isChooseRadio = true
        } else {
            this._isChooseRadio = !this._isChooseRadio;
        }
        xNodeWBS.setActive("bg/panel_ratio/btn_choose/autoPanel_choose", this.node, this._isChooseRadio);
    }

    onClickChooseMinBalanceBtn(val: boolean) {
        if (val) {
            this._isChooseMinBalance = true
        } else {
            this._isChooseMinBalance = !this._isChooseMinBalance;
        }
        xNodeWBS.setActive("bg/panel_minBalance/btn_choose/autoPanel_choose", this.node, this._isChooseMinBalance);
    }

    onClickChooseMaxBalanceBtn(val: boolean) {
        if (val) {
            this._isChooseMaxBalance = true
        } else {
            this._isChooseMaxBalance = !this._isChooseMaxBalance;
        }
        xNodeWBS.setActive("bg/panel_maxBalance/btn_choose/autoPanel_choose", this.node, this._isChooseMaxBalance);
    }



    onClickCloseBtn() {
        if (this.node) {
            wbsgame.audioMgr.playSound("COMMON_CANCEL_BTN")
            // this.node.destroy()
            this.node.active = false;
        }
    }

    onClickStartBtn() {
        wbsgame.audioMgr.playSound("menu_icon_press")
        wbsgame.gameMgr.setAudoNum(this._spinsCnt);
        wbsgame.gameMgr.setAutoAllWin(0);
        wbsgame.gameMgr.setAutoRatio(this._isChooseRadio ? this._ratioCnt : -1);
        wbsgame.gameMgr.setAutoMinBalance(this._isChooseMinBalance ? this._minBalanceCnt : -1);
        wbsgame.gameMgr.setAutoMaxBalance(this._isChooseMaxBalance ? this._maxBalanceCnt : -1);

        this.optCtrl.startAudo();
        this.onClickCloseBtn();
    }
}

