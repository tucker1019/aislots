import { alertGame } from '../../net/FMGameUI';
import { AutoSpinPage } from '../../ui/auto_spin_page';
import { BetOptionsPage } from '../../ui/bet_options_page';
import { buildChoices } from '../../ui/bet_choices';
import { RulesPage } from '../../ui/rules_page';
import { _decorator, Component, Node, Button, Label, Toggle, TERRAIN_HEIGHT_BASE, Tween, InstancedBuffer, Sprite, NodeEventType, tween, Color, find, Animation, isValid, sys, UITransform, Vec3, sp, UIOpacity } from 'cc';
import { fmframe } from '../../../fmframe/fmframe';

import { xNodeFM } from '../../../xtools/xNodeFM';
import { FMBaseNode } from '../../base/FMBaseNode';
import { __, formatStr, recovMoney, showMoney } from '../../common/FMUtils';
import { FMConstant, FMSTATE } from '../../FMConstant/FMConstant';

import FMLoadManager from '../../load/FMLoadManager';
import { FMGameManager } from '../../mgr/FMGameManager';
import { FMGame } from '../scenes/FMGame';
import { FMAudioMgr } from './FMAudioMgr';
import { FMConfigCtrl } from './FMConfigCtrl';
import { FMGameEvent } from './FMGameEvent';
import { FMGameLayerCtrl } from './FMGameLayerCtrl';
import { FMGlobal } from './FMGlobal';
import { FMSpriteCtrl } from './FMSpriteCtrl';
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
@ccclass('FMOptCtrl')
export class FMOptCtrl extends FMBaseNode {

    @property(Node)
    ib_bar: Node = null;    // 跑马灯滚动条
    // ui_footer: Node = null; // 底下老虎须装饰图

    @property(Node)
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
    btn_menu: Node = null;      // 菜单
    btn_go: Node = null;        // 旋转 
    btn_stop: Node = null;      // 停止
    btn_autostop: Node = null;  // 停止自动

    btn_exit: Node = null;      // 退出按钮
    btn_sound: Node = null;     // 音量
    btn_rule: Node = null;      // 规则 
    btn_close: Node = null;     // 关闭panel2

    tip_panel: Node = null;  // 提示条&&赢分条

    curAllMoney: number = 0; // 当前玩家总钱

    layerCtrl: FMGameLayerCtrl = null;

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
            if (FMGameManager.getState() == FMSTATE.READY) {
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

        // this.ib_bar = xNodeFM.find("ib_bar", this.node);
        // this.ui_footer = xNodeFM.find("ui_footer_a", this.node);
        // this.node_win_big = xNodeFM.find("node_win_big", this.node);
        this.lab_all_money = xNodeFM.findComponent("node_all/lab", this.node, Label);
        this.lab_bit_bottom = xNodeFM.findComponent("node_bet/lab", this.node, Label);
        this.lab_award_num = xNodeFM.findComponent("node_win/lab", this.node, Label);
        this.btn_all = xNodeFM.find("node_all", this.node);
        this.btn_bet = xNodeFM.find("node_bet", this.node);

        this.panel1 = xNodeFM.find("panel1", this.node);
        this.panel2 = xNodeFM.find("panel2", this.node);

        this.btn_turbo = xNodeFM.find("panel1/btn_turbo", this.node);
        this.subBtnNode = xNodeFM.find("panel1/btn_sub", this.node);
        this.addBtnNode = xNodeFM.find("panel1/btn_add", this.node);
        this.btn_auto = xNodeFM.find("panel1/btn_auto_panel", this.node);
        this.btn_menu = xNodeFM.find("panel1/btn_menu", this.node);
        this.btn_go = xNodeFM.find("panel1/btn_go", this.node);
        this.btn_stop = xNodeFM.find("panel1/btn_stop", this.node);
        this.btn_autostop = xNodeFM.find("panel1/btn_autostop", this.node);

        this.btn_exit = xNodeFM.find("panel2/btn_exit", this.node);
        this.btn_sound = xNodeFM.find("panel2/btn_sound", this.node);
        this.btn_rule = xNodeFM.find("panel2/btn_rule", this.node);
        this.btn_close = xNodeFM.find("panel2/btn_close", this.node);

        this.tip_panel = xNodeFM.find("tip_panel", this.node);
        this.tip_panel.active = false;

        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FMGameLayerCtrl);




        // this.node_bit = xNodeFM.find("node_bit", this.node)
        this.btn_mask = xNodeFM.find("btn_mask", this.node)
        // this.layout_auto = xNodeFM.find("layout_auto", this.node)
    }
    initBtnClick() {
        xNodeFM.addClick("", this.btn_all, this.onALLMoneyClick.bind(this));
        xNodeFM.addClick("", this.btn_bet, this.onBetClick.bind(this));
        xNodeFM.addClick("", this.btn_turbo, this.onTurboClick.bind(this));
        xNodeFM.addTouchStartClick("", this.addBtnNode, this.onAddBtnClick.bind(this));
        xNodeFM.addTouchStartClick("", this.subBtnNode, this.onSubBtnClick.bind(this));
        xNodeFM.addClick("", this.btn_auto, this.showSetAudo.bind(this));
        xNodeFM.addClick("", this.btn_menu, this.onMenuClick.bind(this));

        xNodeFM.addClick("", this.btn_stop, this.onStopRollClick.bind(this));
        xNodeFM.addClick("", this.btn_autostop, this.onStopAudoRollClick.bind(this));

        xNodeFM.addClick("", this.btn_exit, this.onBtnExit.bind(this));
        xNodeFM.addClick("", this.btn_sound, this.onSoundBtnClick.bind(this));
        xNodeFM.addClick("", this.btn_rule, this.onRuleBtnClick.bind(this));
        xNodeFM.addClick("panel2/btn_history", this.node, () => {
            FMAudioMgr.Instance.playSound("games/menu_icon_press");
            this.layerCtrl.showHistory();
        });
        xNodeFM.addClick("", this.btn_close, this.onCloseBtnClick.bind(this));
        xNodeFM.addClick("qp", this.node, this.hideQipaoPanel.bind(this));
        if (FMGlobal.LANG == "id_ID") {
            xNodeFM.setRichText("qp/RichText", this.node, "Top up apa pun untuk mendapatkan <color=#00FF1F>VIP</color> dan buka benefit lebih tinggi");
        } else if (FMGlobal.LANG == "es_MX") {
            xNodeFM.setRichText("qp/RichText", this.node, "Recarga cualquier monto para obtener el  <color=#00FF1F>VIP</color> y desbloquear beneficios más altos.");
        } else {
            xNodeFM.setRichText("qp/RichText", this.node, "Top up any amount to become a <color=#00FF1F>VIP</color> and unlock greater benefits.");
        }
    }
    hideQipaoPanel() {
        xNodeFM.hide("qp", this.node);
    }

    showNorTitle(bShow, state?) {

        if (bShow) {
            this.ib_bar.active = true;
            let info_main = xNodeFM.find("mask/info_main", this.ib_bar);

            let playInfoMainAnim = () => {
                Tween.stopAllByTarget(info_main);
                let maskW = xNodeFM.find("mask", this.ib_bar).getComponent(UITransform).contentSize.width;
                let infoW = info_main.getComponent(UITransform).contentSize.width;
                if (infoW > maskW) {
                    info_main.position = new Vec3((infoW - maskW) / 2 + 30, info_main.position.y);
                    tween(info_main)
                        .delay(0.5)
                        .to(4.4, { position: new Vec3(-(maskW + infoW) / 2 - 5, info_main.position.y, 0) })
                        .start()
                } else {
                    info_main.position = new Vec3(0, info_main.position.y, 0);
                }
            }

            if (state == "triFree") {
                Tween.stopAllByTarget(this.ib_bar);
                info_main.getComponent(FMSpriteCtrl).setSpriteIndex(2);
                playInfoMainAnim();
            } else {
                if (state == "init" || this.node_win_big.active) {
                    let list = [0, 1];
                    let showIdx = Math.floor(Math.random() * list.length);
                    Tween.stopAllByTarget(this.ib_bar);
                    tween(this.ib_bar)
                        .repeatForever(
                            tween().call(() => {
                                Tween.stopAllByTarget(info_main);
                                info_main.getComponent(FMSpriteCtrl).setSpriteIndex(showIdx);
                                showIdx = showIdx + 1;
                                if (showIdx == list.length) {
                                    showIdx = 0;
                                }
                                playInfoMainAnim();
                            }).delay(5)
                        )
                        .start()
                    info_main.getComponent(FMSpriteCtrl).setSpriteIndex(showIdx);
                }
            }

            this.node_win_big.active = false;
        } else {
            this.ib_bar.active = false;
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

    updateBitView(index: number = FMGameManager.getTotalBitIndex(), bClick = false) {

        let mMultiples: number[] = FMGameManager.getTotalBitList();
        let max = mMultiples.length - 1;
        let min = 0;
        let maxBool = index >= max;
        let minBool = index <= min;
        index = Math.min(index, max);
        index = Math.max(index, min);
        xNodeFM.setBtnInteractable("", this.addBtnNode, !maxBool);
        xNodeFM.setBtnInteractable("", this.subBtnNode, !minBool);
        FMGameManager.setTotalBitIndex(index);
        // xNodeFM.setLabel("", this.lab_bit_top.node, showMoney(FMGameManager.getBitNum()*FMGameManager.getBitMult(), false));
        xNodeFM.setLabel("", this.lab_bit_bottom.node, showMoney(FMGameManager.visualStake ?? FMGameManager.getTotalBitNum(), false));


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
        if (FMGlobal.playerType == 0) {
            FMGameManager.setTotalBitIndex(0);
            this.updateBitView(0);
            return;
        }
        let gold = FMGlobal.USER.gold;


        let mMultiples: number[] = FMGameManager.getTotalBitList() || [];
        if (!mMultiples || mMultiples.length == 0) {
            return
        }
        let n: number[] = [];;
        for (let i = mMultiples.length - 1; i >= 0; i--) {
            n[i] = Math.abs(mMultiples[i] - gold * 0.01);
        }
        let min = Math.min(...n);
        let minIndex = n.findIndex(item => item == min);
        let localBet = (fmframe.storage.get(`${FMConstant.GAMEID}_${FMGlobal.LEAVE}`));
        let localMult = (fmframe.storage.get(`${FMConstant.GAMEID}_${FMGlobal.LEAVE}_MULT`))

        if (!noMoney && localBet != null && localBet <= FMGameManager.getMultiples().length - 1) {
            FMGameManager.setBitIndex(Number(localBet));
            FMGameManager.setBitMultIndex(Number(localMult));
            let total = FMGameManager.getTotalBitIndexBy(Number(localBet), Number(localMult));
            FMGameManager.setTotalBitIndex(total);
            this.updateBitView(total);
        }
        else {
            FMGameManager.setTotalBitIndex(0);
            this.updateBitView(0);
        }
    }
    checkAudo(isEnd: boolean = true) {
        let stop = false;
        if (isEnd) {

        }
        xNodeFM.setLabel("lab_autoNum", this.btn_autostop, "" + FMGameManager.getAudoNum())
        xNodeFM.setActive("lab_autoNum", this.btn_autostop, FMGameManager.getAudoNum() > 0)
        if (!stop && FMGameManager.getAudoNum() > 0) {
            if (FMGameManager.canPlay()) {
                this.scheduleOnce(() => {
                    this.onGoBtnClick();
                }, 0)
            } else {
                FMGameManager.setAudoNum(0);
                alertGame("余额不足，请充值后再试。");
                this.updateBtnState(true)
            }
        } else {
            if (stop) {
                this.layerCtrl.sysAutoNum = Math.max(0, FMGameManager.getAudoNum());
            }

            FMGameManager.setAudoNum(0)
            this.updateBtnState(true)
        }
    }
    updateStopBtnInteractable(isinter: boolean) {
        xNodeFM.setBtnInteractable("", this.btn_stop, isinter)
    }

    updateBtnState(isshow: boolean) {
        if (isshow) this.canSendSpin = true;
        xNodeFM.setActive("", this.btn_stop, !isshow)
        xNodeFM.setActive("", this.btn_go, isshow)
        // xNodeFM.setActive("", this.btn_auto, isshow)
        xNodeFM.setBtnInteractable("", this.subBtnNode, isshow)
        xNodeFM.setBtnInteractable("", this.addBtnNode, isshow)
        xNodeFM.setBtnInteractable("", this.btn_auto, isshow)
        xNodeFM.setBtnInteractable("", this.btn_menu, isshow)
        // xNodeFM.setBtnInteractable("", this.btn_bet, isshow)
        this.btn_bet.getComponent(Button).interactable = isshow

        // xNodeFM.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFM.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFM.setBtnInteractable("", xNodeFM.find("btn_line", this.node), isshow)
        // xNodeFM.setBtnInteractable("", xNodeFM.find("btn_rule", this.node), isshow)
        this.updateBtnAudo();
        if (isshow) this.updateBitView()
        this.updateGoBtnAnim();
    }
    updateBtnAudo() {
        let isAudo = FMGameManager.getAudoNum() > 0;
        if (isAudo) xNodeFM.hide("", this.btn_go)
        // if (isAudo) xNodeFM.hide("", this.btn_auto)
        if (isAudo) xNodeFM.hide("", this.btn_stop)
        xNodeFM.setActive("", this.btn_autostop, isAudo)
        xNodeFM.setBtnInteractable("", this.btn_autostop, isAudo)
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
        let guangAnim: Animation = xNodeFM.findComponent("mh_vfx_a", this.btn_go, Animation);
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
        if (this.layerCtrl.isReplay || FMGameManager.getState() !== FMSTATE.READY || !this.canSendSpin || !this.btn_go.active) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.autoPage ??= new AutoSpinPage(canvas, count => this.onAutoSelectClick(count), () => ({
            balance: showMoney(FMGlobal.USER.gold),
            bet: showMoney(FMGameManager.getTotalBitNum(), false),
        }), () => FMAudioMgr.Instance.playSound('games/menu_icon_press'))).open();
    }

    playWinAni() {
        // let ani: Animation = xNodeFM.findComponent("winbgani", this.node, Animation);
        // if (isValid(ani)) {
        //     xNodeFM.show("", ani.node)
        //     ani.play();
        //     this.scheduleOnce(() => { xNodeFM.hide("", ani.node) }, 0.42)
        // }
    }
    setAwardNum(award: number, rollT = 0, hasFcracker = false) {
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
            xNodeFM.setLabelRollAni(this.lab_award_num, award, awardbefor, rollT);
            this.setBigAwardNum(award, hasFcracker ? rollT : 0);
        } else {
            this.lab_award_num.string = showMoney(award, false);
        }
    }

    setBigAwardNum(award, rollT?) {
        if (award > 0) {
            this.node_win_big.active = true;
            this.node_win_big.children.forEach((node) => { node.active = false; })

            let bitNum = FMGameManager.getTotalBitNum()
            // FMAudioMgr.Instance.playSound("games/result1");

            let num_info = xNodeFM.find("num_info", this.node_win_big);
            let ib_text_glow_opa: UIOpacity = xNodeFM.findComponent("ib_text_glow", this.node_win_big, UIOpacity);
            if (rollT && rollT > 0) {
                let ib_bar_a = xNodeFM.find("ib_bar_a", this.node_win_big);
                ib_bar_a.active = true;
                ib_bar_a.scale = new Vec3(1, 1);
                tween(ib_bar_a)
                    .to(0.2, { scale: new Vec3(1.1, 1.1) })
                    .call(() => { ib_bar_a.active = false; })
                    .start()

                let ib_bar_b = xNodeFM.find("ib_bar_b", this.node_win_big);
                ib_bar_b.scale = new Vec3(1, 1);
                let anim1: Animation = xNodeFM.findComponent("ib_bar_glow_mw", ib_bar_b, Animation);
                tween(ib_bar_b)
                    .delay(0.2)
                    .call(() => {
                        ib_bar_b.active = true;
                        anim1.node.active = true;
                        anim1.play();
                    })
                    .start()

                FMAudioMgr.Instance.playLongEffect("games/prizeMedwinMain");
                num_info.active = true;
                xNodeFM.setLabelRollAni(num_info.getComponent(Label), award, 0, rollT, 0.02, () => {
                    FMAudioMgr.Instance.stopLongEffect("games/prizeMedwinMain");
                    FMAudioMgr.Instance.playSound("games/prizeMedwinEnd");
                    anim1.play();
                });

                ib_text_glow_opa.node.active = true;
                tween(ib_text_glow_opa).to(0.3, { opacity: 255 }).to(0.2, { opacity: 0 }).start()
            } else {
                let ib_bar_a = xNodeFM.find("ib_bar_a", this.node_win_big);
                ib_bar_a.active = true;
                ib_bar_a.scale = new Vec3(1, 1);
                tween(ib_bar_a).to(0.2, { scale: new Vec3(1.1, 1.1) }).to(0.2, { scale: new Vec3(1, 1) }).start()

                let anim1: Animation = xNodeFM.findComponent("ib_bar_glow_sw", ib_bar_a, Animation);
                anim1.node.active = true;
                anim1.play();

                num_info.active = true;
                xNodeFM.setLabel("", num_info, showMoney(award));
                tween(num_info).delay(0.1).to(0.2, { scale: new Vec3(1.1, 1.1) }).to(0.2, { scale: new Vec3(1, 1) }).start()

                ib_text_glow_opa.node.active = true;
                tween(ib_text_glow_opa).to(0.3, { opacity: 255 }).to(0.2, { opacity: 0 }).start()
            }
        } else {
            this.node_win_big.active = false;
        }

    }

    initTurboBtn() {
        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");
        node_off.active = true;
        node_on.active = false;
        FMGameManager.setFast(false);
    }

    /**修改速度 */
    onTurboClick() {
        FMAudioMgr.Instance.playSound("games/menu_icon_press");
        // FMAudioMgr.Instance.playSound("button/MaxBetButton")

        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");

        node_off.active = !node_off.active;
        node_on.active = !node_on.active;

        this.showTipPanel(node_on.active ? "turbo_enabled" : "turbo_disabled")

        // let spr_fast = this.btn_turbo.getChildByName("spr_fast");
        // spr_fast.active = !spr_fast.active;
        // // xNodeFM.findComponent("Label", this.btn_turbo, Label).Color = 
        // let lab = this.btn_turbo.getChildByName("Label");
        // lab.getComponent(Label).color = spr_fast.active ? new Color(255, 255, 255, 255) : new Color(94, 94, 94, 255)

        // if (spr_fast.active) {
        //     tween(lab).repeatForever(tween().to(0.5, { scale: new Vec3(1.1, 1.1, 1.1) }).to(0.5, { scale: new Vec3(1, 1, 1) })).start()
        // } else {
        //     Tween.stopAllByTarget(lab);
        //     lab.scale = new Vec3(1, 1, 1);
        // }

        FMGameManager.setFast(node_on.active)
    }

    onAddBtnClick() {
        // FMAudioMgr.Instance.playSound("button/BetButton");
        let btn: Button = xNodeFM.findComponent("", this.addBtnNode, Button)
        if (isValid(btn) && !btn.interactable) {
            return
        }
        if (FMGlobal.playerType == 0) {
            xNodeFM.show("qp", this.node);
            this.unschedule(this.hideQipaoPanel);
            this.scheduleOnce(this.hideQipaoPanel, 6);
            return;
        }
        this.updateBitView(FMGameManager.getTotalBitIndex() + 1, true);

    }

    onSubBtnClick() {
        let btn: Button = xNodeFM.findComponent("", this.addBtnNode, Button)
        if (isValid(btn) && !btn.interactable) {
            return
        }
        // FMAudioMgr.Instance.playSound("button/BetButton");
        this.updateBitView(FMGameManager.getTotalBitIndex() - 1, true);
    }

    async onGoBtnClick(clicked = false) {
        if (FMGameManager.getState() !== FMSTATE.READY || !this.canSendSpin || this.layerCtrl.isReplay) return;
        if (!this.layerCtrl.canAffordSpin()) {
            FMGameManager.setAudoNum(0);
            this.updateBtnState(true);
            alertGame('余额不足，请充值后再试。');
            return;
        }
        this.canSendSpin = false;
        FMAudioMgr.Instance.playSound('games/spinBtn');
        FMAudioMgr.Instance.stopLongEffect('games/bgmBigwinEnd');
        FMAudioMgr.Instance.stopLongEffect('games/rolling');
        this.setAwardNum(0);
        this.showNorTitle(true);
        FMGameManager.setWinAllMoneyR(0);
        const stake = this.layerCtrl.stake;
        FMGameManager.setState(FMSTATE.RUNING);
        this.layerCtrl.centerRollCtrl.startRotation();
        this.updateBtnState(false);
        if (clicked) this.playStopShow();
        await this.layerCtrl.playPaidSpin(stake);
    }

    onAutoSelectClick(custom) {
        if (custom && this.btn_go.active && this.canSendSpin && !this.layerCtrl.isReplay && FMGameManager.getState() === FMSTATE.READY) {
            FMGameManager.setAudoNum(Number(custom))
            this.checkAudo(false);
            // this.setAutoActive(false);
            this.setBtnMaskActive(false);
        }
    }

    onBtnMaskClick() {
        // let autoNode = xNodeFM.find("layout_auto", this.node);
        // if (autoNode.active == true) {
        //     autoNode.active = false;
        //     this.setBtnMaskActive(false);
        // } else {
        //     this.setBtnMaskActive(false);
        // }
    }
    onStopAudoRollClick() {
        FMAudioMgr.Instance.playSound("games/menu_icon_press");
        // FMAudioMgr.Instance.playSound("button/InfoButton");
        FMGameManager.setAudoNum(0);
        xNodeFM.hide("", this.btn_autostop)
        xNodeFM.setActive("", this.btn_stop, FMGameManager.getState() != FMSTATE.READY)
        xNodeFM.setActive("", this.btn_go, FMGameManager.getState() == FMSTATE.READY)
        // xNodeFM.setActive("", this.btn_auto, FMGameManager.getState() == FMSTATE.READY)

        this.updateGoBtnAnim();
    }
    /**手动停止滚动/停止自动滚动 */
    onStopRollClick() {
        if (FMGameManager.getStop()) return
        if (!FMGameManager.isSpecialGame()) {
            FMAudioMgr.Instance.playSound("games/menu_icon_press");
            FMGameManager.setStop(true);
        }
        xNodeFM.find("sb_arrow_blur", this.btn_stop).active = false;
        xNodeFM.find("sb_arrow_grey", this.btn_stop).active = true;
    }
    // 播放apin按钮按下后，stop按钮动画
    playStopShow() {
        tween(this.btn_stop)
            .to(0.3, { scale: new Vec3(0.9, 0.9, 1) })
            .to(0.3, { scale: new Vec3(1, 1, 1) })
            .start()

        xNodeFM.find("sb_arrow_blur", this.btn_stop).active = true;
        xNodeFM.find("sb_arrow_grey", this.btn_stop).active = false;

        let starAnim: Animation = xNodeFM.findComponent("spin_click_star", this.btn_stop, Animation);
        starAnim.node.active = true;
        starAnim.play();

        // this.playSpinFooterAnim();
    }
    onLineBtnClick() {
        // FMAudioMgr.Instance.playSound("button/InfoButton");
        // if (this.showLineBool) FMLoadManager.ins.hideLineLayer();
        // else FMLoadManager.ins.showLineLayerWitnInit(null, this.layerCtrl.lineNode);
        // this.showLineBool = !this.showLineBool
    }

    changeFreeState(isFree: boolean = false) {
        xNodeFM.setActive("tip_panel", this.node, isFree);
        xNodeFM.setActive("lab_free", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFM.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFM.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFM.setActive("btn_stop", this.node, !isFree);
        // xNodeFM.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateBonusNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFM.setLabel("lab_bonus", this.node, lab);
    }

    changeBonusState(isFree: boolean = false) {
        xNodeFM.setActive("tip_panel", this.node, isFree);
        xNodeFM.setActive("lab_bonus", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFM.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFM.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFM.setActive("btn_stop", this.node, !isFree);
        // xNodeFM.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateFreeNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFM.setLabel("lab_free", this.node, lab);
    }

    getAwardNumPos() {
        return this.lab_award_num.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
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
    setAllNum(nums?: number) {
        this.curAllMoney = nums ?? FMGlobal.USER.gold;
        this.lab_all_money.string = this.layerCtrl?.isReplay ? '******' : showMoney(this.curAllMoney);
    }

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
        FMAudioMgr.Instance.playSound("games/menu_icon_press");
        this.changePanel(2);
    }


    onBtnExit() {
        FMAudioMgr.Instance.playSound('games/menu_icon_press');
        this.layerCtrl.onBtnExit();
    }

    initSoundBtn() {
        xNodeFM.find("ic_soundon", this.btn_sound).active = fmframe.audio.getSwitchMusic();
        xNodeFM.find("ic_soundoff", this.btn_sound).active = !fmframe.audio.getSwitchMusic();
    }

    onSoundBtnClick() {
        FMAudioMgr.Instance.playSound("games/menu_icon_press");
        // FMAudioMgr.Instance.playSound("button/InfoButton");

        let ic_soundon = xNodeFM.find("ic_soundon", this.btn_sound);
        let ic_soundoff = xNodeFM.find("ic_soundoff", this.btn_sound);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        fmframe.audio.setSwitchMusic(ic_soundon.active);
        fmframe.audio.setSwitchEffect(ic_soundon.active);

    }


    onRuleBtnClick() {
        FMAudioMgr.Instance.playSound('games/menu_icon_press');
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        void (this.rulesPage ??= new RulesPage(canvas)).open();
    }

    onCloseBtnClick() {
        FMAudioMgr.Instance.playSound("games/menu_icon_press");
        this.changePanel(1);
    }

    onALLMoneyClick() {
        if (!this.layerCtrl.isReplay && FMGameManager.getState() === FMSTATE.READY) alertGame('余额：' + showMoney(FMGlobal.USER.gold));
    }

    onBetClick() {
        FMAudioMgr.Instance.playSound("games/menu_icon_press");
        if (this.layerCtrl.isReplay || FMGameManager.getState() !== FMSTATE.READY || !this.canSendSpin) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        (this.betPage ??= new BetOptionsPage(canvas, () => ({
            choices: buildChoices(FMGameManager.getMultiples().map(String), FMGameManager.lineCount, FMGameManager.betLevel),
            bet: String(FMGameManager.getBitNum()),
            level: FMGameManager.getBitMultIndex() + 1,
            lines: FMGameManager.lineCount,
            balance: String(FMGlobal.USER.gold),
        }), (bet, level) => {
            const index = FMGameManager.getMultiples().indexOf(Number(bet));
            if (index < 0 || level < 1 || level > FMGameManager.betLevel) return;
            this.updateBitView(FMGameManager.getTotalBitIndexBy(index, level - 1));
            // Totals are deduplicated, but retain the base and level the player confirmed.
            FMGameManager.setBitIndex(index);
            FMGameManager.setBitMultIndex(level - 1);
        }, () => FMAudioMgr.Instance.playSound('games/menu_icon_press'))).open();
    }

    onDestroy() {
        this.rulesPage?.close();
        this.betPage?.destroy();
        this.autoPage?.close();
        super.onDestroy();

    }
}

