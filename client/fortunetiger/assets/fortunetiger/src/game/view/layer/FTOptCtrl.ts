import { BetOptionsPage } from '../../ui/bet_options_page';
import { AutoSpinPage } from '../../ui/auto_spin_page';
import { goSession } from '../../net/FTGoSession';
import { buildChoices } from '../../ui/bet_choices';
import { _decorator, Component, Node, Button, Label, Toggle, TERRAIN_HEIGHT_BASE, Tween, InstancedBuffer, Sprite, NodeEventType, tween, Color, find, Animation, isValid, sys, UITransform, Vec3, sp, UIOpacity } from 'cc';
import { ftframe } from '../../../ftframe/ftframe';

import { xNodeFT } from '../../../xtools/xNodeFT';
import { FTBaseNode } from '../../base/FTBaseNode';
import { formatStr, recovMoney, showMoney } from '../../common/FTUtils';
import { FTConstant, FTSTATE } from '../../FTConstant/FTConstant';

import FTLoadManager from '../../load/FTLoadManager';
import { FTGameManager } from '../../mgr/FTGameManager';
import { FTGame } from '../scenes/FTGame';
import { FTAudioMgr } from './FTAudioMgr';
import { FTConfigCtrl } from './FTConfigCtrl';
import { FTGameEvent } from './FTGameEvent';
import { FTGameLayerCtrl } from './FTGameLayerCtrl';
import { FTGlobal } from './FTGlobal';
import { FTLanguage } from './FTLanguage';
import FTCenterRollCtrl from './FTCenterRollCtrl';
import { FTPlatformMgr } from '../../3rd/FTPlatformMgr';
import GameBridge from '../../../../../game.bridge';
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
@ccclass('FTOptCtrl')
export class FTOptCtrl extends FTBaseNode {

    ib_bar: Node = null;    // 跑马灯滚动条
    ui_footer: Node = null; // 底下老虎须装饰图
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

    layerCtrl: FTGameLayerCtrl = null;

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
            if (FTGameManager.getState() == FTSTATE.READY) {
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

        this.ib_bar = xNodeFT.find("ib_bar", this.node);
        this.ui_footer = xNodeFT.find("ui_footer_a", this.node);
        this.node_win_big = xNodeFT.find("node_win_big", this.node);
        this.lab_all_money = xNodeFT.findComponent("node_all/lab", this.node, Label);
        this.lab_bit_bottom = xNodeFT.findComponent("node_bet/lab", this.node, Label);
        this.lab_award_num = xNodeFT.findComponent("node_win/lab", this.node, Label);
        this.btn_all = xNodeFT.find("node_all", this.node);
        this.btn_bet = xNodeFT.find("node_bet", this.node);

        this.panel1 = xNodeFT.find("panel1", this.node);
        this.panel2 = xNodeFT.find("panel2", this.node);

        this.btn_turbo = xNodeFT.find("panel1/btn_turbo", this.node);
        this.subBtnNode = xNodeFT.find("panel1/btn_sub", this.node);
        this.addBtnNode = xNodeFT.find("panel1/btn_add", this.node);
        this.btn_auto = xNodeFT.find("panel1/btn_auto_panel", this.node);
        this.btn_menu = xNodeFT.find("panel1/btn_menu", this.node);
        this.btn_go = xNodeFT.find("panel1/btn_go", this.node);
        this.btn_stop = xNodeFT.find("panel1/btn_stop", this.node);
        this.btn_autostop = xNodeFT.find("panel1/btn_autostop", this.node);

        this.btn_exit = xNodeFT.find("panel2/btn_exit", this.node);
        this.btn_sound = xNodeFT.find("panel2/btn_sound", this.node);
        this.btn_rule = xNodeFT.find("panel2/btn_rule", this.node);
        this.btn_close = xNodeFT.find("panel2/btn_close", this.node);

        this.tip_panel = xNodeFT.find("tip_panel", this.node);
        this.tip_panel.active = false;

        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FTGameLayerCtrl);




        // this.node_bit = xNodeFT.find("node_bit", this.node)
        this.btn_mask = xNodeFT.find("btn_mask", this.node)
        // this.layout_auto = xNodeFT.find("layout_auto", this.node)
    }
    initBtnClick() {
        xNodeFT.addClick("", this.btn_all, this.onALLMoneyClick.bind(this));
        xNodeFT.addClick("", this.btn_bet, this.onBetClick.bind(this));
        xNodeFT.addClick("", this.btn_turbo, this.onTurboClick.bind(this));
        xNodeFT.addClick("", this.addBtnNode, this.onAddBtnClick.bind(this));
        xNodeFT.addClick("", this.subBtnNode, this.onSubBtnClick.bind(this));
        xNodeFT.addClick("", this.btn_auto, this.showSetAudo.bind(this));
        xNodeFT.addClick("", this.btn_menu, this.onMenuClick.bind(this));

        xNodeFT.addClick("", this.btn_stop, this.onStopRollClick.bind(this));
        xNodeFT.addClick("", this.btn_autostop, this.onStopAudoRollClick.bind(this));

        xNodeFT.addClick("", this.btn_exit, this.onBtnExit.bind(this));
        xNodeFT.addClick("", this.btn_sound, this.onSoundBtnClick.bind(this));
        xNodeFT.addClick("", this.btn_rule, this.onRuleBtnClick.bind(this));
        xNodeFT.addClick("", this.btn_close, this.onCloseBtnClick.bind(this));



        xNodeFT.addClick("qp", this.node, this.hideQipaoPanel.bind(this));
        xNodeFT.addClick("qp/an", this.node, () => FTPlatformMgr.pay(0));
        xNodeFT.addClick("qp/an1", this.node, () => FTPlatformMgr.toVip());
        if (FTGlobal.LANG == "id_ID") {
            xNodeFT.setRichText("qp/RichText", this.node, "Top up apa pun untuk mendapatkan <color=#00FF1F>VIP</color> dan buka benefit lebih tinggi");
        } else if (FTGlobal.LANG == "es_MX") {
            xNodeFT.setRichText("qp/RichText", this.node, "Recarga cualquier monto para obtener el  <color=#00FF1F>VIP</color> y desbloquear beneficios más altos.");
        } else {
            xNodeFT.setRichText("qp/RichText", this.node, "Top up any amount to become a <color=#00FF1F>VIP</color> and unlock greater benefits.");
        }

    }
    hideQipaoPanel() {
        xNodeFT.hide("qp", this.node);
    }
    showQipaoPanel() {
        xNodeFT.show("qp", this.node);
        this.unschedule(this.hideQipaoPanel);
        this.scheduleOnce(this.hideQipaoPanel, 6);
    }
    initLanguageView() {
        // xNodeFT.find("btn_auto_panel", this.node).getComponent(UITransform).width = FTPlatformMgr.getLanguage() == "en" ? 100 : 180;
        // let path = FTConstant.languagePath;        
        // xNodeFT.setSpriteFrame("btn_go/spr_spin", this.node, FTLoadManager.ins.getSpriteFrame(path + "img_spin/spriteFrame"))
        // xNodeFT.setSpriteFrame("btn_stop/img_stop", this.node, FTLoadManager.ins.getSpriteFrame(path + "img_stop/spriteFrame"))
        // xNodeFT.setSpriteFrame("btn_autostop/img_stop", this.node, FTLoadManager.ins.getSpriteFrame(path + "img_stop/spriteFrame"))
        // xNodeFT.setSpriteFrame("btn_turbo", this.node, FTLoadManager.ins.getSpriteFrame(path + "btn_fast_off/spriteFrame"))
        // xNodeFT.setSpriteFrame("btn_turbo/spr_fast", this.node, FTLoadManager.ins.getSpriteFrame(path + "btn_fast_on/spriteFrame"))
        // xNodeFT.setLabel("lab_title", this.node, FTConfigCtrl.Instance.getLanguageText(FTLanguage.WIN));
        // xNodeFT.setLabel("btn_go/lab_wenzi", this.node, FTConfigCtrl.Instance.getLanguageText(FTLanguage.HOLD_FOR_AUTOSPIN));
        // xNodeFT.setLabel("btn_line/lab_title", this.node, FTConfigCtrl.Instance.getLanguageText(FTLanguage.LINES));
        // xNodeFT.setLabel("node_bit/lab_top_title", this.node, FTConfigCtrl.Instance.getLanguageText(FTLanguage.LINE_PLAY));
        // xNodeFT.setLabel("node_bit/lab_bottom_title", this.node, FTConfigCtrl.Instance.getLanguageText(FTLanguage.TOTAL_PLAY));
    }

    showNorTitle(bShow, state?) {

        this.ib_bar.active = true;
        if (bShow) {

            if (state == "triFree") {
                Tween.stopAllByTarget(this.ib_bar);
                this.ib_bar.children.forEach((node) => {
                    node.active = false;
                })
                this.ib_bar.getChildByName("info_bns").active = true;
            } else if (state > 0) {
                Tween.stopAllByTarget(this.ib_bar);
                this.ib_bar.children.forEach((node) => {
                    node.active = false;
                })
                this.ib_bar.getChildByName("layout").active = true
                let cell = this.ib_bar.getChildByName("layout").getChildByName("cell");
                cell.active = true;
                cell.children.forEach((node => {
                    node.active = false;
                }))
                cell.getChildByName(FTConstant.PRAFAB_LIST[state].node).active = true;

            } else {

                if (this.ib_bar.getChildByName("info_bns").active || this.ib_bar.getChildByName("layout").active) {
                    this.ib_bar.children.forEach((node) => {
                        node.active = false;
                    })
                    let list = ["info_main1", "info_main2", "info_main3"];
                    let showIdx = Math.floor(Math.random() * list.length);
                    // let showName = list[showIdx];
                    this.ib_bar.getChildByName(list[showIdx]).active = true;
                    tween(this.ib_bar)
                        .repeatForever(
                            tween().delay(5).call(() => {
                                this.ib_bar.getChildByName(list[showIdx]).active = false;
                                showIdx = showIdx + 1;
                                if (showIdx == list.length) {
                                    showIdx = 0;
                                }
                                this.ib_bar.getChildByName(list[showIdx]).active = true;
                            })
                        )
                        .start()
                }




            }

            this.node_win_big.active = false;
        } else {
        }



        // let lab_title = xNodeFT.find("lab_title", this.node);
        // let lab_title_nor = xNodeFT.find("lab_title_nor", this.node);

        // if (bShow) {
        //     let str = "";
        //     if (state == FTSTATE.RUNING) {
        //         str = FTLanguage.GOOD_LUCK;
        //     } else {
        //         let list = [FTLanguage.PLACE_YOUR_BETS, FTLanguage.SPIN_TO_WIN]
        //         str = list[Math.floor(Math.random() * list.length)]
        //     }

        //     lab_title.active = false;
        //     this.lab_award_num.node.active = false;
        //     lab_title_nor.active = true;
        //     xNodeFT.setLabel("", lab_title_nor, FTConfigCtrl.Instance.getLanguageText(str));
        // } else {
        //     lab_title.active = true;
        //     this.lab_award_num.node.active = true;
        //     lab_title_nor.active = false;
        // }
    }

    start() {
        this.initAttribute();
        this.initBtnClick();
        this.initLanguageView()
        this.onTouch()
        this.updateGoBtnAnim();
        this.showNorTitle(true);
        this.initTurboBtn();
        this.initSoundBtn();
    }

    updateBitView(index: number = FTGameManager.getTotalBitIndex(), bClick = false) {

        let mMultiples: number[] = FTGameManager.getTotalBitList();
        let max = mMultiples.length - 1;
        let min = 0;
        let maxBool = index >= max;
        let minBool = index <= min;
        index = Math.min(index, max);
        index = Math.max(index, min);
        xNodeFT.setBtnInteractable("", this.addBtnNode, !maxBool);
        xNodeFT.setBtnInteractable("", this.subBtnNode, !minBool);
        FTGameManager.setTotalBitIndex(index);
        // xNodeFT.setLabel("", this.lab_bit_top.node, showMoney(FTGameManager.getBitNum()*FTGameManager.getBitMult(), false));
        xNodeFT.setLabel("", this.lab_bit_bottom.node, (FTGameManager.getTotalBitNum() / 100) + "");


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

        if (FTGlobal.playerType == 0) {
            FTGameManager.setTotalBitIndex(0);
            this.updateBitView(0);
            return;
        }
        let gold = FTGlobal.USER.gold;


        let mMultiples: number[] = FTGameManager.getTotalBitList() || [];
        if (!mMultiples || mMultiples.length == 0) {
            return
        }
        let n: number[] = [];;
        for (let i = mMultiples.length - 1; i >= 0; i--) {
            n[i] = Math.abs(mMultiples[i] - gold * 0.01);
        }
        let min = Math.min(...n);
        let minIndex = n.findIndex(item => item == min);
        let localBet = Number(ftframe.storage.get(`${FTGlobal.USER.uid}_${FTConstant.GAMEID}_${FTGlobal.LEAVE}`));
        let localMult = Number(ftframe.storage.get(`${FTGlobal.USER.uid}_${FTConstant.GAMEID}_${FTGlobal.LEAVE}_MULT`)) || 0;

        if (localBet > 0 && localBet <= FTGameManager.getMultiples().length && localMult > 0 && localMult <= FTGameManager.getMultIndexs().length) {
            localBet--;
            localMult--;
            FTGameManager.setBitIndex(localBet);
            FTGameManager.setBitMultIndex(localMult);
            let total = FTGameManager.getTotalBitIndexBy(localBet, localMult);
            FTGameManager.setTotalBitIndex(total);
            this.updateBitView(total);
        }
        else {
            const policy = goSession.entry?.live?.policy;
            const preferred = policy ? mMultiples.indexOf(Number(policy.defaultBet) * policy.lineCount) : 0;
            const index = Math.max(0, preferred);
            FTGameManager.setTotalBitIndex(index);
            this.updateBitView(index);
        }
    }
    async checkAudo(isEnd: boolean = true) {
        let stop = false;
        if (isEnd) {


            console.log("==========>>stop", stop)
        }
        xNodeFT.setLabel("lab_autoNum", this.btn_autostop, "" + FTGameManager.getAudoNum())
        xNodeFT.setActive("lab_autoNum", this.btn_autostop, FTGameManager.getAudoNum() > 0)
        if (!stop && FTGameManager.getAudoNum() > 0) {
            if (FTGameManager.canPlay()) {
                this.scheduleOnce(() => {
                    this.onGoBtnClick();
                }, 0)
            } else {
                FTGameManager.setAudoNum(0);
                FTLoadManager.ins.showAlertWithInit('余额不足，请充值后再试。', () => {});
                this.updateBtnState(true)
            }
        } else {
            if (stop) {
                this.layerCtrl.sysAutoNum = Math.max(0, FTGameManager.getAudoNum());
            }

            FTGameManager.setAudoNum(0)
            this.updateBtnState(true)
        }
    }
    updateStopBtnInteractable(isinter: boolean) {
        xNodeFT.setBtnInteractable("", this.btn_stop, isinter)
    }

    updateBtnState(isshow: boolean) {
        if (isshow) this.canSendSpin = true;
        xNodeFT.setActive("", this.btn_stop, !isshow)
        xNodeFT.setActive("", this.btn_go, isshow)
        // xNodeFT.setActive("", this.btn_auto, isshow)
        xNodeFT.setBtnInteractable("", this.subBtnNode, isshow)
        xNodeFT.setBtnInteractable("", this.addBtnNode, isshow)
        xNodeFT.setBtnInteractable("", this.btn_auto, isshow)
        xNodeFT.setBtnInteractable("", this.btn_menu, isshow)
        // xNodeFT.setBtnInteractable("", this.btn_bet, isshow)
        this.btn_bet.getComponent(Button).interactable = isshow

        // xNodeFT.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFT.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFT.setBtnInteractable("", xNodeFT.find("btn_line", this.node), isshow)
        // xNodeFT.setBtnInteractable("", xNodeFT.find("btn_rule", this.node), isshow)
        this.updateBtnAudo();
        if (isshow) this.updateBitView()
        this.layerCtrl.setRealSwitchInteractable(isshow);
        this.updateGoBtnAnim();
    }
    updateBtnAudo() {
        let isAudo = FTGameManager.getAudoNum() > 0;
        if (isAudo) xNodeFT.hide("", this.btn_go)
        // if (isAudo) xNodeFT.hide("", this.btn_auto)
        if (isAudo) xNodeFT.hide("", this.btn_stop)
        xNodeFT.setActive("", this.btn_autostop, isAudo)
        xNodeFT.setBtnInteractable("", this.btn_autostop, isAudo)
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
        let guangAnim: Animation = xNodeFT.findComponent("mh_vfx_a", this.btn_go, Animation);
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


    showSetAudo() {
        if (/*this.isAutoShow &&*/ this.btn_go.active) {
            // FTAudioMgr.Instance.playSound("games/AutoGameButton");
            // this.setAutoActive(true);
            // this.setBtnMaskActive(true);

            const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
            if (!canvas) return;
            (this.autoPage ??= new AutoSpinPage(canvas, count => this.onAutoSelectClick(count), () => ({
                bet: showMoney(FTGameManager.getTotalBitNum(), false), balance: showMoney(FTGlobal.USER.gold),
            }), () => FTAudioMgr.Instance.playSound('games/list_item_click'))).open();
        }
    }


    playWinAni() {
        // let ani: Animation = xNodeFT.findComponent("winbgani", this.node, Animation);
        // if (isValid(ani)) {
        //     xNodeFT.show("", ani.node)
        //     ani.play();
        //     this.scheduleOnce(() => { xNodeFT.hide("", ani.node) }, 0.42)
        // }
    }
    setAwardNum(award: number, rollT = 0) {
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
            xNodeFT.setLabelRollAni(this.lab_award_num, award, awardbefor, rollT);
            this.setBigAwardNum(award);
        } else {
            this.lab_award_num.string = showMoney(award, false);
        }
    }

    setBigAwardNum(award, winType?) {
        if (award > 0) {
            this.node_win_big.active = true;
            this.node_win_big.children.forEach((node) => { node.active = false; })
            let bitNum = FTGameManager.getTotalBitNum()
            if (!winType) {
                winType = FTGameManager.getWinType(award, bitNum);
            }

            FTAudioMgr.Instance.playSound("games/result1");
            let showBg;
            if (winType == 1) {
                showBg = xNodeFT.find("ib_bar_a", this.node_win_big);
                // xNodeFT.find("ib_vfx_b_screen_00", this.node_win_big).active = true;


                let anim1: Animation = xNodeFT.findComponent("ib_vfx_b_screen_00", this.node_win_big, Animation);
                anim1.node.active = true;
                anim1.play();

                let anim2: Animation = xNodeFT.findComponent("ib_vfx_c_add_00", showBg, Animation);
                anim2.node.active = true;
                anim2.play();
            } else if (winType == 2) {
                showBg = xNodeFT.find("ib_bar_b", this.node_win_big);
                // xNodeFT.find("ib_vfx_a_screen_00", this.node_win_big).active = true;

                let anim1: Animation = xNodeFT.findComponent("ib_vfx_a_add_00", this.node_win_big, Animation);
                anim1.node.active = true;
                anim1.play();

                let anim2: Animation = xNodeFT.findComponent("ib_vfx_c_add_02_00", showBg, Animation);
                anim2.node.active = true;
                anim2.play();
            } else if (winType == 3) {
                showBg = xNodeFT.find("ib_bar_c", this.node_win_big);
                // xNodeFT.find("ib_vfx_e_screen_00", this.node_win_big).active = true;

                // let anim1: Animation = xNodeFT.findComponent("ib_vfx_e_add_00", this.node_win_big, Animation);
                // anim1.node.active = true;
                // anim1.play();

                let anim2: Animation = xNodeFT.findComponent("ib_vfx_c_add_03_00", showBg, Animation);
                anim2.node.active = true;
                anim2.play();
            }

            let anim1: Animation = xNodeFT.findComponent("ib_vfx_e_add_00", this.node_win_big, Animation);
            anim1.node.active = true;
            anim1.play();

            showBg.active = true;
            tween(showBg)
                .to(0.2, { scale: new Vec3(1.1, 1.1) })
                .to(0.2, { scale: new Vec3(1, 1) })
                .start()

            let diGuangOpa: UIOpacity = xNodeFT.findComponent("ib_vfx_d_add", this.node_win_big, UIOpacity);
            diGuangOpa.node.active = true;
            diGuangOpa.opacity = 255;
            tween(diGuangOpa)
                .to(0.4, { opacity: 0 })
                .start()

            let num_info = xNodeFT.find("num_info", this.node_win_big);
            num_info.active = true;
            xNodeFT.setLabel("", num_info, showMoney(award));
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
        FTGameManager.setFast(false);
    }

    /**修改速度 */
    onTurboClick() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        // FTAudioMgr.Instance.playSound("button/MaxBetButton")

        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");

        node_off.active = !node_off.active;
        node_on.active = !node_on.active;

        this.showTipPanel(node_on.active ? "turbo_enabled" : "turbo_disabled")

        // let spr_fast = this.btn_turbo.getChildByName("spr_fast");
        // spr_fast.active = !spr_fast.active;
        // // xNodeFT.findComponent("Label", this.btn_turbo, Label).Color = 
        // let lab = this.btn_turbo.getChildByName("Label");
        // lab.getComponent(Label).color = spr_fast.active ? new Color(255, 255, 255, 255) : new Color(94, 94, 94, 255)

        // if (spr_fast.active) {
        //     tween(lab).repeatForever(tween().to(0.5, { scale: new Vec3(1.1, 1.1, 1.1) }).to(0.5, { scale: new Vec3(1, 1, 1) })).start()
        // } else {
        //     Tween.stopAllByTarget(lab);
        //     lab.scale = new Vec3(1, 1, 1);
        // }

        FTGameManager.setFast(node_on.active)
    }

    onAddBtnClick() {
        // FTAudioMgr.Instance.playSound("button/BetButton");
        if (FTGlobal.playerType == 0) {
            this.showQipaoPanel();
            return;
        }
        this.updateBitView(FTGameManager.getTotalBitIndex() + 1, true);
    }

    onSubBtnClick() {
        // FTAudioMgr.Instance.playSound("button/BetButton");
        this.updateBitView(FTGameManager.getTotalBitIndex() - 1, true);
    }

    async onGoBtnClick(bCLick = false) {
        if (this.layerCtrl.isReplay) return;
        FTAudioMgr.Instance.playSound("games/spin")
        this.unschedule(this.hideQipaoPanel);
        this.hideQipaoPanel();
        if (FTGameManager.getState() != FTSTATE.READY) return
        if (FTGameManager.canPlay()) {
            if (!this.canSendSpin) return
            this.canSendSpin = false;

            FTAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_end");
            // 钱没滚完
            if (FTGameManager.getWinAllMoneyR() > 0 && Number(this.lab_award_num.string) * 100 != FTGameManager.getWinAllMoneyR()) {
                FTAudioMgr.Instance.stopLongEffect("games/rolling");
                // FTAudioMgr.Instance.playSound("games/rolling_end");
                this.setAwardNum(FTGameManager.getWinAllMoneyR());
                this.scheduleOnce(() => {
                    this.setAwardNum(0);
                    this.showNorTitle(true);
                }, 0.2)
            } else {
                this.setAwardNum(0);
                this.showNorTitle(true);
            }
            FTGameManager.setWinAllMoneyR(0);

            ftframe.storage.set(`${FTGlobal.USER.uid}_${FTConstant.GAMEID}_${FTGlobal.LEAVE}`, FTGameManager.getBitIndex() + 1)
            ftframe.storage.set(`${FTGlobal.USER.uid}_${FTConstant.GAMEID}_${FTGlobal.LEAVE}_MULT`, FTGameManager.getBitMultIndex() + 1)
            this.layerCtrl.centerRollCtrl.startRotation();
            // this.scheduleOnce(() => { this.updateBtnState(false); }, 0)
            this.updateBtnState(false);
            FTGameManager.setState(FTSTATE.RUNING);
            void this.layerCtrl.requestGoAward(FTGameManager.getBitIndex(), FTGameManager.getBitMultIndex());


            // 手动点击spin按钮
            if (bCLick) {
                this.playStopShow();
            }
            // await this.layerCtrl.centerRollCtrl.initLight();
        } else {
            FTLoadManager.ins.showAlertWithInit("余额不足，请充值后再试。", () => {});
        }
    }

    onAutoSelectClick(custom) {
        if (custom && this.btn_go.active) {
            FTGameManager.setAudoNum(Number(custom))
            this.checkAudo(false);
            // this.setAutoActive(false);
            this.setBtnMaskActive(false);
        }
    }

    onBtnMaskClick() {
        // let autoNode = xNodeFT.find("layout_auto", this.node);
        // if (autoNode.active == true) {
        //     autoNode.active = false;
        //     this.setBtnMaskActive(false);
        // } else {
        //     this.setBtnMaskActive(false);
        // }
    }
    onStopAudoRollClick() {
        FTAudioMgr.Instance.playSound("games/stop");
        // FTAudioMgr.Instance.playSound("button/InfoButton");
        FTGameManager.setAudoNum(0);
        xNodeFT.hide("", this.btn_autostop)
        xNodeFT.setActive("", this.btn_stop, FTGameManager.getState() != FTSTATE.READY)
        xNodeFT.setActive("", this.btn_go, FTGameManager.getState() == FTSTATE.READY)
        // xNodeFT.setActive("", this.btn_auto, FTGameManager.getState() == FTSTATE.READY)

        this.updateGoBtnAnim();
    }
    /**手动停止滚动/停止自动滚动 */
    onStopRollClick() {
        if (FTGameManager.getStop()) return
        FTAudioMgr.Instance.playSound("games/stop");
        FTGameManager.setStop(true);
        xNodeFT.find("sb_arrow_blur", this.btn_stop).active = false;
        xNodeFT.find("sb_arrow_grey", this.btn_stop).active = true;
    }
    // 播放apin按钮按下后，stop按钮动画
    playStopShow() {
        tween(this.btn_stop)
            .to(0.3, { scale: new Vec3(0.9, 0.9, 1) })
            .to(0.3, { scale: new Vec3(1, 1, 1) })
            .start()

        xNodeFT.find("sb_arrow_blur", this.btn_stop).active = true;
        xNodeFT.find("sb_arrow_grey", this.btn_stop).active = false;

        let starAnim: Animation = xNodeFT.findComponent("spin_click_star", this.btn_stop, Animation);
        starAnim.node.active = true;
        starAnim.play();

        this.playSpinFooterAnim();
    }
    onLineBtnClick() {
        // FTAudioMgr.Instance.playSound("button/InfoButton");
        // if (this.showLineBool) FTLoadManager.ins.hideLineLayer();
        // else FTLoadManager.ins.showLineLayerWitnInit(null, this.layerCtrl.lineNode);
        // this.showLineBool = !this.showLineBool
    }

    changeFreeState(isFree: boolean = false) {
        xNodeFT.setActive("tip_panel", this.node, isFree);
        xNodeFT.setActive("lab_free", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFT.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFT.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFT.setActive("btn_stop", this.node, !isFree);
        // xNodeFT.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateBonusNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFT.setLabel("lab_bonus", this.node, lab);
    }

    changeBonusState(isFree: boolean = false) {
        xNodeFT.setActive("tip_panel", this.node, isFree);
        xNodeFT.setActive("lab_bonus", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFT.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFT.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFT.setActive("btn_stop", this.node, !isFree);
        // xNodeFT.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateFreeNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFT.setLabel("lab_free", this.node, lab);
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
    setAllNum(nums: number = null) {
        Tween.stopAllByTarget(this.lab_all_money.node);
        let num = nums;
        if (!nums) {
            num = FTGlobal.USER.gold
            if (FTGlobal.MODE == "fun") {
                num = FTGlobal.USER.experienceGold
            };
        }
        // if (this.curAllMoney != num) {
        //     let ani: Animation = xNodeFT.findComponent("goldAni", this.node.parent, Animation);
        //     if (isValid(ani)) {
        //         xNodeFT.show("", ani.node)
        //         ani.play();
        //         this.scheduleOnce(() => {
        //             xNodeFT.hide("", ani.node)
        //         }, 0.64)
        //     }
        // }
        this.curAllMoney = num;
        this.lab_all_money.string = showMoney(num)
    }


    playSpinFooterAnim() {
        this.ui_footer.getComponent(Animation).play();
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
            let footerOpa = this.ui_footer.getComponent(UIOpacity);
            this.ui_footer.active = true;
            footerOpa.opacity = 0;
            tween(footerOpa)
                .to(changeT, { opacity: 255 }).start()
            tween(this.panel2)
                .to(changeT, { position: new Vec3(0, -320, 0) })   //  todo
                .call(() => {
                    this.panel2.active = false;
                })
                .start()

            this.panel1.position = new Vec3(0, -320, 0);
            this.panel1.active = true;
            tween(this.panel1)
                .delay(changeT)
                .to(changeT, { position: new Vec3(0, -111, 0) })   //  todo
                .start()

        } else {
            let footerOpa = this.ui_footer.getComponent(UIOpacity);
            footerOpa.opacity = 255;
            tween(footerOpa)
                .to(changeT, { opacity: 255 })
                .call(() => {
                    this.ui_footer.active = false;
                })
                .start()
            tween(this.panel1)
                .to(changeT, { position: new Vec3(0, -320, 0) })   //  todo
                .call(() => {
                    this.panel1.active = false;
                })
                .start()

            this.panel2.position = new Vec3(0, -320, 0);
            this.panel2.active = true;
            tween(this.panel2)
                .delay(changeT)
                .to(changeT, { position: new Vec3(0, -111, 0) })   //  todo
                .start()
        }
    }

    onMenuClick() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        this.changePanel(2);
    }


    onBtnExit() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        if (FTGameManager.getState() == FTSTATE.READY) {
            this.layerCtrl.onBtnExit()
        } else {
            let content = FTConfigCtrl.Instance.getLanguageText(FTLanguage.GAME_IS_NOT_END)
            FTLoadManager.ins.showAlertWithInit(content, () => { }, () => { },)
            return
        }
    }



    initSoundBtn() {
        xNodeFT.find("ic_soundon", this.btn_sound).active = ftframe.audio.getSwitchMusic();
        xNodeFT.find("ic_soundoff", this.btn_sound).active = !ftframe.audio.getSwitchMusic();
    }

    onSoundBtnClick() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        // FTAudioMgr.Instance.playSound("button/InfoButton");

        let ic_soundon = xNodeFT.find("ic_soundon", this.btn_sound);
        let ic_soundoff = xNodeFT.find("ic_soundoff", this.btn_sound);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        ftframe.audio.setSwitchMusic(ic_soundon.active);
        ftframe.audio.setSwitchEffect(ic_soundon.active);

    }


    onRuleBtnClick() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        // FTAudioMgr.Instance.playSound("button/InfoButton")
        this.layerCtrl.popupMenuCtrl.showRulePanel();
        // FTLoadManager.ins.showPrefabWithLoading("res/load/prefab/layer/RuleLayer", xNodeFT.find("Canvas"))
    }

    onCloseBtnClick() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        this.changePanel(1);
    }

    onALLMoneyClick() {
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        this.layerCtrl.popupMenuCtrl.showAllMoneyPanel();
    }

    private betPage?: BetOptionsPage;
    private autoPage?: AutoSpinPage;

    onBetClick() {
        if (this.layerCtrl.isReplay || FTGameManager.getState() !== FTSTATE.READY) return;
        FTAudioMgr.Instance.playSound("games/menu_icon_press");
        if (FTGlobal.playerType == 0) {
            this.showQipaoPanel();
            return;
        }
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        if (!canvas) return;
        (this.betPage ??= new BetOptionsPage(canvas, () => ({
            choices: buildChoices(FTGameManager.getMultiples().map(String), 5, FTGameManager.getMultIndexs().length),
            bet: String(FTGameManager.getBitNum()), level: FTGameManager.getBitMultIndex() + 1,
            lines: 5, balance: String(FTGlobal.USER.gold),
        }), (bet, level) => {
            const index = FTGameManager.getMultiples().indexOf(Number(bet));
            if (index < 0) return;
            FTGameManager.setBitIndex(index);
            FTGameManager.setBitMultIndex(level - 1);
            this.updateBitView(FTGameManager.getTotalBitIndexBy(index, level - 1));
        }, () => FTAudioMgr.Instance.playSound('games/list_item_click'))).open();
    }




    onDestroy() {
        this.betPage?.destroy();
        this.autoPage?.close();
        super.destroy()

    }
}

