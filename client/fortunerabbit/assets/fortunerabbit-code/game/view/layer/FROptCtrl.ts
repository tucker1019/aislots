import { _decorator, Component, Node, Button, Label, Toggle, TERRAIN_HEIGHT_BASE, Tween, InstancedBuffer, Sprite, NodeEventType, tween, Color, find, Animation, isValid, sys, UITransform, Vec3, sp, UIOpacity, instantiate, Font } from 'cc';
import { frframe } from '../../../frframe/frframe';

import { xNodeFR } from '../../../xtools/xNodeFR';
import { FRBaseNode } from '../../base/FRBaseNode';
import { __, recovMoney, showMoney } from '../../common/FRUtils';
import { FRConstant, FRSTATE } from '../../FRConstant/FRConstant';
import FRLoadManager from '../../load/FRLoadManager';
import { FRGameManager } from '../../mgr/FRGameManager';
import { alertGame } from '../../net/FRGameUI';
import { AutoSpinPage } from '../../ui/auto_spin_page';
import { BetOptionsPage } from '../../ui/bet_options_page';
import { buildChoices } from '../../ui/bet_choices';
import { RulesPage } from '../../ui/rules_page';
import { FRAudioMgr } from './FRAudioMgr';
import { FRGameLayerCtrl } from './FRGameLayerCtrl';
import { FRGlobal } from './FRGlobal';

import { FRPlatformMgr } from '../../3rd/FRPlatformMgr';
import { DEV } from 'cc/env';
const { ccclass, property } = _decorator;

export enum OPT_STATE {
    START,
    ROLL,
    ROLL_RESULT_CLICK,
    ROLL_END,
    FREE,
    END,
}

// 游戏操作面板
@ccclass('FROptCtrl')
export class FROptCtrl extends FRBaseNode {
    @property([Font])
    fnts: Font[] = []
    ib_bar: Node = null;    // 跑马灯滚动条
    // ui_footer: Node = null; // 底下老虎须装饰图
    node_win_big: Node = null;  // 玩家赢钱-大横条

    lab_all_money: Label = null;    // 玩家总钱
    lab_bit_bottom: Label = null;   // 当前押注
    lab_award_num: Label = null;    // 当前赢钱

    btn_all: Node = null;    // 总钱点击
    btn_bet: Node = null;    // 押注点击

    panel1: Node = null;    // 第一页panel--包含spin等按钮
    panel2: Node = null;    // 第二页panel--包含rule等按钮

    btn_turbo: Node = null;     // 快速按钮
    subBtnNode: Node = null;    // 减注
    addBtnNode: Node = null;    // 加注
    btn_auto: Node = null;      // 自动

    btn_go: Node = null;        // 旋转 
    btn_stop: Node = null;      // 停止
    btn_autostop: Node = null;  // 停止自动

    btn_exit: Node = null;      // 退出按钮
    btn_sound: Node = null;     // 音量
    btn_rule: Node = null;      // 规则 
    btn_close: Node = null;     // 关闭panel2
    btn_menu: Node = null;      // 菜单
    tip_panel: Node = null;  // 提示条&&赢分条

    curAllMoney: number = 0; // 当前玩家总钱

    layerCtrl: FRGameLayerCtrl = null;

    // @property(Node)
    // private node_lines: Node = null;
    // @property(Label)
    // private lab_bit_top: Label = null;
    // @property(Label)
    // private lab_bit_bottom: Label = null;
    // @property(Node)
    // private node_btn_win: Node = null;

    // node_bit: Node = null
    // showLineBool: boolean = false

    isAutoShow: boolean = false
    btn_mask: Node = null
    // layout_auto: Node = null


    _canSendSpin: boolean = true;
    set canSendSpin(bVal: boolean) {
        this._canSendSpin = bVal;
    }
    get canSendSpin() {
        return this._canSendSpin;
    }

    _isTouchGo: boolean = false; // 是否开始触摸go按钮
    set isTouchGo(isTouchGo) {
        this._isTouchGo = isTouchGo;
        if (!isTouchGo) {
            if (FRGameManager.getState() == FRSTATE.READY) {
                this.updateGoBtnAnim();
            }
        }
    }
    get isTouchGo() {
        return this._isTouchGo
    }

    protected initAttribute() {

    }

    onLoad(): void {

        this.canSendSpin = true;
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FRGameLayerCtrl);
        this.ib_bar = xNodeFR.find("ib_bar", this.node);
        // this.ui_footer = xNodeFR.find("ui_footer_a", this.node);
        this.node_win_big = xNodeFR.find("node_win_big", this.node);
        this.lab_all_money = xNodeFR.findComponent("node_all/lab", this.node, Label);
        this.lab_bit_bottom = xNodeFR.findComponent("node_bet/lab", this.node, Label);
        this.lab_award_num = xNodeFR.findComponent("node_win/lab", this.node, Label);

        if (FRGlobal.COUNTRYCODE == "ID") {
            this.lab_all_money.font = this.fnts[0]
            this.lab_bit_bottom.font = this.fnts[0]
            this.lab_award_num.font = this.fnts[0]
        }

        this.btn_all = xNodeFR.find("node_all", this.node);
        this.btn_bet = xNodeFR.find("node_bet", this.node);

        this.panel1 = xNodeFR.find("panel1", this.node);
        this.panel2 = xNodeFR.find("panel2", this.node);

        this.btn_turbo = xNodeFR.find("panel1/btn_turbo", this.node);
        this.subBtnNode = xNodeFR.find("panel1/btn_sub", this.node);
        this.addBtnNode = xNodeFR.find("panel1/btn_add", this.node);
        this.btn_auto = xNodeFR.find("panel1/btn_auto_panel", this.node);

        this.btn_menu = xNodeFR.find("panel1/btn_menu", this.node);
        this.btn_go = xNodeFR.find("panel1/btn_go", this.node);
        this.btn_stop = xNodeFR.find("panel1/btn_stop", this.node);
        this.btn_autostop = xNodeFR.find("panel1/btn_autostop", this.node);

        this.btn_exit = xNodeFR.find("panel2/btn_exit", this.node);
        this.btn_sound = xNodeFR.find("panel2/btn_sound", this.node);
        this.btn_rule = xNodeFR.find("panel2/btn_rule", this.node);
        this.btn_close = xNodeFR.find("panel2/btn_close", this.node);

        this.tip_panel = xNodeFR.find("tip_panel", this.node);
        this.tip_panel.active = false;






        // this.node_bit = xNodeFR.find("node_bit", this.node)
        this.btn_mask = xNodeFR.find("btn_mask", this.node)
        // this.layout_auto = xNodeFR.find("layout_auto", this.node)
    }
    initBtnClick() {
        xNodeFR.addClick("", this.btn_all, this.onALLMoneyClick.bind(this));
        xNodeFR.addClick("", this.btn_bet, this.onBetClick.bind(this));
        xNodeFR.addClick("", this.btn_turbo, this.onTurboClick.bind(this));
        xNodeFR.addTouchStartClick("", this.addBtnNode, this.onAddBtnClick.bind(this));
        xNodeFR.addTouchStartClick("", this.subBtnNode, this.onSubBtnClick.bind(this));
        xNodeFR.addClick("", this.btn_auto, this.showSetAudo.bind(this));

        xNodeFR.addClick("", this.btn_stop, this.onStopRollClick.bind(this));
        xNodeFR.addClick("", this.btn_autostop, this.onStopAudoRollClick.bind(this));
        xNodeFR.addClick("", this.btn_menu, this.onMenuClick.bind(this));
        xNodeFR.addClick("", this.btn_exit, this.onBtnExit.bind(this));
        xNodeFR.addClick("", this.btn_sound, this.onSoundBtnClick.bind(this));
        xNodeFR.addClick("", this.btn_rule, this.onRuleBtnClick.bind(this));
        xNodeFR.addClick('panel2/btn_history', this.node, () => {
            FRAudioMgr.Instance.playSound('games/Click');
            this.layerCtrl.showHistory();
        });
        xNodeFR.addClick("", this.btn_close, this.onCloseBtnClick.bind(this));



        xNodeFR.addClick("qp", this.node, this.hideQipaoPanel.bind(this));
        xNodeFR.addClick("qp/an", this.node, () => FRPlatformMgr.pay(0));
        xNodeFR.addClick("qp/an1", this.node, () => FRPlatformMgr.toVip());
        if (FRGlobal.LANG == "id_ID") {
            xNodeFR.setRichText("qp/RichText", this.node, "Top up apa pun untuk mendapatkan <color=#00FF1F>VIP</color> dan buka benefit lebih tinggi");
        } else if (FRGlobal.LANG == "es_MX") {
            xNodeFR.setRichText("qp/RichText", this.node, "Recarga cualquier monto para obtener el  <color=#00FF1F>VIP</color> y desbloquear beneficios más altos.");
        } else {
            xNodeFR.setRichText("qp/RichText", this.node, "Top up any amount to become a <color=#00FF1F>VIP</color> and unlock greater benefits.");
        }

    }
    hideQipaoPanel() {
        xNodeFR.hide("qp", this.node);
    }
    showQipaoPanel() {
        xNodeFR.show("qp", this.node);
        this.unschedule(this.hideQipaoPanel);
        this.scheduleOnce(this.hideQipaoPanel, 6);
    }
    showNorTitle(bShow, state?) {

        if (bShow) {
            this.ib_bar.active = true;
            if (state == "triFree") {
                Tween.stopAllByTarget(this.ib_bar);
                this.ib_bar.children.forEach((node) => {
                    node.active = false;
                })
                this.ib_bar.getChildByName("info_bns").active = true;
            } else {
                if (this.node_win_big.active || state == "init") {
                    let list = ["info_main1", "info_main2", "info_main3"];
                    let showIdx = Math.floor(Math.random() * list.length);
                    Tween.stopAllByTarget(this.ib_bar);
                    tween(this.ib_bar)
                        .repeatForever(
                            tween().call(() => {
                                this.ib_bar.children.forEach((node) => {
                                    node.active = false;
                                })
                                this.ib_bar.getChildByName(list[showIdx]).active = true;
                                if (showIdx == 0) {
                                    let spr = xNodeFR.find(list[showIdx] + "/info_main1", this.ib_bar);
                                    spr.position = new Vec3(-270, -11, 0);
                                    Tween.stopAllByTarget(spr);
                                    tween(spr)
                                        .delay(0.5)
                                        .to(4.5, { position: new Vec3(-1270, -11, 0) })
                                        .start()
                                }

                                showIdx = showIdx + 1;
                                if (showIdx == list.length) {
                                    showIdx = 0;
                                }
                            }).delay(5)
                        )
                        .start()
                }
            }

            this.node_win_big.active = false;
        } else {
            // this.ib_bar.active = false;
            // Tween.stopAllByTarget(this.ib_bar);
        }
    }

    start() {
        this.initAttribute();
        this.initBtnClick();
        this.onTouch()
        this.updateGoBtnAnim();
        this.showNorTitle(true, "init");
        this.initTurboBtn();
        this.initSoundBtn();
    }

    updateBitView(index: number = FRGameManager.getTotalBitIndex(), bClick = false) {

        let mMultiples: number[] = FRGameManager.getTotalBitList();
        let max = mMultiples.length - 1;
        let min = 0;
        let maxBool = index >= max;
        let minBool = index <= min;
        index = Math.min(index, max);
        index = Math.max(index, min);
        xNodeFR.setBtnInteractable("", this.addBtnNode, !maxBool);
        xNodeFR.setBtnInteractable("", this.subBtnNode, !minBool);
        FRGameManager.setTotalBitIndex(index);
        // xNodeFR.setLabel("", this.lab_bit_top.node, showMoney(FRGameManager.getBitNum()*FRGameManager.getBitMult(), false));
        xNodeFR.setLabel("", this.lab_bit_bottom.node, showMoney(FRGameManager.getTotalBitNum(), false));


        if (bClick) {
            if (index == min) {
                this.showTipPanel("min_bet");
            } else if (index == max) {
                this.showTipPanel("max_bet");
            }
        }
        // this.layerCtrl.centerRollCtrl.updateBonusCntView();
    }

    setStartBit(noMoney = false) {
        if (FRGlobal.playerType == 0) {
            FRGameManager.setTotalBitIndex(0);
            this.updateBitView(0);
            return;
        }
        let gold = FRGlobal.USER.gold;

        let mMultiples: number[] = FRGameManager.getTotalBitList() || [];
        if (!mMultiples || mMultiples.length == 0) {
            return
        }
        let n: number[] = [];;
        for (let i = mMultiples.length - 1; i >= 0; i--) {
            n[i] = Math.abs(mMultiples[i] - gold * 0.01);
        }
        let min = Math.min(...n);
        let minIndex = n.findIndex(item => item == min);
        let localBet = (frframe.storage.get(`${FRConstant.GAMEID}_${FRGlobal.LEAVE}`));
        let localMult = (frframe.storage.get(`${FRConstant.GAMEID}_${FRGlobal.LEAVE}_MULT`))

        console.log("===>", localBet, localMult)
        if (!noMoney && localBet != null && localBet <= FRGameManager.getMultiples().length - 1) {
            FRGameManager.setBitIndex(Number(localBet));
            FRGameManager.setBitMultIndex(Number(localMult));
            let total = FRGameManager.getTotalBitIndexBy(Number(localBet), Number(localMult));
            FRGameManager.setTotalBitIndex(total);
            this.updateBitView(total);
        }
        else {
            FRGameManager.setTotalBitIndex(0);
            this.updateBitView(0);
        }
    }
    checkAudo(isEnd: boolean = true) {
        let stop = false;
        if (isEnd) {


            console.log("==========>>stop", stop)
        }
        xNodeFR.setLabel("lab_autoNum", this.btn_autostop, "" + FRGameManager.getAudoNum())
        xNodeFR.setActive("lab_autoNum", this.btn_autostop, FRGameManager.getAudoNum() > 0)
        if (!stop && FRGameManager.getAudoNum() > 0) {
            if (this.layerCtrl.canAffordSpin()) {
                this.scheduleOnce(() => {
                    this.onGoBtnClick();
                }, 0)
            } else {
                FRGameManager.setAudoNum(0);
                alertGame(__("Insufficient balance"))
                this.updateBtnState(true)
            }
        } else {
            if (stop) {
                this.layerCtrl.sysAutoNum = Math.max(0, FRGameManager.getAudoNum());
            }

            FRGameManager.setAudoNum(0)
            this.updateBtnState(true)
        }
    }
    updateStopBtnInteractable(isinter: boolean) {
        xNodeFR.setBtnInteractable("", this.btn_stop, isinter)
    }

    updateBtnState(isshow: boolean) {
        if (isshow) this.canSendSpin = true;
        xNodeFR.setActive("", this.btn_stop, !isshow)
        xNodeFR.setActive("", this.btn_go, isshow)
        // xNodeFR.setActive("", this.btn_auto, isshow)
        xNodeFR.setBtnInteractable("", this.subBtnNode, isshow)
        xNodeFR.setBtnInteractable("", this.addBtnNode, isshow)
        xNodeFR.setBtnInteractable("", this.btn_auto, isshow)
        xNodeFR.setBtnInteractable("", this.btn_menu, isshow)
        // xNodeFR.setBtnInteractable("", this.btn_bet, isshow)
        this.btn_bet.getComponent(Button).interactable = isshow
        this.btn_all.getComponent(Button).interactable = isshow

        // xNodeFR.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFR.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFR.setBtnInteractable("", xNodeFR.find("btn_line", this.node), isshow)
        // xNodeFR.setBtnInteractable("", xNodeFR.find("btn_rule", this.node), isshow)
        this.updateBtnAudo();
        if (isshow) this.updateBitView()
        this.updateGoBtnAnim();
    }
    updateBtnAudo() {
        let isAudo = FRGameManager.getAudoNum() > 0;
        if (isAudo) xNodeFR.hide("", this.btn_go)
        // if (isAudo) xNodeFR.hide("", this.btn_auto)
        if (isAudo) xNodeFR.hide("", this.btn_stop)
        xNodeFR.setActive("", this.btn_autostop, isAudo)
        xNodeFR.setBtnInteractable("", this.btn_autostop, isAudo)
    }

    onTouch() {
        this.btn_go.on(NodeEventType.TOUCH_START, (e) => {
            this.touchCallBack(e)
        })
        this.btn_go.on(NodeEventType.TOUCH_MOVE, (e) => {
            this.touchCallBack(e)
        })
        this.btn_go.on(NodeEventType.TOUCH_END, (e) => {
            this.touchCallBack(e)
        })
        this.btn_go.on(NodeEventType.TOUCH_CANCEL, (e) => {
            this.touchCallBack(e)
        })
    }

    touchCallBack(event: Event) {
        let guangAnim: Animation = xNodeFR.findComponent("mh_vfx_a", this.btn_go, Animation);
        switch (event.type) {
            case "touch-start":
                guangAnim.node.active = true;
                guangAnim.play();
                // this.isAutoShow = true;
                // this.scheduleOnce(this.showSetAudo, 1)
                this.isTouchGo = true;
                break;
            case "touch-move":

                break;
            case "touch-end":
                // this.isAutoShow = false;
                // this.unschedule(this.showSetAudo);
                guangAnim.node.active = false;
                // if (!this.layout_auto.active) {
                this.onGoBtnClick(true)
                // }
                this.isTouchGo = false;
                break;
            case "touch-cancel":
                // this.isAutoShow = false;
                // this.unschedule(this.showSetAudo);
                guangAnim.node.active = false;
                this.isTouchGo = false;
                break;
        }
    }
    setBtnMaskActive(isShow: boolean = false) {
        this.btn_mask.active = isShow;

        if (!isShow) {
            this.isTouchGo = false;
        }
    }

    // setAutoActive(isShow: boolean = false) {
    //     this.layout_auto.active = isShow;
    // }


    private autoPage?: AutoSpinPage;
    private betPage?: BetOptionsPage;
    private rulesPage?: RulesPage;

    showSetAudo() {
        if (this.layerCtrl.isReplay || FRGameManager.getState() !== FRSTATE.READY || !this.canSendSpin || !this.btn_go.active) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.autoPage ??= new AutoSpinPage(canvas, count => this.onAutoSelectClick(count), () => ({
            balance: showMoney(FRGlobal.USER.gold),
            bet: showMoney(FRGameManager.getTotalBitNum(), false),
        }), () => FRAudioMgr.Instance.playSound('games/Click'))).open();
    }

    playWinAni() {
        // let ani: Animation = xNodeFR.findComponent("winbgani", this.node, Animation);
        // if (isValid(ani)) {
        //     xNodeFR.show("", ani.node)
        //     ani.play();
        //     this.scheduleOnce(() => { xNodeFR.hide("", ani.node) }, 0.42)
        // }
    }
    setAwardNum(award: number, rollT = 0, bSpecial = false) {
        this.showNorTitle(false);

        if (award == 0) {
            this.lab_award_num.string = "0";
            return
        }
        let awardbefor = recovMoney(this.lab_award_num.string);
        if (awardbefor == award) return;
        let showaward = awardbefor;
        // this.playWinAni();
        Tween.stopAllByTarget(this.lab_award_num.node);
        if (rollT > 0) {
            xNodeFR.setLabelRollAni(this.lab_award_num, award, awardbefor, rollT);
            this.setBigAwardNum(award, bSpecial ? 3 : null, true);
        } else {
            this.lab_award_num.string = showMoney(award, false);
        }
    }

    setBigAwardNum(award, winType?, isFirst?) {
        if (award > 0) {
            isFirst = isFirst || !this.node_win_big.active;
            this.node_win_big.active = true;
            if (!winType) {
                let bitNum = FRGameManager.getTotalBitNum();
                winType = FRGameManager.getWinType(award, bitNum);
            }
            // FRAudioMgr.Instance.playSound("games/result1");
            if (isFirst) {
                this.node_win_big.children.forEach((node) => { node.active = false; });
                if (winType < 3) {
                    FRAudioMgr.Instance.playSound("games/Win" + (winType + 1));
                    let showBgOpa: UIOpacity = xNodeFR.findComponent("ib_bar_b", this.node_win_big, UIOpacity);
                    showBgOpa.node.active = true;
                    showBgOpa.opacity = 0;
                    tween(showBgOpa)
                        .to(0.3, { opacity: 255 }).start()
                } else {
                    FRAudioMgr.Instance.playSound("games/Notify_UI");
                    let showBgOpa: UIOpacity = xNodeFR.findComponent("ib_bar_c", this.node_win_big, UIOpacity);
                    showBgOpa.node.active = true;
                    showBgOpa.opacity = 0;
                    tween(showBgOpa)
                        .to(0.3, { opacity: 255 }).start()

                    let mw_d_anim: Animation = xNodeFR.findComponent("ib_mw_vfx_d_add", this.node_win_big, Animation);
                    mw_d_anim.node.active = true;
                    mw_d_anim.play("win_mw_d");

                    let mw_e = xNodeFR.find("ib_mw_vfx_e_add", this.node_win_big);
                    mw_e.active = true;

                    let mw_c_anim: Animation = xNodeFR.findComponent("ib_mw_vfx_c_normal_00", this.node_win_big, Animation);
                    mw_c_anim.node.active = true;
                    mw_c_anim.play("win_mw_c");

                    let mw_b_anim: Animation = xNodeFR.findComponent("ib_mw_vfx_b_add_00", this.node_win_big, Animation);
                    mw_b_anim.node.active = true;
                    mw_b_anim.play("win_mw_b");
                }
            }

            let vfx_c_Opa: UIOpacity = xNodeFR.findComponent("ib_vfx_c_add", this.node_win_big, UIOpacity);
            vfx_c_Opa.node.active = true;
            vfx_c_Opa.opacity = 0;
            tween(vfx_c_Opa)
                .to(0.3, { opacity: 255 }).start()

            if (isFirst) {
                let vfx_b_anim: Animation = xNodeFR.findComponent("ib_vfx_b_add_00", this.node_win_big, Animation);
                vfx_b_anim.node.active = true;
                vfx_b_anim.play("win_vfx_b");
            }

            let vfx_d_anim: Animation = xNodeFR.findComponent("ib_vfx_d_add_00", this.node_win_big, Animation);
            vfx_d_anim.node.active = true;
            vfx_d_anim.play("win_vfx_d");

            let vfx_a_anim: Animation = xNodeFR.findComponent("ib_vfx_a_screen", this.node_win_big, Animation);
            vfx_a_anim.node.active = true;


            let num_info = xNodeFR.find("num_info", this.node_win_big);
            num_info.active = true;
            xNodeFR.setLabel("", num_info, showMoney(award));
            tween(num_info)
                .delay(0.1)
                .to(0.2, { scale: new Vec3(1.1, 1.1) })
                .to(0.2, { scale: new Vec3(1, 1) })
                .start()

        } else {
            this.node_win_big.active = false;
        }

    }

    initTurboBtn() {
        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");
        node_off.active = true;
        node_on.active = false;
        FRGameManager.setFast(false);
    }

    /**修改速度 */
    onTurboClick() {
        FRAudioMgr.Instance.playSound("games/Click");
        // FRAudioMgr.Instance.playSound("button/MaxBetButton")

        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");

        node_off.active = !node_off.active;
        node_on.active = !node_on.active;

        this.showTipPanel(node_on.active ? "turbo_enabled" : "turbo_disabled")

        FRGameManager.setFast(node_on.active)
    }

    onAddBtnClick() {
        // FRAudioMgr.Instance.playSound("button/BetButton");
        if (FRGlobal.playerType == 0) {
            this.showQipaoPanel();
            return;
        }
        this.updateBitView(FRGameManager.getTotalBitIndex() + 1, true);
    }

    onSubBtnClick() {
        // FRAudioMgr.Instance.playSound("button/BetButton");
        this.updateBitView(FRGameManager.getTotalBitIndex() - 1, true);
    }

    async onGoBtnClick(bCLick = false) {
        if (bCLick) {
            if (FRGameManager.getWinAllMoneyR() > 0) {
                FRAudioMgr.Instance.playSound("games/Spin2")
            } else {
                FRAudioMgr.Instance.playSound("games/Spin1")
            }
        }
        this.unschedule(this.hideQipaoPanel);
        this.hideQipaoPanel();
        if (FRGameManager.getState() !== FRSTATE.READY || !this.canSendSpin || this.layerCtrl.isReplay) return;

        if (this.layerCtrl.canAffordSpin()) {
            if (!this.canSendSpin) return
            this.canSendSpin = false;

            FRAudioMgr.Instance.stopLongEffect("games/Prize_Stop");
            // 钱没滚完
            if (FRGameManager.getWinAllMoneyR() > 0 && Number(this.lab_award_num.string) * 100 != FRGameManager.getWinAllMoneyR()) {
                this.setAwardNum(FRGameManager.getWinAllMoneyR());
                this.scheduleOnce(() => {
                    this.setAwardNum(0);
                    this.showNorTitle(true);
                }, 0.2)
            } else {
                this.setAwardNum(0);
                this.showNorTitle(true);
            }
            FRGameManager.setWinAllMoneyR(0);

            const stake = this.layerCtrl.stake;
            this.layerCtrl.centerRollCtrl.startRotation();
            this.updateBtnState(false);
            FRGameManager.setState(FRSTATE.RUNING);
            void this.layerCtrl.playPaidSpin(stake);

            // 手动点击spin按钮
            if (bCLick) {
                this.playStopShow();
            }
            // await this.layerCtrl.centerRollCtrl.initLight();
        } else {
            alertGame(__("Insufficient balance"))
        }
    }

    onAutoSelectClick(custom) {
        if (custom && this.btn_go.active && this.canSendSpin && !this.layerCtrl.isReplay && FRGameManager.getState() === FRSTATE.READY) {
            FRGameManager.setAudoNum(Number(custom))
            this.checkAudo(false);
            // this.setAutoActive(false);
            this.setBtnMaskActive(false);
        }
    }

    onBtnMaskClick() {
        // let autoNode = xNodeFR.find("layout_auto", this.node);
        // if (autoNode.active == true) {
        //     autoNode.active = false;
        //     this.setBtnMaskActive(false);
        // } else {
        //     this.setBtnMaskActive(false);
        // }
    }
    onStopAudoRollClick() {
        FRAudioMgr.Instance.playSound("games/Click");
        FRGameManager.setAudoNum(0);
        xNodeFR.hide("", this.btn_autostop)
        xNodeFR.setActive("", this.btn_stop, FRGameManager.getState() != FRSTATE.READY)
        xNodeFR.setActive("", this.btn_go, FRGameManager.getState() == FRSTATE.READY)
        // xNodeFR.setActive("", this.btn_auto, FRGameManager.getState() == FRSTATE.READY)

        this.updateGoBtnAnim();
    }
    /**手动停止滚动/停止自动滚动 */
    onStopRollClick() {
        if (FRGameManager.getStop()) return
        FRAudioMgr.Instance.playSound("games/Click");
        FRGameManager.setStop(true);
        xNodeFR.find("sb_arrow_blur", this.btn_stop).active = false;
        xNodeFR.find("sb_arrow_grey", this.btn_stop).active = true;
    }
    // 播放apin按钮按下后，stop按钮动画
    playStopShow() {
        // tween(this.btn_stop)
        //     .to(0.3, { scale: new Vec3(0.9, 0.9, 1) })
        //     .to(0.3, { scale: new Vec3(1, 1, 1) })
        //     .start()

        xNodeFR.find("sb_arrow_blur", this.btn_stop).active = true;
        xNodeFR.find("sb_arrow_grey", this.btn_stop).active = false;

        let starAnim: Animation = xNodeFR.findComponent("", this.btn_stop, Animation);
        starAnim.play();

        // this.playSpinFooterAnim();
    }
    onLineBtnClick() {
        // FRAudioMgr.Instance.playSound("button/InfoButton");
        // if (this.showLineBool) FRLoadManager.ins.hideLineLayer();
        // else FRLoadManager.ins.showLineLayerWitnInit(null, this.layerCtrl.lineNode);
        // this.showLineBool = !this.showLineBool
    }

    changeFreeState(isFree: boolean = false) {
        xNodeFR.setActive("tip_panel", this.node, isFree);
        xNodeFR.setActive("lab_free", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFR.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFR.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFR.setActive("btn_stop", this.node, !isFree);
        // xNodeFR.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateBonusNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFR.setLabel("lab_bonus", this.node, lab);
    }

    changeBonusState(isFree: boolean = false) {
        xNodeFR.setActive("tip_panel", this.node, isFree);
        xNodeFR.setActive("lab_bonus", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFR.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFR.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFR.setActive("btn_stop", this.node, !isFree);
        // xNodeFR.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateFreeNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFR.setLabel("lab_free", this.node, lab);
    }

    getAwardNumPos() {
        return this.lab_award_num.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
    }

    getWinBigPos() {
        return xNodeFR.find("num_info", this.node_win_big).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
    }

    updateGoBtnAnim() {
        // let spr_spin = this.btn_go.getChildByName("spr_spin");
        // Tween.stopAllByTarget(spr_spin);

        // if (this.isTouchGo) {
        //     return;
        // }

        // spr_spin.eulerAngles = new Vec3(0, 0, 0);
        // if (this.btn_go.active) {
        //     tween(spr_spin)
        //         .repeatForever(
        //             tween().delay(2)
        //                 .call(() => {
        //                     if (this.isTouchGo) {
        //                         Tween.stopAllByTarget(spr_spin);
        //                     }
        //                 })
        //                 .by(0.5, { eulerAngles: new Vec3(0, 0, -30) })
        //                 .by(0.5, { eulerAngles: new Vec3(0, 0, 30) }, { easing: "bounceOut" })
        //                 .call(() => {
        //                     if (this.isTouchGo) {
        //                         Tween.stopAllByTarget(spr_spin);
        //                     }
        //                 })
        //         )
        //         .start()
        // }
    }



    // 刷新总钱
    setAllNum(nums: number = null) {
        Tween.stopAllByTarget(this.lab_all_money.node);
        let num = nums;
        if (!nums) {
            num = FRGlobal.USER.gold
        }
        // if (this.curAllMoney != num) {
        //     let ani: Animation = xNodeFR.findComponent("goldAni", this.node.parent, Animation);
        //     if (isValid(ani)) {
        //         xNodeFR.show("", ani.node)
        //         ani.play();
        //         this.scheduleOnce(() => {
        //             xNodeFR.hide("", ani.node)
        //         }, 0.64)
        //     }
        // }
        this.curAllMoney = num;
        this.lab_all_money.string = this.layerCtrl?.isReplay ? "******" : showMoney(num);
    }


    // playSpinFooterAnim() {
    //     this.ui_footer.getComponent(Animation).play();
    // }

    showTipPanel(type) {
        Tween.stopAllByTarget(this.tip_panel);
        this.tip_panel.active = true;
        this.tip_panel.children.forEach((node) => {
            node.active = (node.name == type);
        })
        tween(this.tip_panel)
            .to(0.3, { scale: new Vec3(1.1, 1.1, 1.1) })
            .to(0.3, { scale: new Vec3(1, 1, 1) })
            .delay(1)
            .call(() => {
                this.tip_panel.active = false;
            })
            .start()
    }

    changePanel(id) {

        let changeT = 0.08;
        if (id == 1) {
            // let footerOpa = this.ui_footer.getComponent(UIOpacity);
            // this.ui_footer.active = true;
            // footerOpa.opacity = 0;
            // tween(footerOpa)
            //     .to(changeT, { opacity: 255 }).start()
            tween(this.panel2)
                .to(changeT, { position: new Vec3(0, -320, 0) })   //  todo
                .call(() => {
                    this.panel2.active = false;
                })
                .start()

            tween(this.panel1)
                .delay(changeT)
                .call(() => {
                    this.panel1.active = true;
                    this.panel1.position = new Vec3(0, -320, 0)
                })
                .to(changeT, { position: new Vec3(0, -111, 0) })   //  todo
                .start()

        } else {
            // let footerOpa = this.ui_footer.getComponent(UIOpacity);
            // footerOpa.opacity = 255;
            // tween(footerOpa)
            //     .to(changeT, { opacity: 255 })
            //     .call(() => {
            //         this.ui_footer.active = false;
            //     })
            //     .start()
            tween(this.panel1)
                .to(changeT, { position: new Vec3(0, -320, 0) })   //  todo
                .call(() => {
                    this.panel1.active = false;
                })
                .start()

            tween(this.panel2)
                .delay(changeT)
                .call(() => {
                    this.panel2.active = true;
                    this.panel2.position = new Vec3(0, -320, 0)
                })
                .to(changeT, { position: new Vec3(0, -111, 0) })   //  todo
                .start()
        }
    }

    onMenuClick() {
        FRAudioMgr.Instance.playSound("games/Click");
        this.changePanel(2);

    }


    onBtnExit() {
        FRAudioMgr.Instance.playSound("games/Click");
        this.layerCtrl.onBtnExit();
    }



    initSoundBtn() {
        xNodeFR.find("ic_soundon", this.btn_sound).active = frframe.audio.getSwitchMusic();
        xNodeFR.find("ic_soundoff", this.btn_sound).active = !frframe.audio.getSwitchMusic();
    }

    onSoundBtnClick() {
        FRAudioMgr.Instance.playSound("games/Click");
        // FRAudioMgr.Instance.playSound("button/InfoButton");

        let ic_soundon = xNodeFR.find("ic_soundon", this.btn_sound);
        let ic_soundoff = xNodeFR.find("ic_soundoff", this.btn_sound);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        frframe.audio.setSwitchMusic(ic_soundon.active);
        frframe.audio.setSwitchEffect(ic_soundon.active);

    }


    onRuleBtnClick() {
        FRAudioMgr.Instance.playSound('games/Click');
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        void (this.rulesPage ??= new RulesPage(canvas)).open();
    }

    onCloseBtnClick() {
        FRAudioMgr.Instance.playSound("games/Click");
        this.changePanel(1);
    }

    onALLMoneyClick() {
        FRAudioMgr.Instance.playSound("games/Click");
        this.layerCtrl.popupMenuCtrl.showAllMoneyPanel();
    }

    onBetClick() {
        FRAudioMgr.Instance.playSound("games/Click");
        if (FRGlobal.playerType == 0) {
            this.showQipaoPanel();
            return;
        }
        if (this.layerCtrl.isReplay || FRGameManager.getState() !== FRSTATE.READY || !this.canSendSpin) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.betPage ??= new BetOptionsPage(canvas, () => ({
            choices: buildChoices(FRGameManager.getMultiples().map(String), FRGameManager.lineCount, FRGameManager.betLevel),
            bet: String(FRGameManager.getBitNum()),
            level: FRGameManager.getBitMultIndex() + 1,
            lines: FRGameManager.lineCount,
            balance: String(FRGlobal.USER.gold),
        }), (bet, level) => {
            const index = FRGameManager.getMultiples().indexOf(Number(bet));
            if (index < 0 || level < 1 || level > FRGameManager.betLevel) return;
            this.updateBitView(FRGameManager.getTotalBitIndexBy(index, level - 1));
            // Totals are deduplicated, but retain the base and level the player confirmed.
            FRGameManager.setBitIndex(index);
            FRGameManager.setBitMultIndex(level - 1);
        }, () => FRAudioMgr.Instance.playSound('games/Click'))).open();
    }

    recoverNormal() {
        this.panel1.active = true;
        this.panel2.active = false;
        xNodeFR.find("panel3", this.node).active = false;
    }

    initSpecialCnt(cnt) {
        if (cnt > 0) {
            this.panel1.active = false;
            this.panel2.active = false;

            xNodeFR.find("panel3", this.node).active = true;

            xNodeFR.find("panel3/rfs", this.node).active = cnt > 0;
            xNodeFR.find("panel3/lfs", this.node).active = cnt == 0;
            xNodeFR.setLabel("panel3/rfs/lab", this.node, cnt);
        }
    }

    updateSpecialCnt(cnt) {
        xNodeFR.find("panel3/rfs", this.node).active = cnt > 0;
        xNodeFR.find("panel3/lfs", this.node).active = cnt == 0;
        xNodeFR.setLabel("panel3/rfs/lab", this.node, cnt);
    }


    onDestroy() {
        this.rulesPage?.close();
        this.betPage?.destroy();
        this.autoPage?.destroy();
        super.onDestroy()

    }
}

