import type { Frame, Rotation } from '../../net/FDResultAdapter';
import { _decorator, instantiate, Vec3, tween, find, sp, Label, Node, UIOpacity, UITransform, Sprite, Color, isValid, Prefab, Tween, ParticleSystem2D, bezier, NodeEventType, Animation, math, view, Vec2, Widget, } from 'cc';
import { fdframe } from '../../../fdframe/fdframe';
import { xNodeFD } from '../../../xtools/xNodeFD';
import { FDBaseNode } from '../../base/FDBaseNode';
import { showMoney } from '../../common/FDUtils';

import { FDConstant, FDSTATE, WINTYPE } from '../../FDConstant/FDConstant';
import FDLoadManager from '../../load/FDLoadManager';
import { FDGameManager, IgetCanStop } from '../../mgr/FDGameManager';
import { FDAudioMgr } from './FDAudioMgr';
import { FDCellItem } from './FDCellItem';
import { FDConfigCtrl } from './FDConfigCtrl';
import { FDGameLayerCtrl } from './FDGameLayerCtrl';
import { FDGlobal } from './FDGlobal';
import { FDLanguage } from './FDLanguage';
import { FDCellLayer } from './FDCellLayer';
import { FDBigWinCtrl } from './FDBigWinCtrl';
import { FDSpriteCtrl } from './FDSpriteCtrl';
import { FDPopupFreeCtrl } from './FDPopupFreeCtrl';
import { FDDdiscoball } from './FDDiscoballCtrl';
import { FDBnsTopRoll } from './FDBnsTopRoll';

const { ccclass } = _decorator;

@ccclass('FDCenterRollCtrl')
export default class FDCenterRollCtrl extends FDBaseNode {

    cellLayerCtrlList: FDCellLayer[] = [];
    discoballCtrl: FDDdiscoball = null;
    bnsTopRollCtrl: FDBnsTopRoll = null;

    ib_bar: Node = null;    // 跑马灯滚动条
    win_bar: Node = null;   // 赢分-大横条

    _avatarSp: sp.Skeleton = null;

    layerCtrl: FDGameLayerCtrl = null;
    freeCtrl: FDPopupFreeCtrl = null;

    _canCLickMultPanel = false; // 是否可以点击图标
    set canCLickMultPanel(val) {
        this._canCLickMultPanel = val;
    }
    get canCLickMultPanel() {
        return this._canCLickMultPanel;
    }

    _playAntiIndex = -1;

    _startMove: boolean = false;// 是否开始旋转
    _canStop: boolean = false;// 可以停止
    _bStop: boolean = false;    // 是否已经开始停止
    _stopLayerCnt: number = 0;  //停止旋转的列个数--5列都停了才开始处理停止操作
    _readyStopLayerCnt: number = 0;
    _startLayerCnt: number = 0; // 开始旋转的列个数--要等到5列都开始转才能停止
    _minIdleT: number = 0;  // 开始转动的额外空转时间

    _curAnt: boolean = false;
    _stopSlotsCnt: number = 0;
    _isAvaterPlayOther = false;

    protected initAttribute() {
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FDGameLayerCtrl);
        this._avatarSp = find("Canvas/GameLayer/layout_center/avatar").getComponent(sp.Skeleton);
        this.freeCtrl = find("Canvas/TopLayer/node_popup_free").getComponent(FDPopupFreeCtrl)

        this.discoballCtrl = xNodeFD.find("discoball", this.node).getComponent(FDDdiscoball);
        this.discoballCtrl.init();
        this.bnsTopRollCtrl = xNodeFD.find("bns_top/bns_mtp", this.node).getComponent(FDBnsTopRoll);
        this.bnsTopRollCtrl.init();
        this.discoballCtrl.onSettled = () => this.multiplierStopped(this.discoballCtrl);
        this.bnsTopRollCtrl.onSettled = () => this.multiplierStopped(this.bnsTopRollCtrl);

        this.playAvatarIdleAnim();

        xNodeFD.find("slots/node_mult", this.node).on(NodeEventType.TOUCH_END, this.clickMultPanel, this);
        this._canCLickMultPanel = true;

        let node_ant = xNodeFD.find("node_ant", this.node)
        node_ant.on(NodeEventType.TOUCH_END, this.touchAntCallBack, this);
        node_ant.on(NodeEventType.MOUSE_ENTER, this.touchAntCallBack, this);

    }
    initLanguageView() {
    }
    start() {
        this.initAttribute();
        this.initLanguageView();
        this.creatRollItem();
    }

    private creatRollItem(index: number = null) {
        let nodeList = xNodeFD.find("slots/node_item_list", this.node);
        for (let index = 0; index < nodeList.children.length; index++) {
            let pNode = nodeList.children[index];
            let cellLayerCtrl = pNode.addComponent(FDCellLayer);
            cellLayerCtrl.init(index, this);
            cellLayerCtrl.creatOne();
            this.cellLayerCtrlList.push(cellLayerCtrl);
        }
    }


    resData() {
        this._startMove = false;
        this.settledReel = false;
        this._canStop = true;
        this._bStop = false;
        this._stopLayerCnt = 0;
        this._readyStopLayerCnt = 0;
        this._startLayerCnt = 0;
        this._minIdleT = 0;
        this._playAntiIndex = -1;
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.resData();
        })
        this.discoballCtrl.resData()
        this.bnsTopRollCtrl.resData()
    }

    // 初始化所有节点，即中线动画全部隐藏、top层的全部隐藏、卷轴层的全部显示为默认,且不置灰、
    initLight() {
        // // FDAudioMgr.Instance.stopSound();
        // if (this._isAvaterPlayOther) {
        //     this.playAvatarIdleAnim();
        //     // this.playLightAnim(false);
        // }
        this.unscheduleAllCallbacks();
        this.hideAllLineMoney();
        this.hideAllLine();
        this.hideAllKuang();
        this.hideAllCellTop();
        this.showSlotsGray(false);
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.allCellList.forEach(node => {
                node.active = true;
            })
        })
    }



    /**开始转动 */
    public startRotation() {
        fdframe.log.logView("startRotation");
        if (this._startMove) return
        FDGameManager.setStop(false);
        this.unscheduleAllCallbacks();
        if (!FDAudioMgr.Instance.isMusicPlaying()) {
            FDAudioMgr.Instance.playMusic();
        }
        this._canCLickMultPanel = false;
        this.unschedule(this.hideOneMult);
        this.hideOneMult();

        this.initLight();
        this.resData();

        // this.showNorTitle(true)

        this._startMove = true;
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.setStartMove();
        })
        if (FDGameManager.isStateFree()) {
            FDAudioMgr.Instance.playSound("fsSpin");
            this.bnsTopRollCtrl.setStartMove();
        } else {
            FDAudioMgr.Instance.playSound("spinReelStart")
            this.discoballCtrl.setStartMove();
        }

    }


    // 开始旋转--回弹结束
    playStartRoll(index) {
        this._startLayerCnt += 1;

        if (FDGameManager.getFast()) {
            this._minIdleT += 0.08;
        } else {
            this._minIdleT += 0.15;
        }
    }

    // 准备停止
    playReadyToStop(index) {
        this._readyStopLayerCnt += 1;
    }

    // 开始滚动回弹
    playBackRoll(index) {
    }

    // 停止转动
    playStopRoll(index) {
        this._stopLayerCnt += 1;

        this.finishIfStopped();
    }



    private settledReel = false;

    private multiplierStopped(source: FDDdiscoball | FDBnsTopRoll) {
        if (source !== (FDGameManager.isStateFree() ? this.bnsTopRollCtrl : this.discoballCtrl) ||
            this._startMove || !FDGameManager.getRotateData()) return;
        this.settledReel = true;
        this.finishIfStopped();
    }

    private finishIfStopped() {
        if (this.settledReel && this._stopLayerCnt === FDConstant.COL_COUNT) {
            this.settledReel = false;
            void this.oneRoundEnd().catch(error => this.layerCtrl.handleAnimationError(error));
        }
    }

    showStoredBoard(icons: number[], data?: Frame['gameData'], free = false) {
        this.initLight();
        this.resData();
        this.cellLayerCtrlList.forEach((column,c) => {
            column.setResultData([icons[c],icons[3+c],icons[6+c]]);
            column.resumeSpecial();
        });
        const slots = xNodeFD.find('slots', this.node);
        slots.setScale(free ? .9 : 1, free ? .9 : 1, 1);
        slots.setPosition(xNodeFD.find(free ? 'slots_freePos' : 'slots_norPos', this.node).position);
        this.setBgIsFree(free);
        this._avatarSp.node.active = !free;
        const top = xNodeFD.find('bns_top', this.node);
        top.active = free;
        if (free) {
            for (const name of ['avatar_bgB_atlas_avatar','avatar_bgF_atlas_avatar'])
                xNodeFD.find(name, top).getComponent(sp.Skeleton).setAnimation(0,'idle',true);
            this.bnsTopRollCtrl.setResultData(data.multipliers);
            this.bnsTopRollCtrl.stopRollClick(false);
            this.layerCtrl.optCtrl.updateFreeCnt(this.layerCtrl.frame.freeRemaining);
            this.layerCtrl.optCtrl.showNorTitle(true, 'free');
        } else {
            this.discoballCtrl.setResultData(data?.multipliers.length === 1 && !data.blankMultiplier ? data.multipliers : [0]);
            this.discoballCtrl.stopRollClick(false);
        }
    }

    cancelRoll(icons: number[]) { this.showStoredBoard(icons); }

    acceptFrame(frame: Frame) {
        if (frame.triggeredFree) {
            this.playAvatarAnim('triSpecial');
            this._canStop = false;
            this.triFreeGameAnim(true, frame.awardedFreeSpins);
        } else {
            this._canStop = true;
        }
    }

    async oneRoundEnd() {
        fdframe.log.logView("oneRoundEnd")
        let rotateData: Rotation = null;
        rotateData = FDGameManager.getRotateData();
        if (rotateData == null) {
            this.roundEnd();
            return
        }

        this.layerCtrl.optCtrl.onStopRollClick()

        let awardList = rotateData.mAwardList;
        let hasWin = false;
        if (awardList && awardList.length > 0) {
            hasWin = true;

            let isAward = rotateData.isAward;
            let multData = FDGameManager.getMultData();
            let allMult = (isAward == 1 && multData && multData.length > 0) ? multData.reduce((total, num) => { return total + num }, 0) : 1;

            this.showSlotsGray(true);
            this.showWinTrace(awardList, awardList.length)

            if (allMult > 1) {
                if (FDGameManager.isStateFree()) {
                    this.bnsTopRollCtrl.playShowWin();
                } else {
                    this.discoballCtrl.playShowWin();
                }

                this.showBottomWin(awardList, allMult, false);
                await this.playMultWinAnim(multData);

                this.layerCtrl.optCtrl.playBigAwardMult(allMult);
                await this.showBottomWin(awardList, allMult, true);
            } else {
                await this.showBottomWin(awardList);
            }
        } else {
            if (!FDGameManager.isStateFree() && rotateData.mIcons.indexOf(FDConstant.WILD_TYPE) >= 0) {
                await this.playWildFlyAnim(rotateData.mIcons);
            }
        }

        const frame = this.layerCtrl.frame;
        this.layerCtrl.showSettledBalance(0);
        FDGameManager.resOneRound();

        if (FDGameManager.isStateFree()) {

            if (!hasWin) {
                await this.delayTime(0.3)
            }

            if (frame.nextAction === 'complete') {   // 免费结束

                let winCoin = FDGameManager.getWinAllMoney();
                FDAudioMgr.Instance.stopMusic();
                await this.freeCtrl.endFreeGame(winCoin, rotateData.freeMax, (() => {
                    this._avatarSp.node.active = true;
                    this.playAvatarIdleAnim();
                    this.setBgIsFree(false);
                    this.discoballCtrl.setResultData([0]);
                    this.discoballCtrl.stopRollClick(false);
                    this.layerCtrl.optCtrl.showNorTitle(true, "init");
                    let slots = xNodeFD.find("slots", this.node);
                    slots.scale = new Vec3(1, 1, 1);
                    let slots_norPos = xNodeFD.find("slots_norPos", this.node)
                    slots.position = new Vec3(slots_norPos.position.x, slots_norPos.position.y)
                    xNodeFD.find("bns_top", this.node).active = false
                    xNodeFD.find("avatar_Fly", this.node).active = false

                    if (hasWin && !(awardList && awardList.length > 0)) {
                        this.showSlotsGray(false)
                    }
                }))

                await this.delayTime(0.5);
                FDAudioMgr.Instance.playMusic();
                this.roundEnd()
            } else {
                this.layerCtrl.optCtrl.updateFreeCnt(frame.freeRemaining);
                if (hasWin) this.layerCtrl.optCtrl.showNorTitle(true, "free");
                await this.layerCtrl.continuePlay(frame);
            }
            return
        } else {
            if (FDGameManager.getAudoNum() > 0) {
                await this.delayTime(0.3);
            }
        }

        this.roundEnd()
    }


    showWinTrace(awardList, index, mult = 1) {
        let playLine = (awardData, bShowMoney) => {
            let mIconIdxs = awardData.mIconIdxs;
            let money = awardData.mMoney / mult;
            let flag_id = awardData.flag_id;

            for (let i = 0; i < mIconIdxs.length; i++) {
                let idx = mIconIdxs[i] - 1;

                let delayT = idx % FDConstant.COL_COUNT * 0.05;
                this.scheduleOnce(() => {

                    let cell = this.getCellByIdx(idx);
                    // cell.active = false;
                    let type = cell.getComponent(FDCellItem).type;
                    let cellTop = this.playCellToTop(idx, type);
                    cellTop.active = true;
                    cellTop.getComponent(FDCellItem).playWinAni();
                    this.playKuang(idx);

                }, delayT)
            }

            this.playOneLine(flag_id);
            if (bShowMoney) {
                this.playOneLineMoney(flag_id, money);
            }

        }

        if (awardList) {
            this.hideAllLineMoney();
            this.hideAllLine();
            this.hideAllKuang();
            this.hideAllCellTop();
            // FDAudioMgr.Instance.playSound("games/prizeWinHighlight");
            if (index == awardList.length) {  // 总的
                for (let i = 0; i < awardList.length; i++) {
                    playLine(awardList[i], false);
                }
                this.scheduleOnce(() => this.showWinTrace(awardList, 0, mult), 2);
            } else {    // 单的
                playLine(awardList[index], true);
                this.scheduleOnce(() => this.showWinTrace(awardList, index + 1, mult), 2);
            }
        }

    }


    showBottomWin(awardList, allMult = 1, isAll = true) {
        return new Promise<void>(async (resolve, reject) => {
            let isFree = FDGameManager.isStateFree();

            let roundWinMoney: number = 0;
            awardList && awardList.forEach(arardInfo => {
                if (isAll) {
                    roundWinMoney += arardInfo.mMoney
                } else {
                    roundWinMoney += arardInfo.mMoney / allMult;
                }
            })

            let bitNum = FDGameManager.visualStake ?? FDGameManager.getTotalBitNum()
            let bigWinType = FDGameManager.getBigWinType(roundWinMoney, bitNum);

            if (allMult == 1 && isAll && bigWinType > 0) { // 无倍乘且中大奖
                FDAudioMgr.Instance.playSound(Math.random() < 0.5 ? "winHighlight3" : "winHighlightBigwin");
                FDAudioMgr.Instance.playSound(Math.random() < 0.5 ? "voxWh3A" : "voxWh3B");
            } else {
                FDAudioMgr.Instance.playSound(Math.random() < 0.5 ? "winHighlight1" : "winHighlight2");
                let draList = ["voxMedA", "voxMedB", "voxWh1A", "voxWh1B", "voxWh1C", "voxWh2A", "voxWh2B", "voxWh2C"];
                FDAudioMgr.Instance.playSound(draList[Math.floor(Math.random() * draList.length)])
            }


            if (!isAll) {
                if (!isFree) this.playAvatarAnim("normalwin");
                let winType = FDGameManager.getWinType(roundWinMoney, bitNum);
                this.layerCtrl.optCtrl.setBigAwardNum(roundWinMoney, winType, (bigWinType > 0 || winType == 1) ? 0 : 0.5, false);
            } else {
                if (bigWinType > 0) {
                    if (allMult > 1) {
                        await this.delayTime(0.2)
                    }
                    await new Promise<void>((resolve2, reject) => {
                        let node = xNodeFD.find("Canvas/SafeLayer/big_win");
                        if (!node) {
                            let prefab = FDLoadManager.ins.getPrefab("res/load/prefab/games/big_win");
                            node = instantiate(prefab);
                            node.parent = xNodeFD.find("Canvas/SafeLayer");
                        }
                        node.getComponent(FDBigWinCtrl).playBigWin(roundWinMoney, bigWinType, resolve2);
                    })
                    FDAudioMgr.Instance.playSound("voxAfterBigwin")
                    FDAudioMgr.Instance.playSound("infobarAfterBigwin")
                    if (!isFree) this.playAvatarAnim("bigwin");
                } else {
                    if (!isFree) this.playAvatarAnim("normalwin");
                }

                let totalWin = this.layerCtrl.frame.totalWinAmount;
                FDGameManager.setWinMoney(totalWin);
                let winType = FDGameManager.getWinType(totalWin, bitNum);
                this.layerCtrl.optCtrl.setAwardNum(totalWin, 0.5);
                this.layerCtrl.optCtrl.setBigAwardNum(roundWinMoney, winType, (bigWinType > 0 || winType == 1) ? 0 : 0.5, true);
            }


            // if (bigWinType == 0) {
            let awaitT = 0.3;
            if (FDGameManager.isStateFree() && isAll) {
                awaitT += 0.5;
            }
            await this.delayTime(awaitT)
            // }

            resolve();
        })
    }


    // 设置背景
    setBgIsFree(isFree) {
        let sprIndex = isFree ? 1 : 0;

        find("Canvas/GameLayer/bg").getComponent(FDSpriteCtrl).sprIndex = sprIndex;
        xNodeFD.find("slots/ui_reel_bg", this.node).getComponent(FDSpriteCtrl).sprIndex = sprIndex;
        xNodeFD.find("slots/ui_reel_bg/ui_waybar_left", this.node).getComponent(FDSpriteCtrl).sprIndex = sprIndex;
        xNodeFD.find("slots/ui_reel_bg/ui_waybar_right", this.node).getComponent(FDSpriteCtrl).sprIndex = sprIndex;

        find("Canvas/GameLayer/layout_bottom/ui_footer").getComponent(FDSpriteCtrl).sprIndex = sprIndex;
        find("Canvas/GameLayer/layout_bottom/panel_info").getComponent(FDSpriteCtrl).sprIndex = sprIndex;

        xNodeFD.find("node_ant", this.node).active = !isFree;
        xNodeFD.find("discoball", this.node).active = !isFree;

        this.layerCtrl.optCtrl.setBgIsFree(isFree)
    }




    playAvatarAnim(type) {
        // if (FDGameManager.isStateFree() && type !== "scatter") return
        Tween.stopAllByTarget(this._avatarSp);
        if (type == "triSpecial") {
            this._avatarSp.setAnimation(0, "tease_start", false);
            this._avatarSp.addAnimation(0, "tease_win_idle", true);
        } else if (type == "triSpecialFail") {
            let entry = this._avatarSp.setAnimation(0, "tease_exit", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "wildCollect") {
            let entry = this._avatarSp.setAnimation(0, "wild_collect", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "normalwin") { // 普通
            let winList = ["win", "win2", "win3"];
            let ranIdx = Math.floor(Math.random() * 3);
            let entry = this._avatarSp.setAnimation(0, winList[ranIdx], false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })

        } else if (type == "bigwin") { // 大奖
            let winList = ["win_med", "win_big"];
            let ranIdx = Math.floor(Math.random() * 2);
            let entry = this._avatarSp.setAnimation(0, winList[ranIdx], false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        }

        this._isAvaterPlayOther = true;
    }

    playAvatarIdleAnim() {
        Tween.stopAllByTarget(this._avatarSp)
        this._isAvaterPlayOther = false;
        this._avatarSp.setAnimation(0, "idle", true);
        let delayTime = 30 + Math.random() * 5;
        tween(this._avatarSp)
            .repeatForever(
                tween()
                    .delay(delayTime)
                    .call(() => {
                        delayTime = 30 + Math.random() * 5;
                        let animType = Math.floor(Math.random() * 5) + 2;
                        this._avatarSp.setAnimation(0, "idle" + animType, false);
                        this._avatarSp.addAnimation(0, "idle", true);
                    })
            )
            .start()
    }

    // 触发免费动画
    triFreeGameAnim(bSuccess = true, freeCount = 0) {
        FDAudioMgr.Instance.playSound("teaseStart");
        FDAudioMgr.Instance.playSound(Math.random() < 0.5 ? "voxTeaseStartA" : "voxTeaseStartB");


        let slots = xNodeFD.find("slots", this.node);
        let node_ant = xNodeFD.find("node_ant", this.node);
        let light_opa: UIOpacity = xNodeFD.findComponent("light", this.node, UIOpacity);

        let discoball = xNodeFD.find("discoball", this.node);
        let discoball_mask = xNodeFD.find("discoball/mask", this.node);
        let discoball_lightOpa: UIOpacity = xNodeFD.findComponent("discoball/bi_discoball", this.node, UIOpacity);
        let discoball_failPos = xNodeFD.find("discoball_failPos", this.node);

        let discoball_sPos = new Vec3(discoball.position.x, discoball.position.y);

        let time1 = 1.8;
        let time2 = 0.3;
        if (!bSuccess) {
            node_ant.active = false;
            tween(slots)
                .to(time1, { scale: new Vec3(0.9, 0.9, 1) })
                .call(() => { FDAudioMgr.Instance.playSound("teaseFail") })
                .to(time2, { scale: new Vec3(1, 1, 1) })
                .start();
            light_opa.node.active = true;
            tween(light_opa)
                .to(0.3, { opacity: 255 })
                .delay(time1 + time2 - 0.6)
                .to(0.3, { opacity: 0 })
                .call(() => { light_opa.node.active = false; }).start()

            tween(discoball)
                .to(time1, { position: discoball_failPos.position }, { easing: "quadOut" })
                .to(time2, { position: discoball_sPos })
                .start()
            tween(discoball_mask)
                .delay(time1 / 3).call(() => { discoball_mask.active = false })
                .delay(time1 - time1 / 3 + time2).call(() => { discoball_mask.active = true })
                .start()
            discoball_lightOpa.node.active = true
            tween(discoball_lightOpa)
                .to(time1, { opacity: 180 })
                .to(time2, { opacity: 0 })
                .call(() => {
                    node_ant.active = true;
                    discoball_lightOpa.node.active = false;
                    this._canStop = true;
                })
                .start()
        } else {
            time1 = 1.5
            let time3 = 0.8;
            let time4 = 1.8;
            let time5 = 0.2;

            let slots_freePos = xNodeFD.find("slots_freePos", this.node)
            let endPos = new Vec3(slots_freePos.position.x, slots_freePos.position.y)

            node_ant.active = false;
            tween(slots)
                .to(time1, { scale: new Vec3(0.9, 0.9, 1) })
                .delay(time3 + time4)
                .to(time5, { position: endPos })
                .start();
            light_opa.node.active = true;
            tween(light_opa).to(0.3, { opacity: 255 }).delay(time1 + time3 + time4 - 0.6).to(0.3, { opacity: 0 }).call(() => { light_opa.node.active = false; }).start()

            tween(discoball)
                .to(time1, { position: discoball_failPos.position }, { easing: "quadOut" })
                .call(() => { discoball.active = false; discoball.position = discoball_sPos; })
                .start()
            tween(discoball_mask)
                .delay(time1 / 3).call(() => { discoball_mask.active = false })
                .delay(time1 - time1 / 3).call(() => { discoball_mask.active = true })
                .start()
            discoball_lightOpa.node.active = true
            tween(discoball_lightOpa)
                .to(time1, { opacity: 180 })
                .call(() => { discoball_lightOpa.node.active = false; })
                .start()

            let bns_top = xNodeFD.find("bns_top", this.node)

            let bonusNode = xNodeFD.find("bonus", this.node);
            bonusNode.children.forEach(node => { node.active = false })

            let bonusball = xNodeFD.find("ball", bonusNode);
            bonusball.children.forEach(node => { node.active = false })
            let bi_discoball = xNodeFD.find("bi_discoball", bonusball);
            let scaleX = discoball_lightOpa.node.scale.x * discoball.scale.x / bi_discoball.scale.x
            let scaleY = discoball_lightOpa.node.scale.y * discoball.scale.y / bi_discoball.scale.y
            bonusball.position = discoball_failPos.position;
            bonusball.scale = new Vec3(scaleX, scaleY, 1);


            tween(bonusball)
                .delay(time1)
                .call(() => {
                    FDAudioMgr.Instance.stopMusic();
                    FDAudioMgr.Instance.playLongEffect("bgmFsIntro");
                    FDAudioMgr.Instance.playSound("fireworkBigwinEnd");

                    bonusNode.active = true;
                    bonusNode.getComponent(UIOpacity).opacity = 255;
                    bonusball.active = true;
                    bi_discoball.active = true;
                    xNodeFD.find("bi_discoball_glow_add", bonusball).active = true;
                })
                .to(time3, { position: new Vec3(0, 320), scale: new Vec3(1, 1, 1) })
                .call(() => {
                    bonusNode.active = true;
                    bonusNode.getComponent(UIOpacity).opacity = 255;
                    let bi_vfx_j_screen = xNodeFD.find("bi_vfx_j_screen", bonusball);
                    bi_vfx_j_screen.active = true;
                    bi_vfx_j_screen.getComponent(Animation).play();
                    let bi_vfx_g_add = xNodeFD.find("bi_vfx_g_add", bonusball);
                    bi_vfx_g_add.active = true;
                    bi_vfx_g_add.getComponent(Animation).play();
                    bonusNode.getComponent(Animation).play("bonus_show");
                })
                .delay(time4)
                .call(() => {
                    this._avatarSp.node.active = false;
                    this.setBgIsFree(true);
                    this.layerCtrl.optCtrl.showNorTitle(true, "free");
                    this.layerCtrl.optCtrl.updateFreeCnt(freeCount);

                    bonusNode.getComponent(Animation).play("bonus_hide");

                    bns_top.active = true;
                    bns_top.getComponent(Animation).play("bns_top_tri");

                    let avatar_bgB = xNodeFD.find("avatar_bgB_atlas_avatar", bns_top);
                    avatar_bgB.getComponent(sp.Skeleton).setAnimation(0, "_seq", false);
                    avatar_bgB.getComponent(sp.Skeleton).addAnimation(0, "idle", true);
                    let avatar_bgF = xNodeFD.find("avatar_bgF_atlas_avatar", bns_top);
                    avatar_bgF.getComponent(sp.Skeleton).setAnimation(0, "_seq", false);
                    avatar_bgF.getComponent(sp.Skeleton).addAnimation(0, "idle", true);

                    let avatar_Fly = xNodeFD.find("avatar_Fly", this.node);
                    avatar_Fly.active = true;
                    avatar_Fly.getComponent(sp.Skeleton).setAnimation(0, "_seq", false);
                    avatar_Fly.getComponent(sp.Skeleton).setCompleteListener(() => {
                        avatar_Fly.getComponent(sp.Skeleton).setCompleteListener(null);
                        avatar_Fly.active = false
                    })
                    let bi_drag_vfx_a_screen = xNodeFD.find("bi_drag_vfx_a_screen", avatar_Fly);
                    bi_drag_vfx_a_screen.getComponent(Animation).play()

                    FDAudioMgr.Instance.playSound("dragonFly");

                    this.bnsTopRollCtrl.setStartMove();
                    this.discoballCtrl.setResultData([0]);
                    this.discoballCtrl.stopRollClick(false);

                    FDGameManager.setState(FDSTATE.FREEING);
                })
                .delay(0.5)
                .call(() => {
                    this._minIdleT = 0.5;
                    this._canStop = true;
                    FDAudioMgr.Instance.stopLongEffect("bgmFsIntro");
                    FDAudioMgr.Instance.playMusic("bgm_fs_loop");
                    this.layerCtrl.optCtrl.updateFreeCnt(this.layerCtrl.frame.freeRemaining);
                })
                .start()
        }
    }

    playWildFlyAnim(mIcons) {
        return new Promise<void>(async (resolve, reject) => {
            let hasPlay = false;
            let node_wildFly = this.node.getChildByName("node_wildFly");

            for (let i = 0; i < mIcons.length; i++) {
                if (mIcons[i] == FDConstant.WILD_TYPE) {
                    hasPlay = true;
                    // let cell = this.getCellByIdx(i);
                    // cell.active = false;
                    let cellTop = this.playCellToTop(i, mIcons[i]);
                    cellTop.active = true;
                    cellTop.getComponent(FDCellItem).playSpawnAnim();

                    let node = FDLoadManager.ins.showGetPrefab("res/load/prefab/games/wild_fly", node_wildFly);
                    node.active = true;
                    node.position = node_wildFly.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(i));
                    node.getComponent(ParticleSystem2D).resetSystem()

                    let ePos = node_wildFly.getComponent(UITransform).convertToNodeSpaceAR(this.discoballCtrl.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0)));
                    tween(node)
                        .to(0.35, { position: ePos })
                        .delay(0.2)
                        .call(() => {
                            node.destroy();
                        })
                        .start()

                    // await this.delayTime(0.1)
                }
            }

            if (hasPlay) {
                FDAudioMgr.Instance.playSound("luckFly");
                await this.delayTime(0.35)
                FDAudioMgr.Instance.playSound("luckReach");
                this.playAvatarAnim("wildCollect");
                this.discoballCtrl.playWildCollectAnim();
            }
            resolve();
        })

    }


    /**
     * 节点播放动画时提到上层
     * @param index 0开始
     */
    playCellToTop(index, type) {
        let node_top = xNodeFD.find("slots/node_top", this.node);
        let cell = xNodeFD.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FDLoadManager.ins.getPrefab(FDConstant.PRAFAB_CELL_WIN));
            this.sortChildToParent(node_top, cell, "cell");
            cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(index));
            cell.name = `cell${index}`;
            cell.getComponent(FDCellItem).initTypeView(type, this);
        }
        if (cell.getComponent(FDCellItem).type !== type) {
            cell.getComponent(FDCellItem).setTypeView(type, false);
        }


        return cell
    }
    // copyCellToTop(ori_cell) {
    //     let node_top = xNodeFD.find("slots/node_top", this.node);
    //     let type = ori_cell.getComponent(FDCellItem).type;
    //     let index = ori_cell.getComponent(FDCellItem).index;
    //     let cell = xNodeFD.find(`cell${index}`, node_top);
    //     if (!cell) {
    //         cell = instantiate(FDLoadManager.ins.getPrefab(FDConstant.PRAFAB_CELL_WIN));
    //         cell.name = `cell${index}`;
    //         this.sortChildToParent(node_top, cell, "cell");
    //         cell.getComponent(FDCellItem).initTypeView(type);
    //     }
    //     cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(ori_cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
    //     cell.active = true;
    //     cell.getComponent(FDCellItem).setTypeView(type, false);
    //     return cell
    // }
    hideAllCellTop() {
        let node_top = xNodeFD.find("slots/node_top", this.node);
        if (node_top) {
            node_top.children.forEach(node => {
                node.active = false;
                node.children.forEach(node2 => {
                    node2.active = false;
                })
            })
        }
    }

    sortChildToParent(parentNode, childNode, str) {
        let insertIndex = -1;
        let addNum = parseInt(childNode.name.slice(str.length));
        for (let i = 0; i < parentNode.children.length; i++) {
            if (parentNode.children[i].name.startsWith(str)) {
                let curNum = parseInt(parentNode.children[i].name.slice(str.length))
                if (addNum > curNum) {
                    insertIndex = i;
                    break;
                }
            }
        }

        if (insertIndex === -1) {
            parentNode.addChild(childNode);
        } else {// 插入新节点到指定位置
            parentNode.insertChild(childNode, insertIndex);
        }
    }


    showSlotsGray(bShow) {
        let node = xNodeFD.find("slots/ui_reel_tint", this.node);
        node && (node.active = bShow);
    }

    showAntiGray(bShow, idx?) {

        let node = xNodeFD.find("node_item_list/anti_mask", this.node);
        if (node) {
            node.active = bShow;
            if (bShow && idx) {
                this.cellLayerCtrlList[idx].node.setSiblingIndex(node.parent.children.length - 1);
                node.setSiblingIndex(node.parent.children.length - 2);
            }
        }
    }



    // 中线-线动画 flag_id--1开始
    playOneLine(flag_id: number) {
        let node_lines = xNodeFD.find("slots/node_line/lines", this.node);
        if (!node_lines) {
            node_lines = instantiate(FDLoadManager.ins.getPrefab("res/load/prefab/games/lines"));
            node_lines.parent = xNodeFD.find("slots/node_line", this.node);
            node_lines.active = true;
            node_lines.children.forEach(node => { node.active = false });
        }

        let line = xNodeFD.find(`payline${flag_id}`, node_lines);
        line.active = true;
        line.getComponent(Animation).play();


        let line_ids = xNodeFD.find("slots/ui_reel_bg/win", this.node);
        xNodeFD.find("l_win_" + flag_id, line_ids).active = true;
        xNodeFD.find("r_win_" + flag_id, line_ids).active = true;
    }
    hideAllLine() {
        let node_line = xNodeFD.find("slots/node_line/lines", this.node);
        if (node_line) {
            node_line.children.forEach(node => {
                node.active = false;
            })
        }

        let line_ids = xNodeFD.find("slots/ui_reel_bg/win", this.node);
        line_ids.children.forEach(node => { node.active = false })
    }

    //中线赢分
    playOneLineMoney(flag_id: number, money: number) {
        let node_money = xNodeFD.find("slots/node_money", this.node);
        let mask = node_money.getChildByName(`win${flag_id > 3 ? 1 : flag_id}`);
        mask.active = true;
        xNodeFD.setLabel("num_info", mask, showMoney(money));

    }
    hideAllLineMoney() {
        let node_money = xNodeFD.find("slots/node_money", this.node);
        node_money.children.forEach(node => node.active = false);
    }

    /**
     * 中线框动画
     * @param idx 0开始
     */
    playKuang(idx: number) {
        let node_kuang = xNodeFD.find("slots/node_kuang", this.node);
        if (node_kuang) {
            let kuang = xNodeFD.find(`kuang${idx}`, node_kuang);
            if (!kuang) {
                kuang = instantiate(FDLoadManager.ins.getPrefab("res/load/prefab/games/win_kuang"));
                node_kuang.addChild(kuang);
                kuang.position = node_kuang.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(idx));
                kuang.name = `kuang${idx}`;
            }
            kuang.active = true;

            kuang.getComponent(Animation).play();
        }
    }
    hideAllKuang() {
        let node_kuang = xNodeFD.find("slots/node_kuang", this.node);
        if (node_kuang) {
            node_kuang.children.forEach(node => {
                node.active = false;
            })
        }
    }

    /**
    * 
    * @param idx 0开始
    */
    getWorldPosByIdx(idx: number): Vec3 {
        let col = idx % FDConstant.COL_COUNT;
        let row = Math.floor(idx / FDConstant.COL_COUNT);

        let y = FDConstant.CELL_SIZE.height * (row + 1 / 2);
        let pos = this.cellLayerCtrlList[col].getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, y, 0));
        return pos
    }

    // idx 0开始
    getCellByIdx(idx: number) {
        let col = idx % FDConstant.COL_COUNT;
        let row = Math.floor(idx / FDConstant.COL_COUNT);
        let node = this.cellLayerCtrlList[col].resultCell[row];
        return node;
    }

    playMultWinAnim(multData) {
        return new Promise<void>((resolve, reject) => {
            let isFree = FDGameManager.isStateFree();

            let node_mult = xNodeFD.find("node_mult", this.node);
            let mult = xNodeFD.find("mult", node_mult);
            mult.active = false;
            mult.scale = new Vec3(0, 0, 1);
            let multEndPos = isFree ? new Vec3(0, 500) : new Vec3(0, -20)
            let mtp_vfx_e_add = xNodeFD.find("mtp_vfx_e_add", node_mult);
            mtp_vfx_e_add.active = false;

            let totalMult = 0;
            let referCtrl = isFree ? this.bnsTopRollCtrl : this.discoballCtrl;
            for (let i = 0; i < multData.length; i++) {
                let type = multData[i];

                referCtrl.hideResultCell(i);
                let copyMult = instantiate(referCtrl.resultCell[i]);
                copyMult.active = true;
                copyMult.parent = node_mult;
                copyMult.position = node_mult.getComponent(UITransform).convertToNodeSpaceAR(referCtrl.resultCell[i].getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0)))

                tween(copyMult)
                    .by(0.2, { scale: new Vec3(0.2, 0.2, 1), position: new Vec3(0, 25) })
                    .delay(0.4 + i * 0.2)
                    .call(() => {
                        referCtrl.backResultCell(i);
                        let effList = isFree ? ["multiCombine1", "multiCombine2", "multiCombine3"] : ["multi1", "multi2", "multi3"];
                        FDAudioMgr.Instance.playSound(effList[i])
                    })
                    .to(0.2, { position: multEndPos, scale: new Vec3(0, 0, 1) })
                    .call(() => { copyMult.destroy() })
                    .start()
                let node_win = this.layerCtrl.optCtrl.node_win_big;
                let endPos = this.node.parent.getComponent(UITransform).convertToNodeSpaceAR(node_win.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));

                let colTween = tween(mult).delay(0.6 + i * 0.2 + 0.2)
                    .call(() => {
                        mtp_vfx_e_add.active = true;
                        mtp_vfx_e_add.position = multEndPos;
                        mtp_vfx_e_add.getComponent(Animation).play("mtp_vfx_e_add")
                        mult.active = true;
                        mult.position = multEndPos;
                        totalMult += type;
                        xNodeFD.setLabel("", mult, "x" + totalMult);
                        mult.scale = new Vec3(0, 0, 1);
                    })
                    .to(0.1, { scale: new Vec3(1, 1, 1) })
                    .delay(0.1)

                if (i < multData.length - 1) {
                    colTween.start();
                } else {
                    colTween
                        .delay(0.2)
                        .to(0.3, { position: endPos, scale: new Vec3(0, 0, 1) })
                        .call(() => {
                            FDAudioMgr.Instance.playSound(["multiReach1", "multiReach2", "multiReach3"][multData.length - 1])
                            resolve();
                        })
                        .start()

                }


            }

        })
    }


    clickMultPanel(event) {
        if (!this._canCLickMultPanel) {
            return
        }
        let node = event.target;

        let wPos = event.getUILocation();
        let clickPos = node.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(wPos.x, wPos.y, 0));
        let col = -1, row = -1;
        let posX, posY;

        let listX = [-325, -110, 110, 325];
        let index = listX.findIndex((value, index) => clickPos.x <= value && (index > 0 && clickPos.x >= listX[index - 1]));
        if (index > 0) {
            col = index - 1;
        }

        let bottomY = this.cellLayerCtrlList[0].node.position.y;
        for (let i = 0; i < FDConstant.ROW_COUNT; i++) {
            if (clickPos.y >= bottomY + FDConstant.CELL_SIZE.height * i && clickPos.y <= bottomY + FDConstant.CELL_SIZE.height * (i + 1)) {
                row = i;
                break;
            }
        }

        if (col >= 0 && row >= 0) {
            let cell_ref = 73
            let cellIdx = row * FDConstant.COL_COUNT + col;
            let cell = this.getCellByIdx(cellIdx);
            let type = cell.getComponent(FDCellItem).type;
            let refPos = node.getComponent(UITransform).convertToNodeSpaceAR(cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
            posX = col > FDConstant.COL_COUNT / 2 ? refPos.x - cell_ref : refPos.x + cell_ref;
            posY = refPos.y;

            if (type == 0) {
                return
            }

            let panel = node.getChildByName("mult_panel");
            if (panel && panel.active) {
                panel.active = false;
            }
            if (!panel) {
                panel = instantiate(FDLoadManager.ins.getPrefab("res/load/prefab/games/mult_panel"));
                node.addChild(panel);
                panel.name = "mult_panel";
                panel.on("click", this.onClickMultPanel, this);

                panel.getChildByName("cell_win").getComponent(FDCellItem).initTypeView(type, this)
            }

            FDAudioMgr.Instance.playSound("uiInfo");
            xNodeFD.find("slots/node_mult/ui_reel_tint_mult", this.node).active = true;
            panel.active = true;
            panel.position = new Vec3(posX, posY, 0)

            let cntLab = panel.getChildByName("cnt");
            let winLab = panel.getChildByName("win");
            let cell_win = panel.getChildByName("cell_win");

            xNodeFD.setLabel("", cntLab, "3");
            xNodeFD.setLabel("", winLab, FDConstant.PRAFAB_LIST[type].MULT);
            cell_win.children.forEach(node => node.active = false);
            let showSp: sp.Skeleton = xNodeFD.findComponent(FDConstant.PRAFAB_LIST[type].win_node, cell_win, sp.Skeleton);
            showSp.node.active = true;
            showSp.setAnimation(0, FDConstant.PRAFAB_LIST[type].spawn_anim, false);

            if (col < 2) {
                cntLab.position = new Vec3(70, 0, 0);
                winLab.position = new Vec3(130, 0, 0);
                cell_win.position = new Vec3(-cell_ref, 0, 0);
            } else {
                cntLab.position = new Vec3(-159, 0, 0);
                winLab.position = new Vec3(-96, 0, 0);
                cell_win.position = new Vec3(cell_ref, 0, 0);
            }

            this.unschedule(this.hideOneMult);
            this.scheduleOnce(this.hideOneMult, 5);
        }
    }

    onClickMultPanel() {
        this.unschedule(this.hideOneMult);
        this.hideOneMult();
    }

    hideOneMult() {
        xNodeFD.find("slots/node_mult/ui_reel_tint_mult", this.node).active = false;
        let mult_panel = xNodeFD.find("slots/node_mult/mult_panel", this.node);
        if (mult_panel) mult_panel.active = false;
    }


    touchAntCallBack(event: Event) {
        switch (event.type) {
            case "touch-end":
                this.onClickAntPanel();
                this.showAntPanel(true);
                break;
            case "mouse-enter":
                FDAudioMgr.Instance.playSound("sureWinHover");
                this.showAntPanel(true);
                break;
        }
    }

    showAntPanel(bShow) {
        let sw_window = xNodeFD.find("sw_window", this.node);

        Tween.stopAllByTarget(sw_window)
        if (bShow) {
            sw_window.active = true;

            xNodeFD.setLabel("fnt_sw", sw_window, showMoney(FDGameManager.getTotalBitNum()))

            tween(sw_window).delay(2).call(() => { sw_window.active = false }).start()
        } else {
            sw_window.active = false;
        }
    }

    onClickAntPanel() {
        if (this.layerCtrl.isReplay || !this.layerCtrl.canBoost || !this.layerCtrl.optCtrl.canSendSpin || FDGameManager.getState() !== FDSTATE.READY) return;
        this.setAntMode(!FDGameManager.getIsAnt());
    }

    setAntMode(isAnt: boolean, sound = true) {
        FDGameManager.setIsAnt(isAnt);

        if (sound) FDAudioMgr.Instance.playSound(isAnt ? "surewinBtnOn" : "surewinBtnOff");
        xNodeFD.find("node_ant/sw_on_bg", this.node).getComponent(FDSpriteCtrl).sprIndex = isAnt ? 1 : 0;
        xNodeFD.find("node_ant/sw_on", this.node).getComponent(FDSpriteCtrl).sprIndex = isAnt ? 1 : 0;
        xNodeFD.find("node_ant/sw_title_on", this.node).getComponent(FDSpriteCtrl).sprIndex = isAnt ? 1 : 0;

        xNodeFD.find("panel_info/node_bet/sw_wallet_prize", this.layerCtrl.optCtrl.node).active = isAnt;
        let sw_vfx_b_add = xNodeFD.find("panel_info/node_bet/sw_vfx_b_add", this.layerCtrl.optCtrl.node);
        sw_vfx_b_add.active = isAnt;
        if (isAnt) {
            sw_vfx_b_add.getComponent(Animation).play()
        }
        this.layerCtrl.optCtrl.updateBitView();
    }

    roundEnd() {
        FDGameManager.restRound();
        this.canCLickMultPanel = true;
        this.layerCtrl.onPlayFinished();
    }

    update(dt) {
        if (this._startMove) {
            if (this._minIdleT > 0) {
                this._minIdleT -= dt;
            }

            if (this._minIdleT <= 0 /*&& !this._bStop*/ && this._startLayerCnt == FDConstant.COL_COUNT && this._canStop) {
                FDGameManager.setRoundTime(FDGameManager.getRoundTime() + dt);
                let canStop: IgetCanStop = FDGameManager.getCanStop();
                if (canStop && canStop.state > 0 && this._canStop) {
                    // this._bStop = true;
                    this._startMove = false;
                    if (canStop.state == 1) {
                        this.cellLayerCtrlList.forEach((layerCtrl, idx) => {
                            layerCtrl.setResultData(FDGameManager.getResultData(idx));
                            layerCtrl.setDelayT(FDGameManager.getNormalDelayT(idx));
                            layerCtrl.setStopMove(true);
                        })
                        if (FDGameManager.isStateFree()) {
                            this.layerCtrl.optCtrl.updateFreeCnt(this.layerCtrl.frame.freeRemaining);
                            this.bnsTopRollCtrl.setResultData(FDGameManager.getMultData());
                            this.bnsTopRollCtrl.setDelayT(FDGameManager.getNormalDelayT(1));
                            this.bnsTopRollCtrl.setStopMove(true);
                        } else {
                            this.discoballCtrl.setResultData(FDGameManager.getMultData());
                            this.discoballCtrl.setDelayT(FDGameManager.getNormalDelayT(1));
                            this.discoballCtrl.setStopMove(true);
                        }

                    }
                }
                // }
            }

        }
    }
}
