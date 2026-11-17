import { RulesPage } from '../../ui/rules_page';
import { BetOptionsPage } from '../../ui/bet_options_page';
import { AutoSpinPage } from '../../ui/auto_spin_page';
import { goSession } from '../../net/FLGoSession';
import { buildChoices } from '../../ui/bet_choices';
import { _decorator, Component, Node, Button, Label, Toggle, TERRAIN_HEIGHT_BASE, Tween, InstancedBuffer, Sprite, NodeEventType, tween, Color, find, Animation, isValid, sys, UITransform, Vec3, sp, UIOpacity } from 'cc';
import { flframe } from '../../../flframe/flframe';

import { xNodeFL } from '../../../xtools/xNodeFL';
import { FLBaseNode } from '../../base/FLBaseNode';
import { formatStr, recovMoney, showMoney } from '../../common/FLUtils';
import { FLConstant, FLSTATE } from '../../FLConstant/FLConstant';

import FLLoadManager from '../../load/FLLoadManager';
import { FLGameManager } from '../../mgr/FLGameManager';
import { FLGame } from '../scenes/FLGame';
import { FLAudioMgr } from './FLAudioMgr';
import { FLConfigCtrl } from './FLConfigCtrl';
import { FLGameEvent } from './FLGameEvent';
import { FLGameLayerCtrl } from './FLGameLayerCtrl';
import { FLGlobal } from './FLGlobal';
import { FLLanguage } from './FLLanguage';
import FLCenterRollCtrl from './FLCenterRollCtrl';
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
@ccclass('FLOptCtrl')
export class FLOptCtrl extends FLBaseNode {

    ib_bar: Node = null;    // 跑马灯滚动条
    ui_footer: Node = null; // 底下老虎须装饰图
    node_win_big: Node = null;  // 玩家赢钱-大横条

    lab_all_money: Label = null;    // 玩家总钱
    lab_bit_bottom: Label = null;   // 当前押注
    lab_award_num: Label = null;    // 当前赢钱

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

    layerCtrl: FLGameLayerCtrl = null;

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
            if (FLGameManager.getState() == FLSTATE.READY) {
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

        this.ib_bar = xNodeFL.find("ib_bar", this.node);
        this.ui_footer = xNodeFL.find("ui_footer", this.node);
        this.node_win_big = xNodeFL.find("node_win_big", this.node);
        this.lab_all_money = xNodeFL.findComponent("fenzhikuang/node_all/lab", this.node, Label);
        this.lab_bit_bottom = xNodeFL.findComponent("fenzhikuang/node_bet/lab", this.node, Label);
        this.lab_award_num = xNodeFL.findComponent("fenzhikuang/node_win/lab", this.node, Label);
        this.btn_bet = xNodeFL.find("node_bet", this.node);

        this.panel1 = xNodeFL.find("panel1", this.node);
        this.panel2 = xNodeFL.find("panel2", this.node);

        this.btn_turbo = xNodeFL.find("panel1/btn_turbo", this.node);
        this.subBtnNode = xNodeFL.find("panel1/btn_sub", this.node);
        this.addBtnNode = xNodeFL.find("panel1/btn_add", this.node);
        this.btn_auto = xNodeFL.find("panel1/btn_auto_panel", this.node);
        this.btn_menu = xNodeFL.find("panel1/btn_menu", this.node);
        this.btn_go = xNodeFL.find("panel1/btn_go", this.node);
        this.btn_stop = xNodeFL.find("panel1/btn_stop", this.node);
        this.btn_autostop = xNodeFL.find("panel1/btn_autostop", this.node);

        this.btn_exit = xNodeFL.find("panel2/btn_exit", this.node);
        this.btn_sound = xNodeFL.find("panel2/btn_sound", this.node);
        this.btn_rule = xNodeFL.find("panel2/btn_rule", this.node);
        this.btn_close = xNodeFL.find("panel2/btn_close", this.node);

        this.tip_panel = xNodeFL.find("tip_panel", this.node);
        if (this.tip_panel) this.tip_panel.active = false;

        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FLGameLayerCtrl);




        // this.node_bit = xNodeFL.find("node_bit", this.node)
        this.btn_mask = xNodeFL.find("btn_mask", this.node)
        // this.layout_auto = xNodeFL.find("layout_auto", this.node)
    }
    initBtnClick() {
        xNodeFL.addClick("", this.btn_bet, this.onBetClick.bind(this));
        xNodeFL.addClick("", this.btn_turbo, this.onTurboClick.bind(this));
        xNodeFL.addClick("", this.addBtnNode, this.onAddBtnClick.bind(this));
        xNodeFL.addClick("", this.subBtnNode, this.onSubBtnClick.bind(this));
        xNodeFL.addClick("", this.btn_auto, this.showSetAudo.bind(this));
        xNodeFL.addClick("", this.btn_menu, this.onMenuClick.bind(this));

        xNodeFL.addClick("", this.btn_stop, this.onStopRollClick.bind(this));
        xNodeFL.addClick("", this.btn_autostop, this.onStopAudoRollClick.bind(this));

        xNodeFL.addClick("", this.btn_exit, this.onBtnExit.bind(this));
        xNodeFL.addClick("", this.btn_sound, this.onSoundBtnClick.bind(this));
        xNodeFL.addClick("", this.btn_rule, this.onRuleBtnClick.bind(this));
        const historyButton = this.panel2?.getChildByName('btn_history');
        if (!historyButton || !this.layerCtrl) return;
        historyButton.active = !this.layerCtrl.isReplay;
        xNodeFL.addClick('', historyButton, () => {
            FLAudioMgr.Instance.playSound('games/menu_icon_press');
            this.layerCtrl.onBtnMenu();
        });
        xNodeFL.addClick("", this.btn_close, this.onCloseBtnClick.bind(this));





    }

    initLanguageView() {
        // let path = FLConstant.languagePath;        
        // xNodeFL.setSpriteFrame("btn_go/spr_spin", this.node, FLLoadManager.ins.getSpriteFrame(path + "img_spin/spriteFrame"))
        // xNodeFL.setSpriteFrame("btn_stop/img_stop", this.node, FLLoadManager.ins.getSpriteFrame(path + "img_stop/spriteFrame"))
        // xNodeFL.setSpriteFrame("btn_autostop/img_stop", this.node, FLLoadManager.ins.getSpriteFrame(path + "img_stop/spriteFrame"))
        // xNodeFL.setSpriteFrame("btn_turbo", this.node, FLLoadManager.ins.getSpriteFrame(path + "btn_fast_off/spriteFrame"))
        // xNodeFL.setSpriteFrame("btn_turbo/spr_fast", this.node, FLLoadManager.ins.getSpriteFrame(path + "btn_fast_on/spriteFrame"))
        // xNodeFL.setLabel("lab_title", this.node, FLConfigCtrl.Instance.getLanguageText(FLLanguage.WIN));
        // xNodeFL.setLabel("btn_go/lab_wenzi", this.node, FLConfigCtrl.Instance.getLanguageText(FLLanguage.HOLD_FOR_AUTOSPIN));
        // xNodeFL.setLabel("btn_line/lab_title", this.node, FLConfigCtrl.Instance.getLanguageText(FLLanguage.LINES));
        // xNodeFL.setLabel("node_bit/lab_top_title", this.node, FLConfigCtrl.Instance.getLanguageText(FLLanguage.LINE_PLAY));
        // xNodeFL.setLabel("node_bit/lab_bottom_title", this.node, FLConfigCtrl.Instance.getLanguageText(FLLanguage.TOTAL_PLAY));
    }

    showNorTitle(bShow, state?) {
        // Fortune Leopard uses ib_bar/mask/info_main and info_respin. The
        // old Tiger-only info_bns/layout paths are not present in this scene.
        if (!this.ib_bar) return;
        this.ib_bar.active = true;
        const mask = this.ib_bar.getChildByName("mask");
        const normal = mask?.getChildByName("info_main");
        const respin = mask?.getChildByName("info_respin");
        if (!normal || !respin) return;
        if (!bShow) {
            normal.active = false;
            respin.active = false;
            return;
        }
        const isRespin = state === "triFree" || (typeof state === "number" && state > 0);
        normal.active = !isRespin;
        respin.active = isRespin;
        if (this.node_win_big) this.node_win_big.active = false;
    }


        // let lab_title = xNodeFL.find("lab_title", this.node);
        // let lab_title_nor = xNodeFL.find("lab_title_nor", this.node);

        // if (bShow) {
        //     let str = "";
        //     if (state == FLSTATE.RUNING) {
        //         str = FLLanguage.GOOD_LUCK;
        //     } else {
        //         let list = [FLLanguage.PLACE_YOUR_BETS, FLLanguage.SPIN_TO_WIN]
        //         str = list[Math.floor(Math.random() * list.length)]
        //     }

        //     lab_title.active = false;
        //     this.lab_award_num.node.active = false;
        //     lab_title_nor.active = true;
        //     xNodeFL.setLabel("", lab_title_nor, FLConfigCtrl.Instance.getLanguageText(str));
        // } else {
        //     lab_title.active = true;
        //     this.lab_award_num.node.active = true;
        //     lab_title_nor.active = false;
        // }

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

    updateBitView(index: number = FLGameManager.getTotalBitIndex(), bClick = false) {

        let mMultiples: number[] = FLGameManager.getTotalBitList();
        let max = mMultiples.length - 1;
        let min = 0;
        let maxBool = index >= max;
        let minBool = index <= min;
        index = Math.min(index, max);
        index = Math.max(index, min);
        xNodeFL.setBtnInteractable("", this.addBtnNode, !maxBool);
        xNodeFL.setBtnInteractable("", this.subBtnNode, !minBool);
        FLGameManager.setTotalBitIndex(index);
        // xNodeFL.setLabel("", this.lab_bit_top.node, showMoney(FLGameManager.getBitNum()*FLGameManager.getBitMult(), false));
        xNodeFL.setLabel("", this.lab_bit_bottom.node, (FLGameManager.getTotalBitNum() / 100) + "");


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

        if (FLGlobal.playerType == 0) {
            FLGameManager.setTotalBitIndex(0);
            this.updateBitView(0);
            return;
        }
        let gold = FLGlobal.USER.gold;


        let mMultiples: number[] = FLGameManager.getTotalBitList() || [];
        if (!mMultiples || mMultiples.length == 0) {
            return
        }
        let n: number[] = [];;
        for (let i = mMultiples.length - 1; i >= 0; i--) {
            n[i] = Math.abs(mMultiples[i] - gold * 0.01);
        }
        let min = Math.min(...n);
        let minIndex = n.findIndex(item => item == min);
        let localBet = Number(flframe.storage.get(`${FLGlobal.USER.uid}_${FLConstant.GAMEID}_${FLGlobal.LEAVE}`));
        let localMult = Number(flframe.storage.get(`${FLGlobal.USER.uid}_${FLConstant.GAMEID}_${FLGlobal.LEAVE}_MULT`)) || 0;

        if (localBet > 0 && localBet <= FLGameManager.getMultiples().length && localMult > 0 && localMult <= FLGameManager.getMultIndexs().length) {
            localBet--;
            localMult--;
            FLGameManager.setBitIndex(localBet);
            FLGameManager.setBitMultIndex(localMult);
            let total = FLGameManager.getTotalBitIndexBy(localBet, localMult);
            FLGameManager.setTotalBitIndex(total);
            this.updateBitView(total);
        }
        else {
            const policy = goSession.entry?.live?.policy;
            const preferred = policy ? mMultiples.indexOf(Number(policy.defaultBet) * policy.lineCount) : 0;
            const index = Math.max(0, preferred);
            FLGameManager.setTotalBitIndex(index);
            this.updateBitView(index);
        }
    }
    async checkAudo(isEnd: boolean = true) {
        let stop = false;
        if (isEnd) {


            console.log("==========>>stop", stop)
        }
        xNodeFL.setLabel("lab_autoNum", this.btn_autostop, "" + FLGameManager.getAudoNum())
        xNodeFL.setActive("lab_autoNum", this.btn_autostop, FLGameManager.getAudoNum() > 0)
        if (!stop && FLGameManager.getAudoNum() > 0) {
            if (FLGameManager.canPlay()) {
                this.scheduleOnce(() => {
                    this.onGoBtnClick();
                }, 0)
            } else {
                FLGameManager.setAudoNum(0);
                FLLoadManager.ins.showAlertWithInit("Saldo tidak cukup. Silakan deposit lalu coba lagi.", () => {});
                this.updateBtnState(true)
            }
        } else {
            if (stop) {
                this.layerCtrl.sysAutoNum = Math.max(0, FLGameManager.getAudoNum());
            }

            FLGameManager.setAudoNum(0)
            this.updateBtnState(true)
        }
    }
    updateStopBtnInteractable(isinter: boolean) {
        xNodeFL.setBtnInteractable("", this.btn_stop, isinter)
    }

    updateBtnState(isshow: boolean) {
        if (isshow) this.canSendSpin = true;
        xNodeFL.setActive("", this.btn_stop, !isshow)
        xNodeFL.setActive("", this.btn_go, isshow)
        // xNodeFL.setActive("", this.btn_auto, isshow)
        xNodeFL.setBtnInteractable("", this.subBtnNode, isshow)
        xNodeFL.setBtnInteractable("", this.addBtnNode, isshow)
        xNodeFL.setBtnInteractable("", this.btn_auto, isshow)
        xNodeFL.setBtnInteractable("", this.btn_menu, isshow)
        // xNodeFL.setBtnInteractable("", this.btn_bet, isshow)
        this.btn_bet.getComponent(Button).interactable = isshow

        // xNodeFL.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFL.setBtnInteractable("", this.btn_turbo, isshow)
        // xNodeFL.setBtnInteractable("", xNodeFL.find("btn_line", this.node), isshow)
        // xNodeFL.setBtnInteractable("", xNodeFL.find("btn_rule", this.node), isshow)
        this.updateBtnAudo();
        if (isshow) this.updateBitView()

        this.updateGoBtnAnim();
    }
    updateBtnAudo() {
        let isAudo = FLGameManager.getAudoNum() > 0;
        if (isAudo) xNodeFL.hide("", this.btn_go)
        // if (isAudo) xNodeFL.hide("", this.btn_auto)
        if (isAudo) xNodeFL.hide("", this.btn_stop)
        xNodeFL.setActive("", this.btn_autostop, isAudo)
        xNodeFL.setBtnInteractable("", this.btn_autostop, isAudo)
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
        let guangAnim: Animation = xNodeFL.findComponent("mh_vfx_a", this.btn_go, Animation);
        // The leopard scene does not contain the old tiger-only glow node.
        // Keep the input path independent from that optional effect: a missing
        // animation must never prevent the spin request from being sent.
        switch (event.type) {
            case "touch-start":
                if (guangAnim) {
                    guangAnim.node.active = true;
                    guangAnim.play();
                }
                // this.isAutoShow = true;
                // this.scheduleOnce(this.showSetAudo, 1)
                this.isTouchGo = true;
                break;
            case "touch-move":

                break;
            case "touch-end":
                // this.isAutoShow = false;
                // this.unschedule(this.showSetAudo);
                if (guangAnim) guangAnim.node.active = false;
                // if (!this.layout_auto.active) {
                this.onGoBtnClick(true)
                // }
                this.isTouchGo = false;
                break;
            case "touch-cancel":
                // this.isAutoShow = false;
                // this.unschedule(this.showSetAudo);
                if (guangAnim) guangAnim.node.active = false;
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
            // FLAudioMgr.Instance.playSound("games/AutoGameButton");
            // this.setAutoActive(true);
            // this.setBtnMaskActive(true);

            const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
            if (!canvas) return;
            (this.autoPage ??= new AutoSpinPage(canvas, count => this.onAutoSelectClick(count), () => ({
                bet: showMoney(FLGameManager.getTotalBitNum(), false), balance: showMoney(FLGlobal.USER.gold),
            }), () => FLAudioMgr.Instance.playSound('games/list_item_click'))).open();
        }
    }


    playWinAni() {
        // let ani: Animation = xNodeFL.findComponent("winbgani", this.node, Animation);
        // if (isValid(ani)) {
        //     xNodeFL.show("", ani.node)
        //     ani.play();
        //     this.scheduleOnce(() => { xNodeFL.hide("", ani.node) }, 0.42)
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
            xNodeFL.setLabelRollAni(this.lab_award_num, award, awardbefor, rollT);
            this.setBigAwardNum(award);
        } else {
            this.lab_award_num.string = showMoney(award, false);
        }
    }

    setBigAwardNum(award, winType?) {
        if (award > 0) {
            this.node_win_big.active = true;
            this.node_win_big.children.forEach((node) => { node.active = false; })
            let bitNum = FLGameManager.getTotalBitNum()
            if (!winType) {
                winType = FLGameManager.getWinType(award, bitNum);
            }

            FLAudioMgr.Instance.playSound("games/result1");
            let showBg;
            if (winType == 1) {
                showBg = xNodeFL.find("ib_bar_a", this.node_win_big);
                // xNodeFL.find("ib_vfx_b_screen_00", this.node_win_big).active = true;


                let anim1: Animation = xNodeFL.findComponent("ib_vfx_b_screen_00", this.node_win_big, Animation);
                anim1.node.active = true;
                anim1.play();

                let anim2: Animation = xNodeFL.findComponent("ib_vfx_c_add_00", showBg, Animation);
                anim2.node.active = true;
                anim2.play();
            } else if (winType == 2) {
                showBg = xNodeFL.find("ib_bar_b", this.node_win_big);
                // xNodeFL.find("ib_vfx_a_screen_00", this.node_win_big).active = true;

                let anim1: Animation = xNodeFL.findComponent("ib_vfx_a_add_00", this.node_win_big, Animation);
                anim1.node.active = true;
                anim1.play();

                let anim2: Animation = xNodeFL.findComponent("ib_vfx_c_add_02_00", showBg, Animation);
                anim2.node.active = true;
                anim2.play();
            } else if (winType == 3) {
                showBg = xNodeFL.find("ib_bar_c", this.node_win_big);
                // xNodeFL.find("ib_vfx_e_screen_00", this.node_win_big).active = true;

                // let anim1: Animation = xNodeFL.findComponent("ib_vfx_e_add_00", this.node_win_big, Animation);
                // anim1.node.active = true;
                // anim1.play();

                let anim2: Animation = xNodeFL.findComponent("ib_vfx_c_add_03_00", showBg, Animation);
                anim2.node.active = true;
                anim2.play();
            }

            let anim1: Animation = xNodeFL.findComponent("ib_vfx_e_add_00", this.node_win_big, Animation);
            anim1.node.active = true;
            anim1.play();

            showBg.active = true;
            tween(showBg)
                .to(0.2, { scale: new Vec3(1.1, 1.1) })
                .to(0.2, { scale: new Vec3(1, 1) })
                .start()

            let diGuangOpa: UIOpacity = xNodeFL.findComponent("ib_vfx_d_add", this.node_win_big, UIOpacity);
            diGuangOpa.node.active = true;
            diGuangOpa.opacity = 255;
            tween(diGuangOpa)
                .to(0.4, { opacity: 0 })
                .start()

            let num_info = xNodeFL.find("num_info", this.node_win_big);
            num_info.active = true;
            xNodeFL.setLabel("", num_info, showMoney(award));
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
        FLGameManager.setFast(false);
    }

    /**修改速度 */
    onTurboClick() {
        FLAudioMgr.Instance.playSound("games/menu_icon_press");
        // FLAudioMgr.Instance.playSound("button/MaxBetButton")

        let node_off = this.btn_turbo.getChildByName("txt_turbo_off");
        let node_on = this.btn_turbo.getChildByName("txt_turbo_on");

        node_off.active = !node_off.active;
        node_on.active = !node_on.active;

        this.showTipPanel(node_on.active ? "turbo_enabled" : "turbo_disabled")

        // let spr_fast = this.btn_turbo.getChildByName("spr_fast");
        // spr_fast.active = !spr_fast.active;
        // // xNodeFL.findComponent("Label", this.btn_turbo, Label).Color = 
        // let lab = this.btn_turbo.getChildByName("Label");
        // lab.getComponent(Label).color = spr_fast.active ? new Color(255, 255, 255, 255) : new Color(94, 94, 94, 255)

        // if (spr_fast.active) {
        //     tween(lab).repeatForever(tween().to(0.5, { scale: new Vec3(1.1, 1.1, 1.1) }).to(0.5, { scale: new Vec3(1, 1, 1) })).start()
        // } else {
        //     Tween.stopAllByTarget(lab);
        //     lab.scale = new Vec3(1, 1, 1);
        // }

        FLGameManager.setFast(node_on.active)
    }

    onAddBtnClick() {

        this.updateBitView(FLGameManager.getTotalBitIndex() + 1, true);
    }

    onSubBtnClick() {
        // FLAudioMgr.Instance.playSound("button/BetButton");
        this.updateBitView(FLGameManager.getTotalBitIndex() - 1, true);
    }

    async onGoBtnClick(bCLick = false) {
        if (this.layerCtrl.isReplay) return;
        FLAudioMgr.Instance.playSound("games/spin")

        if (FLGameManager.getState() != FLSTATE.READY) return
        if (FLGameManager.canPlay()) {
            if (!this.canSendSpin) return
            this.canSendSpin = false;

            FLAudioMgr.Instance.stopLongEffect("games/bgm_bigwin_end");
            // 钱没滚完
            if (FLGameManager.getWinAllMoneyR() > 0 && Number(this.lab_award_num.string) * 100 != FLGameManager.getWinAllMoneyR()) {
                FLAudioMgr.Instance.stopLongEffect("games/rolling");
                // FLAudioMgr.Instance.playSound("games/rolling_end");
                this.setAwardNum(FLGameManager.getWinAllMoneyR());
                this.scheduleOnce(() => {
                    this.setAwardNum(0);
                    this.showNorTitle(true);
                }, 0.2)
            } else {
                this.setAwardNum(0);
                this.showNorTitle(true);
            }
            FLGameManager.setWinAllMoneyR(0);

            flframe.storage.set(`${FLGlobal.USER.uid}_${FLConstant.GAMEID}_${FLGlobal.LEAVE}`, FLGameManager.getBitIndex() + 1)
            flframe.storage.set(`${FLGlobal.USER.uid}_${FLConstant.GAMEID}_${FLGlobal.LEAVE}_MULT`, FLGameManager.getBitMultIndex() + 1)
            this.layerCtrl.centerRollCtrl.startRotation();
            // this.scheduleOnce(() => { this.updateBtnState(false); }, 0)
            this.updateBtnState(false);
            FLGameManager.setState(FLSTATE.RUNING);
            void this.layerCtrl.requestGoAward(FLGameManager.getBitIndex(), FLGameManager.getBitMultIndex());


            // 手动点击spin按钮
            if (bCLick) {
                this.playStopShow();
            }
            // await this.layerCtrl.centerRollCtrl.initLight();
        } else {
            FLLoadManager.ins.showAlertWithInit("Saldo tidak cukup. Silakan deposit lalu coba lagi.", () => {});
        }
    }

    onAutoSelectClick(custom) {
        if (custom && this.btn_go.active) {
            FLGameManager.setAudoNum(Number(custom))
            this.checkAudo(false);
            // this.setAutoActive(false);
            this.setBtnMaskActive(false);
        }
    }

    onBtnMaskClick() {
        // let autoNode = xNodeFL.find("layout_auto", this.node);
        // if (autoNode.active == true) {
        //     autoNode.active = false;
        //     this.setBtnMaskActive(false);
        // } else {
        //     this.setBtnMaskActive(false);
        // }
    }
    onStopAudoRollClick() {
        FLAudioMgr.Instance.playSound("games/stop");
        // FLAudioMgr.Instance.playSound("button/InfoButton");
        FLGameManager.setAudoNum(0);
        xNodeFL.hide("", this.btn_autostop)
        xNodeFL.setActive("", this.btn_stop, FLGameManager.getState() != FLSTATE.READY)
        xNodeFL.setActive("", this.btn_go, FLGameManager.getState() == FLSTATE.READY)
        // xNodeFL.setActive("", this.btn_auto, FLGameManager.getState() == FLSTATE.READY)

        this.updateGoBtnAnim();
    }
    /**手动停止滚动/停止自动滚动 */
    onStopRollClick() {
        if (FLGameManager.getStop()) return
        FLAudioMgr.Instance.playSound("games/stop");
        FLGameManager.setStop(true);
        xNodeFL.find("sb_arrow_blur", this.btn_stop).active = false;
        xNodeFL.find("sb_arrow_grey", this.btn_stop).active = true;
    }
    // 播放apin按钮按下后，stop按钮动画
    playStopShow() {
        tween(this.btn_stop)
            .to(0.3, { scale: new Vec3(0.9, 0.9, 1) })
            .to(0.3, { scale: new Vec3(1, 1, 1) })
            .start()

        xNodeFL.find("sb_arrow_blur", this.btn_stop).active = true;
        xNodeFL.find("sb_arrow_grey", this.btn_stop).active = false;

        let starAnim: Animation = xNodeFL.findComponent("spin_click_star", this.btn_stop, Animation);
        starAnim.node.active = true;
        starAnim.play();

        this.playSpinFooterAnim();
    }
    onLineBtnClick() {
        // FLAudioMgr.Instance.playSound("button/InfoButton");
        // if (this.showLineBool) FLLoadManager.ins.hideLineLayer();
        // else FLLoadManager.ins.showLineLayerWitnInit(null, this.layerCtrl.lineNode);
        // this.showLineBool = !this.showLineBool
    }

    changeFreeState(isFree: boolean = false) {
        xNodeFL.setActive("tip_panel", this.node, isFree);
        xNodeFL.setActive("lab_free", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFL.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFL.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFL.setActive("btn_stop", this.node, !isFree);
        // xNodeFL.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateBonusNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFL.setLabel("lab_bonus", this.node, lab);
    }

    changeBonusState(isFree: boolean = false) {
        xNodeFL.setActive("tip_panel", this.node, isFree);
        xNodeFL.setActive("lab_bonus", this.node, isFree);

        if (this.btn_stop.active == true) {
            xNodeFL.setBtnInteractable("", this.btn_stop, !isFree,)
        }
        if (this.btn_autostop.active == true) {
            xNodeFL.setBtnInteractable("", this.btn_autostop, !isFree,)
        }

        // xNodeFL.setActive("btn_stop", this.node, !isFree);
        // xNodeFL.setActive("btn_autostop", this.node, !isFree && this.isAutoShow);

    }
    updateFreeNum(lab: string = null) {
        if (!lab || lab == "") {
            return
        }
        xNodeFL.setLabel("lab_free", this.node, lab);
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
        if (this.layerCtrl.isReplay) {
            this.lab_all_money.string = '******';
            return;
        }
        let num = nums;
        if (!nums) {
            num = FLGlobal.USER.gold
            if (FLGlobal.MODE == "fun") {
                num = FLGlobal.USER.experienceGold
            };
        }
        // if (this.curAllMoney != num) {
        //     let ani: Animation = xNodeFL.findComponent("goldAni", this.node.parent, Animation);
        //     if (isValid(ani)) {
        //         xNodeFL.show("", ani.node)
        //         ani.play();
        //         this.scheduleOnce(() => {
        //             xNodeFL.hide("", ani.node)
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
        FLAudioMgr.Instance.playSound("games/menu_icon_press");
        this.changePanel(2);
    }


    onBtnExit() {
        FLAudioMgr.Instance.playSound("games/menu_icon_press");
        if (FLGameManager.getState() == FLSTATE.READY) {
            this.layerCtrl.onBtnExit()
        } else {
            let content = FLConfigCtrl.Instance.getLanguageText(FLLanguage.GAME_IS_NOT_END)
            FLLoadManager.ins.showAlertWithInit(content, () => { }, () => { },)
            return
        }
    }



    initSoundBtn() {
        xNodeFL.find("ic_soundon", this.btn_sound).active = flframe.audio.getSwitchMusic();
        xNodeFL.find("ic_soundoff", this.btn_sound).active = !flframe.audio.getSwitchMusic();
    }

    onSoundBtnClick() {
        FLAudioMgr.Instance.playSound("games/menu_icon_press");
        // FLAudioMgr.Instance.playSound("button/InfoButton");

        let ic_soundon = xNodeFL.find("ic_soundon", this.btn_sound);
        let ic_soundoff = xNodeFL.find("ic_soundoff", this.btn_sound);
        ic_soundon.active = !ic_soundon.active;
        ic_soundoff.active = !ic_soundoff.active;

        flframe.audio.setSwitchMusic(ic_soundon.active);
        flframe.audio.setSwitchEffect(ic_soundon.active);

    }


    onRuleBtnClick() {
        FLAudioMgr.Instance.playSound("games/menu_icon_press");
        // FLAudioMgr.Instance.playSound("button/InfoButton")
        const canvas = document.getElementById('GameCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        (this.rulesPage ??= new RulesPage(canvas)).open();
    }

    onCloseBtnClick() {
        FLAudioMgr.Instance.playSound("games/menu_icon_press");
        this.changePanel(1);
    }

    private rulesPage?: RulesPage;
    private betPage?: BetOptionsPage;
    private autoPage?: AutoSpinPage;

    onBetClick() {
        if (this.layerCtrl.isReplay || FLGameManager.getState() !== FLSTATE.READY) return;
        FLAudioMgr.Instance.playSound("games/menu_icon_press");

        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        if (!canvas) return;
        (this.betPage ??= new BetOptionsPage(canvas, () => ({
            choices: buildChoices(FLGameManager.getMultiples().map(String), 5, FLGameManager.getMultIndexs().length),
            bet: String(FLGameManager.getBitNum()), level: FLGameManager.getBitMultIndex() + 1,
            lines: 5, balance: String(FLGlobal.USER.gold),
        }), (bet, level) => {
            const index = FLGameManager.getMultiples().indexOf(Number(bet));
            if (index < 0) return;
            FLGameManager.setBitIndex(index);
            FLGameManager.setBitMultIndex(level - 1);
            this.updateBitView(FLGameManager.getTotalBitIndexBy(index, level - 1));
        }, () => FLAudioMgr.Instance.playSound('games/list_item_click'))).open();
    }




    onDestroy() {
        this.rulesPage?.close();
        this.betPage?.destroy();
        this.autoPage?.close();
        super.destroy()

    }
}

