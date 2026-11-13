import type { HistoryReplay } from '../../history/history_types';
import { restoredFree } from '../../network/display';
import { _decorator, find, UITransform, Vec3, tween, instantiate, Node, Tween, sp, Animation, isValid, NodeEventType, Sprite, UIOpacity } from "cc";
import { consoleLog, findValueIn2DArray, } from "../../xtools/WBSUtils";
import { xNodeWBS } from "../../xtools/xNodeWBS";
import { activeColumns, adaptFrame } from "../../network/frame_adapter";
import { describeFrame, FrameGate } from "../../network/round_controller";
import { WBSConstant, WBSSTATE } from "../constant/WBSConstant";
import { WBSAwardlAni } from "./WBSAwardlAni";
import { WBSCellLayer } from "./WBSCellLayer";
import { WBSCellItem } from "./WBSCellItem";
import { WBSBaseLayer } from "../base/WBSBaseLayer";
import { wbsgame } from "../wbsgame";
import { IgetCanStop } from "../mgr/WBSGameManager";
import { WBSSpriteCtrl } from "./WBSSpriteCtrl";
import { En, Pt } from "../common/WBSlanguage";
import { WBSConfig } from "../cfg/WBSConfig";


const { ccclass, property } = _decorator;

@ccclass('WBSRollLayer')
export class WBSRollLayer extends WBSBaseLayer {
    private readonly frameGate=new FrameGate();
    private cellLayerCtrlList: WBSCellLayer[] = [];

    private topCellLayer: Node = null;

    _startMove: boolean = false;// 是否开始旋转
    _startLayerCnt: number = 0; // 开始旋转的列个数--要等到5列都开始转才能停止
    _minIdleT: number = 0;  // 开始转动的额外空转时间

    _showAllWin: boolean;

    _curMultIdx: number = 0;
    _showMultItem: Node = null;
    _allMultItems: Node[] = [];

    oneRoundWin: number = 0;
    oneRoundWinAll: number = 0;
    currWinAll: number = 0;

    _canClickMultPanel = false; // 是否可以点击图标

    onLoad() {
        // WBSUtils.translateAll(this.node)
        this.initAttribute()
    }

    initAttribute() {
        this.topCellLayer = xNodeWBS.find("topCellLayer", this.node)

        this.node.getChildByName("node_payout").on(NodeEventType.TOUCH_END, this.clickPayoutPanel, this);
        this._canClickMultPanel = true;
    }

    start() {
        this.initCellItem();
        this.initMultAnim();
    }


    hideNodeList() {
        let nodeList = this.node.getChildByName("cellLayer");
        nodeList.active = false
    }

    private static readonly initialIcons = [[7, 3, 8], [5, 10, 1, 4], [2, 1004, 1001, 9, 6], [2, 1004, 1001, 9, 6], [5, 10, 1, 4], [7, 3, 8]];

    private openingReels(data?: HistoryReplay) {
        const columns = data?.startBoard
            ? activeColumns({board: data.startBoard, previewRows: data.startPreviewRows})
            : WBSRollLayer.initialIcons;
        const bottom = data?.startBottomSymbols;
        if (bottom !== undefined && (bottom.length !== 6 || bottom.some(value =>
            !Number.isSafeInteger(value) || value % 1000 < 1 || value % 1000 > 8 || value >= 2000))) {
            throw Error('服务端底部格子无效');
        }
        return {columns, bottom};
    }

    showReplayOpening(data: HistoryReplay) {
        const {columns, bottom} = this.openingReels(data);
        this.cellLayerCtrlList.forEach((col, c) => col.creatOne(columns[c],
            bottom?.[c] ?? wbsgame.gameMgr.getRandomType()));
    }

    initCellItem() {
        let nodeList = this.node.getChildByName("cellLayer");
        nodeList.active = true;
        const {columns, bottom} = this.openingReels(wbsgame.sendMgr.replaySession?.data);

        for (let index = 1; index <= 6; index++) {

            let pNode = xNodeWBS.find(`cellLayer/cellLayer_${index}`, this.node);
            let cellLayerCtrl = pNode.addComponent(WBSCellLayer);
            this.cellLayerCtrlList.push(cellLayerCtrl);

            cellLayerCtrl.init(index - 1, this);
            cellLayerCtrl.creatOne(columns[index - 1], bottom?.[index - 1]);
        }
    }


    startData() {
        this.unscheduleAllCallbacks();
        // if (wbsgame.gameMgr.getState() != WBSSTATE.FREEING) wbsgame.gamelayer.optCtrl.winMoneyRoll.setString(0);
        console.log("startData")

        this.oneRoundWin = 0;
        this.oneRoundWinAll = 0;
        this._startMove = false;
        wbsgame.gameMgr.setRoundCount(0)
        this._startLayerCnt = 0;
        this._minIdleT = wbsgame.gameMgr.getFastAndNoFree() ? 0.1 : 0.3;
        this.topCellLayer.destroyAllChildren()
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.resData();
        })
        this.showMaskActive(false)
        this.restMult();
        // this.playSpecialFrameWin(false);
    }

    startRoll() {
        consoleLog("startRoll");
        if (this._startMove) return

        if (!wbsgame.audioMgr.isMusicPlaying()) {
            if (wbsgame.gameMgr.getState() == WBSSTATE.FREEING) { wbsgame.audioMgr.playMusic("bgm_fs") }
            else { wbsgame.audioMgr.playMusic("bgm_mg"); }
        }
        this._canClickMultPanel = false;
        this.unschedule(this.hideOnePayout);
        this.hideOnePayout();

        this.topCellLayer.children.forEach(node => { node.active = false });

        this.startData();
        wbsgame.gamelayer.optCtrl.updateBtnState(false);;
        wbsgame.gamelayer.optCtrl.showNorTitle(true);
        wbsgame.gameMgr.setStop(false);

        this._startMove = true;
        this.cellLayerCtrlList.forEach((layerCtrl, index) => {
            layerCtrl.setStartMove();
        })
    }

    // 开始旋转
    playStartRoll() {
        this._startLayerCnt += 1;
    }

    // 准备停止
    playReadyToStop(index) {
    }

    // 开始滚动回弹
    playBackRoll(index) {

    }

    // 停止转动
    playStopRoll(index) {
        if (index == WBSConstant.COL_COUNT - 1) {
            this.checkItem();
        }
    }

    onClickStop() {
        this._minIdleT = 0;
        this.cellLayerCtrlList.forEach((layerCtrl, idx) => {
            layerCtrl.onClickStop()
        })
    }

    checkItem() {
        if(!wbsgame.gameMgr.frame || !this.frameGate.accept(wbsgame.gameMgr.frame))return;
        // 播放赢钱
        let rotateData = wbsgame.gameMgr.getRotateData();
        if (rotateData == null) {
            this.oneRoundEnd();
            return
        }

        let mAwardList = rotateData.mAwardList;
        let eliminateList = [];
        this.oneRoundWin = 0;
        if (mAwardList) {
            for (let i = 0; i < mAwardList.length; i++) {
                if (mAwardList[i].mWinNum == wbsgame.gameMgr.getRoundCount() + 1) {
                    this.oneRoundWin += mAwardList[i].mMoney;
                    this.oneRoundWinAll = wbsgame.gameMgr.frame.spinWinAmount || wbsgame.gameMgr.frame.winAmount;
                    this.currWinAll = wbsgame.gameMgr.frame.totalWinAmount;
                    eliminateList = Array.from(new Set([...eliminateList, ...mAwardList[i].mIconIdxs]))
                }
            }
        }

        if (eliminateList.length > 0) {
            this.showMaskActive(true);

            let mult = wbsgame.gameMgr.getFactor();
            wbsgame.gamelayer.optCtrl.setBigAwardNum(this.oneRoundWin / mult);

            if (this._curMultIdx > 0) {
                this.playMultWin(() => { wbsgame.gamelayer.optCtrl.setBigAwardNum(this.oneRoundWin, 0, 0, false, false) });
            }
            wbsgame.gamelayer.optCtrl.setAwardNum(this.currWinAll)

            wbsgame.audioMgr.playSound("prizeSmallwin");
            this.scheduleOnce(() => {
                wbsgame.audioMgr.playSound("symShrink");
            }, 0.7);

            for (let i = 0; i < eliminateList.length; i++) {
                let pos = findValueIn2DArray(WBSConstant.INDICES, eliminateList[i] - 1);
                let item = this.cellLayerCtrlList[pos.col].getCellByRow(pos.row);
                if (item) {
                    let nodeTop = this.playCellWin(item["type"], eliminateList[i]);
                    nodeTop.active = true;
                    let isWild = adaptFrame(wbsgame.gameMgr.frame).transformedPositions.includes(eliminateList[i]);
                    if (!isWild) {
                        this.cellLayerCtrlList[pos.col].addFullSpace(pos.row);
                        item.removeFromParent();
                        item.destroy()
                    }

                    nodeTop.getComponent(WBSCellItem).playWinAni(item["type"], () => {
                        // if (!isWild) {
                        nodeTop.destroy();
                        // }
                    }, isWild, () => {
                        if (isWild) {
                            let newType = WBSConstant.WILD_TYPE;
                            item["type"] = WBSConstant.WILD_TYPE;
                            item.getComponent(WBSCellItem).setTypeView(newType);
                            // item.getComponent(WBSCellItem).playSpawnAnim(newType);
                            item.getComponent(WBSCellItem).playIdleAnim(newType)
                            item.setSiblingIndex(item.getSiblingIndex() + 2)
                        }
                    },)
                }
            }
        }

        let isFinish = wbsgame.gameMgr.checkFinish();
        if (isFinish) {
            this.oneRoundEnd();
            return
        }

        this.scheduleOnce(() => {
            this.showMaskActive(false)
            this.cellFall();
        }, 2)
    }

    /** 现有图标下落 */
    async cellFall() {
        const previousIcons = wbsgame.gameMgr.getRollResult().slice();
        await wbsgame.sendMgr.nextFrame();
        if (!isValid(this.node)) return;
        let delayTime1 = 0;
        let delayList = [];
        for (let col = this.cellLayerCtrlList.length - 1; col >= 0; col--) {
            delayList[col] = delayTime1;
            let hasDrop = this.cellLayerCtrlList[col].cellFall(delayTime1);
            if (hasDrop) {
                delayTime1 += 0.05;
            }
        }
        // 场上大于2个scatter, 等所有图标都掉落了,再播放待机动画,再播放剩下图标掉落动画
        // 场上少于2个,无需等全掉落
        let mIcons = previousIcons;
        let isTwoSca = mIcons.filter(value => value == WBSConstant.SCATTER_TYPE).length >= 2;

        await this.delayTime(isTwoSca ? delayTime1 : 0.1);
        this.syncMultiplier(true);
        let mIcons2 = wbsgame.gameMgr.getRollResult();

        let delayTime3 = 0;
        let antiLayer = xNodeWBS.find("cellLayer/antiLayer", this.node);
        let scaDropAnti = xNodeWBS.find("scaDropAnti", antiLayer);
        if (isTwoSca) {
            await this.delayTime(0.5)
            wbsgame.audioMgr.playSound("heartBeatNoise");
            this.showMaskActive(true);
            let topList = []
            for (let i = 0; i < mIcons2.length; i++) {
                if (mIcons2[i] == WBSConstant.SCATTER_TYPE) {
                    let nodeTop = this.playScaCellWin(mIcons2[i], i + 1);
                    nodeTop.getComponent(WBSCellItem).playFastSpinAnim(mIcons2[i])
                    topList.push(nodeTop)
                }
            }
            xNodeWBS.setActive("cellLayer/ui_reel_bg/sd_vfx_c_add", this.node, true);
            if (!scaDropAnti) {
                scaDropAnti = instantiate(wbsgame.gamelayer.scaDropAntiPrefab);
                scaDropAnti.parent = antiLayer;
                scaDropAnti.name = "scaDropAnti";
            }
            scaDropAnti.active = true;
            scaDropAnti.children.forEach(node => { node.active = false });
            let sd_vfx_b_add = xNodeWBS.find("sd_vfx_b_add", scaDropAnti);
            sd_vfx_b_add.active = true;
            sd_vfx_b_add.getComponent(WBSSpriteCtrl).sprIndex = wbsgame.gameMgr.getState() == WBSSTATE.FREEING ? 1 : 0;
            await this.delayTime(0.5);
            wbsgame.audioMgr.playSound("heartBeat");
            await this.delayTime(0.2);
            for (let i = topList.length - 1; i >= 0; i--) {
                topList[i].destroy()
            }
            this.showMaskActive(false);
            this.scheduleOnce(() => { wbsgame.audioMgr.playSound("heartBeat"); }, 1)
            delayTime3 = 1.5;
            for (let col = 0; col < this.cellLayerCtrlList.length; col++) {
                let data = wbsgame.gameMgr.getResultData(wbsgame.gameMgr.getRollResult(), col);
                let hasDrop = this.cellLayerCtrlList[col].creatTopItem(data, delayTime3, true);
                if (hasDrop) {
                    delayTime3 += 0.4;
                }
                xNodeWBS.setActive("sd_vfx_a_add_" + col, scaDropAnti, hasDrop);
            }
        } else {
            for (let col = this.cellLayerCtrlList.length - 1; col >= 0; col--) {
                let data = wbsgame.gameMgr.getResultData(wbsgame.gameMgr.getRollResult(), col);
                let hasDrop = this.cellLayerCtrlList[col].creatTopItem(data, delayTime3);
                if (hasDrop) {
                    delayTime3 += 0.05;
                }
            }
        }

        this.scheduleOnce(() => {
            xNodeWBS.setActive("cellLayer/ui_reel_bg/sd_vfx_c_add", this.node, false);
            if (scaDropAnti) {
                scaDropAnti.active = false;
            }

            this.checkItem();
        }, delayTime3 + 0.1)
    }

    restoreFrame() {
        const mgr=wbsgame.gameMgr;
        const cols=this.cellLayerCtrlList;
        cols.forEach((col,c)=>col.creatOne(mgr.getResultData(mgr.getRollResult(),c)));
        const free=restoredFree(mgr.frame);
        this.showFreeBg(free);
        mgr.setState(free?WBSSTATE.FREEING:WBSSTATE.READY);
        this.syncMultiplier(false,free?mgr.getFactor():1);
        wbsgame.gamelayer.optCtrl.setAwardNum(mgr.frame.totalWinAmount);
        this.updateFreeNum();
    }

    async resumeFrame() {
        const mgr=wbsgame.gameMgr;
        this.oneRoundWinAll=0;this.currWinAll=mgr.frame.totalWinAmount;
        wbsgame.gamelayer.isGameEnd=false;
        wbsgame.gamelayer.optCtrl.updateBtnState(false);
        this.syncMultiplier(false);
        // Continue from the restored settlement frame.
        this.checkItem();
    }

    async oneRoundEnd() {
        this.showMaskActive(false);
        const mgr=wbsgame.gameMgr;
        const frame=mgr.frame;
        if(this.oneRoundWinAll>0){await this.getAwardType(this.oneRoundWinAll);await this.delayTime(0.5);}
        const step=describeFrame(frame);
        if(step.transition==='enter-free'){
            mgr.setState(WBSSTATE.FREEING);
            const icons=mgr.getRollResult();
            icons.forEach((type,i)=>{if(type===WBSConstant.SCATTER_TYPE)this.playCellWin(type,i+1).getComponent(WBSCellItem).playTriAni(type);});
            wbsgame.audioMgr.playSound('scatterWinHighlight');
            await this.delayTime(1.5);
            await wbsgame.gamelayer.freeLayerCtrl.triFreeGame(step.remaining,()=>{this.showFreeBg(true);this.updateFreeNum();});
            wbsgame.audioMgr.playMusic('bgm_fs');
            await this.playTriFreeMult();
        } else if(step.transition==='retrigger'){
            await wbsgame.gamelayer.freeLayerCtrl.popTriFreeAgain(step.awarded,()=>this.updateFreeNum(false,true));
        }
        if(frame.nextAction==='start_free'){
            mgr.setState(WBSSTATE.FREEING);
            await wbsgame.sendMgr.nextFrame();
            if(!isValid(this.node))return;
            mgr.startFreeGame();mgr.freeReset();
            this.updateFreeNum();this.startRoll();return;
        }
        if(step.transition==='end-free'){
            await wbsgame.gamelayer.freeLayerCtrl.popEndFree(frame.totalWinAmount,()=>{this.showFreeBg(false);mgr.setState(WBSSTATE.READY);this.syncMultiplier(false,1);wbsgame.gamelayer.optCtrl.showNorTitle(true);});
            wbsgame.audioMgr.playMusic('bgm_mg');
        }
        if(mgr.getIsAuto())await this.delayTime(0.6);
        else this._canClickMultPanel=true;
        mgr.setState(WBSSTATE.READY);
        if (wbsgame.sendMgr.readOnly) { wbsgame.gamelayer.completeNativeReplay(); this.currWinAll=0; return; }
        wbsgame.gamelayer.optCtrl.roundEnd();this.currWinAll=0;
    }

    playCellWin(type: number, idx: number) {
        let cellTop = xNodeWBS.find(`cellWin_${idx}`, this.topCellLayer)
        if (!cellTop) {
            cellTop = instantiate(wbsgame.gamelayer.CellWinPrefab);
            cellTop.parent = this.topCellLayer;
            cellTop.name = `cellWin_${idx}`;
            cellTop.position = this.topCellLayer.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(idx));
            this.sortChildToParent(this.topCellLayer, cellTop)
        }
        return cellTop;
    }
    getCellTopByIdx(idx: number) {
        return xNodeWBS.find(`cellWin_${idx}`, this.topCellLayer);
    }

    playScaCellWin(type: number, idx: number) {
        let cellTop = xNodeWBS.find(`cellWin_${idx}`, this.topCellLayer)
        if (!cellTop) {
            cellTop = instantiate(wbsgame.gamelayer.CellPrefab);
            cellTop.parent = this.topCellLayer;
            cellTop.name = `cellWin_${idx}`;
            cellTop.position = this.topCellLayer.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(idx));
            this.sortChildToParent(this.topCellLayer, cellTop)
        }
        return cellTop;
    }


    sortChildToParent(parentNode, childNode) {
        let insertIndex = -1;
        let addNum = parseInt(childNode.name.slice(childNode.name.lastIndexOf("_") + 1));
        let colN = WBSConstant.COL_COUNT;
        for (let i = 0; i < parentNode.children.length; i++) {
            let curNum = parseInt(parentNode.children[i].name.slice(childNode.name.lastIndexOf("_") + 1))

            if (addNum % colN == curNum % colN) {
                if (addNum / colN > curNum / colN) {
                    insertIndex = i;
                    break
                }
            } else if (addNum % colN < curNum % colN) {
                insertIndex = i;
                break
            }
        }

        if (insertIndex === -1) {
            parentNode.addChild(childNode);
        } else {// 插入新节点到指定位置
            parentNode.insertChild(childNode, insertIndex);
        }
    }

    /**
    * @param idx 0开始
    */
    getWorldPosByIdx(idx: number): Vec3 {

        let pos = findValueIn2DArray(WBSConstant.INDICES, idx - 1)
        let y = WBSConstant.CELL_SIZE.height * (pos.row + 1 / 2);
        let endposition = this.cellLayerCtrlList[pos.col].getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, y, 0));
        return endposition
    }

    showMaskActive(bShow) {
        xNodeWBS.setActive("cellLayer/mask", this.node, bShow);
    }

    getAwardType(money: number) {
        return new Promise<void>(async (resolve, reject) => {
            let bet = Math.floor(money / wbsgame.gameMgr.getTotalBitNum());
            let type = -1
            if (bet < 10) type = -1
            else if (bet >= 10 && bet < 20) type = 0
            else if (bet >= 20 && bet < 40) type = 1
            else type = 2

            if (type >= 0) {
                await this.delayTime(0.5)
                let node = find("Canvas/SafeLayer/popup_bigwin");
                if (!node) {
                    node = instantiate(wbsgame.gamelayer.popupBigWinPrefab);
                    node.parent = find("Canvas/SafeLayer");
                    node.name = "popup_bigwin";
                }
                let comp: WBSAwardlAni = node.getComponent(WBSAwardlAni)
                comp.playWinAnim(type, money, () => {
                    wbsgame.audioMgr.playSound("prizeSmallwinMultipliedCrowd" + type + 1)// prizeSmallwinMultipliedCrowd1
                    wbsgame.gamelayer.optCtrl.setBigAwardNum(money, 3, 0.5, true);
                    resolve()
                })
            } else {
                wbsgame.gamelayer.optCtrl.setBigAwardNum(money, 0, 0, true)
                resolve();
            }

        })
    }

    showFreeBg(isFree) {
        xNodeWBS.setActive("bg", this.node, !isFree);
        xNodeWBS.setActive("ui_bg", this.node, !isFree);
        xNodeWBS.setActive("bns_bg", this.node, isFree);
        xNodeWBS.findComponent("cellLayer/ui_reel_bg", this.node, WBSSpriteCtrl).sprIndex = isFree ? 1 : 0;
        xNodeWBS.findComponent("cellLayer", this.node, WBSSpriteCtrl).sprIndex = isFree ? 1 : 0;
        xNodeWBS.find("cellLayer", this.node).position = new Vec3(0, isFree ? 23 : 119, 0)
        // xNodeWBS.find("antiLayer", this.node).position = new Vec3(0, isFree ? 23 : 119, 0)
        xNodeWBS.find("topCellLayer", this.node).position = new Vec3(0, isFree ? 23 : 119, 0)
        wbsgame.gamelayer.optCtrl.showFreeBg(isFree)
    }

    updateFreeNum(_first=false,bAdd=false) { wbsgame.gamelayer.optCtrl.showFreeCnt(wbsgame.gameMgr.frame?.freeRemaining || 0,bAdd); }

    playAntiAnim(colIdx: number = -1) {
        let gamelayer = wbsgame.gamelayer.node;
        let antiLayer = xNodeWBS.find("cellLayer/antiLayer", this.node);
        let antiAnim = xNodeWBS.find("anti_anim", antiLayer)
        if (colIdx > 0) {
            if (gamelayer.scale.x > 0.9) {
                Tween.stopAllByTarget(gamelayer)
                tween(gamelayer).to(0.5, { scale: new Vec3(0.9, 0.9, 1) }).start();
            }

            if (!antiAnim) {
                antiAnim = instantiate(wbsgame.gamelayer.antiAnimPrefab);
                antiAnim.parent = antiLayer;
                antiAnim.name = "anti_anim";
            }
            antiAnim.active = true;
            antiAnim.position = new Vec3(this.cellLayerCtrlList[colIdx].node.position.x, 0, 0);
            antiAnim.getComponent(Animation).play();
            wbsgame.audioMgr.stopLongSound("fastspinStart");
            wbsgame.audioMgr.playLongSound("fastspinStart");
        } else {
            if (gamelayer.scale.x < 1) {
                wbsgame.audioMgr.stopLongSound("fastspinStart");
                wbsgame.audioMgr.playSound("fastspinStop");
                Tween.stopAllByTarget(gamelayer);
                tween(gamelayer).to(0.5, { scale: new Vec3(1, 1, 1) }).call(() => { wbsgame.audioMgr.playSound("fastspinExit"); }).start();
            }

            if (isValid(antiAnim)) {
                antiAnim.active = false;
            }
        }
    }

    initMultAnim() {
        this._curMultIdx = 0;

        let multPanel = xNodeWBS.find("multPanel", this.node);
        multPanel.position = new Vec3(0, 535, 0);
        let winAnim = xNodeWBS.find("winAnim", multPanel);
        winAnim.active = false;
        let items = xNodeWBS.find("mask/items", multPanel);
        items.eulerAngles = new Vec3(0, 0, 0);
        items.children.forEach((node, index) => {
            this._allMultItems.push(node);
            node.eulerAngles = new Vec3(0, 0, -24 + 12 * index);
            let lab = xNodeWBS.find("lab", node);
            xNodeWBS.setLabel("", lab, "x" + WBSConstant.ALL_WIN_MULTS[index]);
            if (index == 2) {
                this._showMultItem = node;
                lab.scale = new Vec3(1.8, 1.8, 1);
                lab.getComponent(UIOpacity).opacity = 255;
            } else {
                lab.scale = new Vec3(1, 1, 1);
                lab.getComponent(UIOpacity).opacity = 130;
            }
        })
    }

    restMult() { this.syncMultiplier(false); }
    syncMultiplier(animate:boolean,factor=wbsgame.gameMgr.getFactor()) {
        const idx=WBSConstant.ALL_WIN_MULTS.findIndex((value,i)=>i>=2 && value===factor);
        if(idx<2)throw Error('Unsupported multiplier '+factor);
        this._curMultIdx=idx-2;
        const panel=xNodeWBS.find('multPanel',this.node);
        const items=xNodeWBS.find('mask/items',panel);
        Tween.stopAllByTarget(items);
        const angle=new Vec3(0,0,-12*this._curMultIdx);
        if(animate){panel.getComponent(Animation).play('mult_add');tween(items).to(0.3,{eulerAngles:angle}).start();}
        else items.eulerAngles=angle;
        xNodeWBS.setActive('winAnim',panel,this._curMultIdx>0);
        this._showMultItem=this._allMultItems[idx];
        this._allMultItems.forEach((item,i)=>{item.active=true;const label=xNodeWBS.find('lab',item);label.scale=i===idx?new Vec3(1.8,1.8,1):new Vec3(1,1,1);label.getComponent(UIOpacity).opacity=i===idx?255:130;});
    }

    playMultWin(endFunc?: Function) {
        if (this._curMultIdx > 0) {
            let multWin = instantiate(wbsgame.gamelayer.multWinPrefab);
            multWin.active = true;
            multWin.parent = wbsgame.gamelayer.node;
            multWin.position = multWin.parent.getComponent(UITransform).convertToNodeSpaceAR(xNodeWBS.findComponent("lab", this._showMultItem, UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
            let endPos = multWin.parent.getComponent(UITransform).convertToNodeSpaceAR(wbsgame.gamelayer.optCtrl.getNodeBigWinPos());

            let is1024 = this._curMultIdx == WBSConstant.ALL_WIN_MULTS.length - 3;
            xNodeWBS.setActive("lab", multWin, !is1024);
            xNodeWBS.setActive("lab1024", multWin, is1024);
            xNodeWBS.setLabel("lab", multWin, "x" + WBSConstant.ALL_WIN_MULTS[this._curMultIdx + 2]);
            wbsgame.audioMgr.playSound("multiFly");
            tween(multWin)
                .to(0.5, { scale: new Vec3(2, 2, 1), position: new Vec3(0, 119, 0) })
                .delay(0.1)
                .to(0.5, { scale: new Vec3(0.5, 0.5, 1), position: endPos })
                .call(() => {
                    if (endFunc) endFunc();
                    multWin.getComponent(Animation).play("mult_win_end");
                    multWin.getComponent(Animation).on(Animation.EventType.FINISHED, () => {
                        multWin.destroy();
                    })
                })
                .start()
        }
    }

    playAddMult() {
        let multPanel = xNodeWBS.find("multPanel", this.node);
        multPanel.getComponent(Animation).play("mult_add");

        let winAnim = xNodeWBS.find("winAnim", multPanel);
        winAnim.active = true;
        winAnim.scale = new Vec3(0.2, 0.2, 1);
        tween(winAnim).to(0.3, { scale: new Vec3(0.5, 0.5, 1) }).call(() => { winAnim.getComponent(Animation).play() }).start()

        let items = xNodeWBS.find("mask/items", multPanel);
        if (this._curMultIdx < 10)
            tween(items).by(0.3, { eulerAngles: new Vec3(0, 0, -12) }).start();

        this._curMultIdx = Math.min(this._curMultIdx + 1, 10)
        let oldLab = this._showMultItem.getChildByName("lab");
        oldLab.scale = new Vec3(1, 1, 1);
        oldLab.getComponent(UIOpacity).opacity = 130;
        this._showMultItem = this._allMultItems[this._curMultIdx + 2];
        let newLab = this._showMultItem.getChildByName("lab");
        newLab.scale = new Vec3(1.8, 1.8, 1);
        newLab.getComponent(UIOpacity).opacity = 250;

        wbsgame.audioMgr.playSound("multiUp" + Math.min(4, this._curMultIdx));
    }

    async playTriFreeMult() {
        return new Promise<void>(async (resolve, reject) => {
            xNodeWBS.setActive("SpriteSplash", this.node, true);
            wbsgame.audioMgr.playSound("fsIntroStart")
            let multPanel = xNodeWBS.find("multPanel", this.node);
            let items = xNodeWBS.find("mask/items", multPanel);
            let winAnim = xNodeWBS.find("winAnim", multPanel);
            tween(multPanel)
                .to(0.3, { position: new Vec3(0, 70, 0) })
                .start()
            await this.delayTime(0.5)
            wbsgame.audioMgr.playSound("fsIntroShift");

            let lab1 = this._showMultItem.getChildByName("lab");
            tween(lab1)
                .to(0.2, { scale: new Vec3(1, 1, 1) })
                .call(() => { lab1.getComponent(UIOpacity).opacity = 130; })
                .start()
            let lab2 = this._allMultItems[3].getChildByName("lab");
            tween(lab2)
                .to(0.2, { scale: new Vec3(1.8, 1.8, 1) })
                .to(0.2, { scale: new Vec3(1, 1, 1) })
                .start()
            let lab3 = this._allMultItems[4].getChildByName("lab");
            tween(lab3)
                .delay(0.2)
                .to(0.2, { scale: new Vec3(1.8, 1.8, 1) })
                .to(0.2, { scale: new Vec3(1, 1, 1) })
                .start()
            let lab4 = this._allMultItems[5].getChildByName("lab");
            tween(lab4)
                .delay(0.4)
                .to(0.2, { scale: new Vec3(1.8, 1.8, 1) })
                .start()

            tween(items)
                .to(0.2, { eulerAngles: new Vec3(0, 0, -12) })
                .to(0.2, { eulerAngles: new Vec3(0, 0, -24) })
                .to(0.2, { eulerAngles: new Vec3(0, 0, -36) })
                .start();
            await this.delayTime(0.6)
            this._curMultIdx = 3;
            this._showMultItem = this._allMultItems[this._curMultIdx + 2];
            let newLab = this._showMultItem.getChildByName("lab");
            newLab.scale = new Vec3(1.8, 1.8, 1);
            newLab.getComponent(UIOpacity).opacity = 250;
            winAnim.active = true;
            winAnim.scale = new Vec3(0.2, 0.2, 1);
            tween(winAnim)
                .to(0.3, { scale: new Vec3(0.5, 0.5, 1) })
                .call(() => { winAnim.getComponent(Animation).play() })
                .start()
            await this.delayTime(0.3)
            wbsgame.audioMgr.playSound("fsIntroChange")
            this._allMultItems[4].active = false;
            let bns_intro_1 = xNodeWBS.find("bns_intro_1", multPanel);
            bns_intro_1.active = true;
            bns_intro_1.getComponent(Animation).play();
            await this.delayTime(0.3)
            this._allMultItems[3].active = false;
            this._allMultItems[2].active = false;
            let bns_intro_2 = xNodeWBS.find("bns_intro_2", multPanel);
            bns_intro_2.active = true;
            bns_intro_2.getComponent(Animation).play();
            await this.delayTime(0.3)
            tween(this._allMultItems[0]).to(0.3, { eulerAngles: new Vec3(0, 0, 12) }).start()
            tween(this._allMultItems[1]).to(0.3, { eulerAngles: new Vec3(0, 0, 24) }).start()
            await this.delayTime(0.3)
            wbsgame.audioMgr.playSound("fsIntroEnd");
            xNodeWBS.setActive("SpriteSplash", this.node, false);
            tween(multPanel)
                .to(0.3, { position: new Vec3(0, 535, 0) })
                .start()
            resolve()
        })
    }

    clickPayoutPanel(event) {
        if (wbsgame.gameMgr.getState() == WBSSTATE.FREEING) {
            wbsgame.gamelayer.optCtrl.onClickStopBtn()
            return;
        }


        if (!this._canClickMultPanel) {
            return
        }
        let node = event.target;

        let wPos = event.getUILocation();
        let clickPos = node.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(wPos.x, wPos.y, 0));
        let col = -1, row = -1;
        let posX, posY;

        let listX = [-375, -250, -125, 0, 125, 250, 375];
        let index = listX.findIndex((value, index) => clickPos.x <= value && (index > 0 && clickPos.x >= listX[index - 1]));
        if (index > 0) {
            col = index - 1;
        }

        let bottomY = this.cellLayerCtrlList[col].node.position.y;
        for (let i = 0; i < 5; i++) {
            if (clickPos.y >= bottomY + WBSConstant.CELL_SIZE.height * i && clickPos.y <= bottomY + WBSConstant.CELL_SIZE.height * (i + 1)) {
                row = i;
                break;
            }
        }

        if (col >= 0 && row >= 0) {
            let cell = this.cellLayerCtrlList[col].getCellByRow(row);
            let showType = cell["type"] % 1000;
            let cell_ref = showType == WBSConstant.WILD_TYPE ? 80 : 60
            let refPos = node.getComponent(UITransform).convertToNodeSpaceAR(cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
            posX = col > 2 ? refPos.x - cell_ref : refPos.x + cell_ref;
            posY = refPos.y;

            if (showType == 0) {
                return
            }

            let panel = node.getChildByName("popup_payout");
            if (panel && panel.active) {
                panel.active = false;
            }
            if (!panel) {
                panel = instantiate(wbsgame.gamelayer.popupPayoutPrefab);
                node.addChild(panel);
                panel.name = "popup_payout";
                panel.on("click", this.onClickPayoutPanel, this);
            }

            wbsgame.audioMgr.playSound("clickCell");
            xNodeWBS.find("SpriteSplash", node).active = true;
            panel.active = true;
            panel.position = new Vec3(posX, posY, 0);

            let spr_icon = xNodeWBS.find("spr_icon", panel);
            let cellSp = xNodeWBS.find("cellSp", panel);
            let Label = xNodeWBS.find("Label", panel);
            let mults = xNodeWBS.find("mults", panel);
            if (showType < WBSConstant.WILD_TYPE) {
                spr_icon.active = true;
                cellSp.active = false;
                Label.active = false;
                mults.active = true;
                spr_icon.getComponent(Sprite).spriteFrame = wbsgame.gamelayer.CellSprNor[showType];
                xNodeWBS.setLabel("gold_3", mults, WBSConstant.PAYLOT_LIST[showType][0]);
                xNodeWBS.setLabel("gold_4", mults, WBSConstant.PAYLOT_LIST[showType][1]);
                xNodeWBS.setLabel("gold_5", mults, WBSConstant.PAYLOT_LIST[showType][2]);
                xNodeWBS.setLabel("gold_6", mults, WBSConstant.PAYLOT_LIST[showType][3]);
            } else {
                spr_icon.active = false;
                cellSp.active = true;
                Label.active = true;
                mults.active = false;
                cellSp.getComponent(sp.Skeleton).skeletonData = wbsgame.gamelayer.CellSp[showType];
                cellSp.getComponent(sp.Skeleton).setAnimation(0, "idle", true);

                let languageDict = WBSConfig.lang == "br" ? Pt : En;
                xNodeWBS.setLabel("", Label, languageDict[WBSConstant.PAYLOT_LIST[showType]]);
            }

            if (col < 3) {
                spr_icon.position = new Vec3(-cell_ref, 0, 0);
                cellSp.position = new Vec3(-cell_ref, 0, 0);
                Label.position = new Vec3(10, 2, 0);
                mults.position = new Vec3(6, 2, 0);
            } else {
                spr_icon.position = new Vec3(cell_ref, 0, 0);
                cellSp.position = new Vec3(cell_ref, 0, 0);
                Label.position = new Vec3(-140, 2, 0);
                mults.position = new Vec3(-110, 2, 0);
            }

            // this.unschedule(this.hideOnePayout);
            // this.scheduleOnce(this.hideOnePayout, 5);
        }
    }

    onClickPayoutPanel() {
        this.unschedule(this.hideOnePayout);
        this.hideOnePayout();
    }

    hideOnePayout() {
        xNodeWBS.find("node_payout/SpriteSplash", this.node).active = false;
        let mult_panel = xNodeWBS.find("node_payout/popup_payout", this.node);
        if (mult_panel) mult_panel.active = false;
    }


    update(dt) {
        if (this._startMove) {
            if (this._minIdleT > 0) {
                this._minIdleT -= dt;
            }
            if (this._minIdleT <= 0 && this._startLayerCnt == WBSConstant.COL_COUNT) {
                wbsgame.gameMgr.setRoundTime(wbsgame.gameMgr.getRoundTime() + dt);
                let canStop: IgetCanStop = wbsgame.gameMgr.getCanStop();
                if (canStop && canStop.state > 0) {
                    this._startMove = false;
                    if (canStop.state == 1) {
                        let specialList = wbsgame.gameMgr.getSpecialList();

                        this.cellLayerCtrlList.forEach((layerCtrl, idx) => {
                            let data = wbsgame.gameMgr.getResultData(wbsgame.gameMgr.getRollResult(), idx);
                            layerCtrl.setResultData(data);
                            layerCtrl.stopRoll(specialList[idx].antiCnt)
                        })
                    }
                }
            }
        }
    }
}
