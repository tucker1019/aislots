import { _decorator, instantiate, Vec3, tween, find, sp, Label, Node, UIOpacity, UITransform, Sprite, Color, isValid, Prefab, Tween, ParticleSystem2D, bezier, NodeEventType, Animation, math, view, Vec2, } from 'cc';
import { ftframe } from '../../../ftframe/ftframe';
import { xNodeFT } from '../../../xtools/xNodeFT';
import { onceRotateInfo } from '../../3rd/game_1017';
import { FTBaseNode } from '../../base/FTBaseNode';
import { longToNumber, showMoney } from '../../common/FTUtils';

import { FTConstant, FTSTATE, WINTYPE } from '../../FTConstant/FTConstant';
import FTLoadManager from '../../load/FTLoadManager';
import { FTGameManager, IgetCanStop } from '../../mgr/FTGameManager';
import { FTAudioMgr } from './FTAudioMgr';
import { FTCellItem } from './FTCellItem';
import { FTConfigCtrl } from './FTConfigCtrl';
import { FTGameLayerCtrl } from './FTGameLayerCtrl';
import { FTGlobal } from './FTGlobal';
import { FTLanguage } from './FTLanguage';
// import FTPopupCtrl from './FTPopupCtrl';
// import { FTTransitionCtrl } from './FTTransitionCtrl';
import type { OriginalAward } from '../../net/FTResultAdapter';
import { goSession } from '../../net/FTGoSession';
import { FTCellLayer } from './FTCellLayer';
import { FTBigWinCtrl } from './FTBigWinCtrl';

const { ccclass } = _decorator;

@ccclass('FTCenterRollCtrl')
export default class FTCenterRollCtrl extends FTBaseNode {

    private cellLayerCtrlList: FTCellLayer[] = [];

    layerCtrl: FTGameLayerCtrl = null;
    // popupCtrl: FTPopupCtrl = null;
    // transCtrl: FTTransitionCtrl = null;

    _startMove: boolean = false;// 是否开始旋转
    _canStop: boolean = false;// 可以停止
    _bStop: boolean = false;    // 是否已经开始停止
    _stopLayerCnt: number = 0;  //停止旋转的列个数--5列都停了才开始处理停止操作
    _startLayerCnt: number = 0; // 开始旋转的列个数--要等到5列都开始转才能停止
    _minIdleT: number = 0;  // 开始转动的额外空转时间

    _canCLickMultPanel = false; // 是否可以点击图标
    _avatarSp: sp.Skeleton = null;
    _hasPlayWildStop = false;

    protected initAttribute() {
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FTGameLayerCtrl);
        this._avatarSp = xNodeFT.findComponent("avatar", this.node, sp.Skeleton);
        this.playAvatarIdleAnim();

        this.node.getChildByName("node_mult").on(NodeEventType.TOUCH_END, this.clickMultPanel, this);
        this._canCLickMultPanel = true;
    }
    initLanguageView() {
    }
    start() {
        this.initAttribute();
        this.initLanguageView();
        this.creatRollItem();
    }

    private creatRollItem(index: number = null) {
        let nodeList = this.node.getChildByName("node_item_list");
        for (let index = 0; index < nodeList.children.length; index++) {
            let pNode = nodeList.children[index];
            let cellLayerCtrl = pNode.addComponent(FTCellLayer);
            cellLayerCtrl.init(index, this);
            cellLayerCtrl.creatOne();
            this.cellLayerCtrlList.push(cellLayerCtrl);
        }
    }

    resData() {
        this._startMove = false;
        this._canStop = true;
        this._bStop = false;
        this._stopLayerCnt = 0;
        this._startLayerCnt = 0;
        this._minIdleT = 0;
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.resData();
        })
        this._hasPlayWildStop = false;
    }

    // 初始化所有节点，即中线动画全部隐藏、top层的全部隐藏、卷轴层的全部显示为默认,且不置灰、
    initLight() {
        // FTAudioMgr.Instance.stopSound();
        this.unscheduleAllCallbacks();
        this.hideAllLineMoney();
        this.hideAllLine();
        this.hideAllKuang();
        this.hideAllCellTop();
        this.showSlotsGray(FTGameManager.isHaveBonus());
        // this.cellLayerCtrlList.forEach(layerCtrl => {
        //     layerCtrl.allCellList.forEach(node => {
        //         node.active = true;
        //     })
        // })
    }

    /**开始转动 */
    public startRotation() {
        ftframe.log.logView("startRotation");
        if (this._startMove) return
        this.unscheduleAllCallbacks();
        if (!FTAudioMgr.Instance.isMusicPlaying()) {
            FTAudioMgr.Instance.playMusic();
        }
        this._canCLickMultPanel = false;

        this.unschedule(this.hideOneMult);
        this.hideOneMult();

        FTGameManager.setStop(false);
        this.resData();
        this.initLight();
        this.showFreeKuangBgIdleAnim(false);

        this._startMove = true;
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.setStartMove();
        })

        let guang1: Animation = xNodeFT.findComponent("start_spin_guang_kuang", this.node, Animation);
        guang1.play();
    }

    // 开始旋转--回弹结束
    playStartRoll(index) {
        this._startLayerCnt += 1;

        if (!FTGameManager.getFast()) {
            this._minIdleT += 0.25;
        } else {
            this._minIdleT += 0.1;
        }
    }

    // 准备停止
    playReadyToStop(index) {

    }

    // 开始滚动回弹
    playBackRoll(index) {
        if (!this._hasPlayWildStop) {
            let data = FTGameManager.getResultData(index)
            for (let i = 0; i < FTConstant.ROW_COUNT; i++) {
                if (data[i] == FTConstant.WILD_TYPE) {
                    this._hasPlayWildStop = true;
                    FTAudioMgr.Instance.playSound("games/wild");
                }
            }

        }
    }

    // 停止转动
    playStopRoll(index) {
        this._stopLayerCnt += 1;
        if (this._stopLayerCnt == FTConstant.COL_COUNT) {
            this.oneRoundEnd();
        }
        this.hideTriFreeGuang();
    }

    private startRespinStage() {
        this.resData();
        this._startMove = true;
        this._canStop = true;
        for (const reel of this.cellLayerCtrlList) {
            reel.allCellList.forEach(node => { node.active = true; });
            reel.setStartMove();
        }
    }

    resumeRespin(step: number, symbols: number[]) {
        const data = FTGameManager.getRotateData();
        FTGameManager.setFreeIndex(step - 1);
        this._canCLickMultPanel = false;
        this.setIdleBoard(symbols);
        this.node.setScale(0.9, 0.9, 1);
        find("Canvas/GameLayer/bg").setScale(0.9, 0.9, 1);
        find("Canvas/GameLayer/bg/respin_bg").active = true;
        this.showFreeKuangBgIdleAnim(true);
        this.layerCtrl.optCtrl.showNorTitle(true, data.mFreeIconIdx);
        FTGameManager.setRandomList(data.mFreeIconIdx);
        FTAudioMgr.Instance.stopMusic();
        FTAudioMgr.Instance.playMusic("bgm_mg_b");
        this._avatarSp.setAnimation(0, "rs_idle", true);
        const mult = this._avatarSp.node.getChildByName("mult");
        mult.active = true;
        mult.setPosition(30, 216, 0);
        mult.setScale(0.9, 0.9, 1);
        mult.getComponent(UITransform).anchorPoint = new Vec2(0.5, 0.8);
        symbols.forEach((symbol, index) => {
            if (!symbol) return;
            const cell = this.playCellToTop(index, symbol);
            cell.active = true;
            cell.getComponent(FTCellItem).playIdleAnim();
        });
        for (const win of data.mAwardList ?? []) {
            if (win.mIconIdxs.every(id => symbols[id - 1])) this.playOneLine(win.flag_id - 1);
        }
        this.startRespinStage();
    }

    setIdleBoard(symbols = [3, 7, 5, 6, 7, 5, 6, 7, 2]) {
        for (let i = 0; i < symbols.length; i++) this.getCellByIdx(i)?.getComponent(FTCellItem).setTypeView(symbols[i]);
    }

    stopForConnectionError() {
        this._startMove = false;
        for (const reel of this.cellLayerCtrlList) {
            reel.resultData = [0, 0, 0];
            reel.resumeSpecial();
            reel._startMove = false;
        }
    }

    async oneRoundEnd() {
        ftframe.log.logView("oneRoundEnd")
        let rotateData: onceRotateInfo = null;
        rotateData = FTGameManager.getRotateData();
        let rotateDatas = FTGameManager.getRotateData(true);
        if (rotateData == null) {
            this.roundEnd();
            return
        }

        try {
            const step = FTGameManager.getFreeIndex() + 2;
            this.layerCtrl.reportReplayStep(step);
            await goSession.afterStop(step);
        } catch (error) {
            if (this.isValid) this.layerCtrl.goFailure(error);
            return;
        }
        if (!this.isValid) return;
        this._canCLickMultPanel = true;

        let awardList = rotateData.mAwardList;
        const multiplier = (rotateData as OriginalAward['mRotateData']).bonusMultiplier ?? (awardList?.length === 5 ? 10 : 1);
        if (rotateData.mIcons) {  // 普通游戏
            await this.playWildFlyAnim(rotateData.mIcons);

            if (awardList) {
                if (multiplier === 10) {
                    let type = rotateData.mIcons.find(value => value != FTConstant.WILD_TYPE);
                    if (!type) {
                        type = FTConstant.WILD_TYPE;
                    }

                    for (let i = 0; i < rotateData.mIcons.length; i++) {
                        let idx = i;
                        let cell = this.getCellByIdx(idx);
                        let type = cell.getComponent(FTCellItem).type;
                        let cellTop = this.playCellToTop(idx, type);
                        cellTop.active = true;
                        cellTop.getComponent(FTCellItem).playIdleAnim();
                    }

                    for (let i = 0; i < 5; i++) {
                        this.playOneLine(i);
                    }
                    this.showBottomWinFull(awardList, true)
                    await this.delayTime(0.5);
                    this.hideAllCellTop();
                    this.hideAllLine();
                    this.cellLayerCtrlList.forEach(layerCtrl => layerCtrl.node.active = false);
                    await this.playMultAnimNormal(type);
                    await this.showBottomWinFull(awardList, false);
                    await this.delayTime(1);
                    this.hideMultAnim();
                    this.cellLayerCtrlList.forEach(layerCtrl => layerCtrl.node.active = true);
                    this.showSlotsGray(true);
                    this.showWinTrace(awardList, awardList.length, multiplier);
                } else {
                    this.showSlotsGray(true);
                    this.showWinTrace(awardList, awardList.length, multiplier);
                    await this.showBottomWin(awardList);
                }
            }
        }

        FTGameManager.resOneRound();

        let freeList = rotateData.mFreeList;
        if (freeList && freeList.length > 0) {
            let freeIndex = FTGameManager.getFreeIndex();

            let mFreeIcons = freeList[freeIndex].mFreeIcons;
            for (let i = 0; i < mFreeIcons.length; i++) {
                if (mFreeIcons[i] != 0) {
                    let cellTop = this.playCellToTop(i, mFreeIcons[i]);
                    cellTop.active = true;
                    cellTop.getComponent(FTCellItem).playIdleAnim();
                }
            }
            if (awardList) {
                let lineEffId = -1;
                for (let i = 0; i < awardList.length; i++) {
                    if (mFreeIcons[awardList[i].mIconIdxs[0] - 1] && mFreeIcons[awardList[i].mIconIdxs[1] - 1] && mFreeIcons[awardList[i].mIconIdxs[2] - 1]) {
                        let flag_id = awardList[i].flag_id - 1;
                        let line = xNodeFT.find(`node_line/line${flag_id}`, this.node);
                        if (!line || !line.active) {
                            lineEffId = flag_id;
                            this.playOneLine(flag_id);
                        }
                    }
                }
                if (lineEffId >= 0) {
                    FTAudioMgr.Instance.playSound("games/re_result" + (lineEffId + 1));
                }

            }
            await this.delayTime(0.5);

            if (freeIndex == freeList.length - 1) {  // 最后一局
                if (awardList) {
                    if (multiplier === 10) {
                        let type = rotateData.mFreeIconIdx;
                        await this.playMultAnim(type)
                    }
                    await this.showBottomWin(awardList);
                    await this.delayTime(1);

                    this.cellLayerCtrlList.forEach(layerCtrl => {
                        layerCtrl.resumeSpecial();
                    })
                    this.showSlotsGray(true);
                    this.showWinTrace(awardList, awardList.length, multiplier);
                } else {
                    this.cellLayerCtrlList.forEach(layerCtrl => {
                        layerCtrl.resumeSpecial();
                    })
                }
                this.hideRespinFlyAnim();
                this.hideMultAnim();
                this.recoverToNormal();
                this._avatarSp.node.getChildByName("mult").active = false;

                this.playAvatarIdleAnim();


                // this.layerCtrl.optCtrl.showNorTitle(true);
                FTGameManager.setRandomList()


                FTAudioMgr.Instance.stopMusic();
                FTAudioMgr.Instance.playMusic();

                await this.delayTime(0.5);


            } else {

                this.layerCtrl.optCtrl.showNorTitle(true, rotateData.mFreeIconIdx);

                this.startRespinStage();
                return
            }
        } else {
            if (FTGameManager.getAudoNum() > 0) {
                await this.delayTime(0.3);
            }
        }

        this.roundEnd()
    }


    showWinTrace(awardList, index, multiplier = 1) {

        let playLine = (awardData, bShowMoney) => {
            let mIconIdxs = awardData.mIconIdxs;
            let money = longToNumber(awardData.mMoney);
            let flag_id = awardData.flag_id;

            for (let i = 0; i < mIconIdxs.length; i++) {
                let idx = mIconIdxs[i] - 1;
                let cell = this.getCellByIdx(idx);
                let type = cell.getComponent(FTCellItem).type;
                let cellTop = this.playCellToTop(idx, type);
                cellTop.active = true;
                cellTop.getComponent(FTCellItem).playWinAni(false);
                this.playKuang(idx);
            }

            this.playOneLine(flag_id - 1);
            if (bShowMoney) {
                this.playOneLineMoney(flag_id - 1, money / multiplier);
            }

            if (FTGameManager.isSpecialGame()) {
                FTAudioMgr.Instance.playSound("games/re_result" + flag_id);
            } else {
                FTAudioMgr.Instance.playSound("games/flashing")
            }
        }

        if (awardList) {
            this.hideAllLineMoney();
            this.hideAllLine();
            this.hideAllKuang();
            this.hideAllCellTop();
            if (index == awardList.length) {  // 总的
                for (let i = 0; i < awardList.length; i++) {
                    playLine(awardList[i], false);
                }
                this.scheduleOnce(() => this.showWinTrace(awardList, 0, multiplier), 2);
            } else {    // 单的
                playLine(awardList[index], true);
                this.scheduleOnce(() => this.showWinTrace(awardList, index + 1, multiplier), 2);
            }
        }

    }

    showBottomWin(awardList) {
        return new Promise<void>(async (resolve, reject) => {
            let roundWinMoney: number = 0;
            awardList.forEach(arardInfo => {
                roundWinMoney += longToNumber(arardInfo.mMoney);
            })

            let totalWin = roundWinMoney;
            let winType = FTGameManager.getWinType(roundWinMoney, FTGameManager.getTotalBitNum());
            this.playAvatarAnim(winType > 1 ? "winBig" : "winSmall")

            await this.checkBigWin(roundWinMoney);

            FTGameManager.setWinMoney(totalWin);
            this.layerCtrl.optCtrl.showNorTitle(false);
            this.layerCtrl.optCtrl.setAwardNum(totalWin, 0.5);
            FTAudioMgr.Instance.stopLongEffect("games/rolling");
            FTAudioMgr.Instance.playLongEffect("games/rolling");
            this.scheduleOnce(() => {
                FTAudioMgr.Instance.stopLongEffect("games/rolling");
            }, 0.5)

            resolve();
        })
    }

    showBottomWinFull(awardList, bHalf) {
        return new Promise<void>(async (resolve, reject) => {
            let roundWinMoney: number = 0;
            awardList.forEach(arardInfo => {
                roundWinMoney += longToNumber(arardInfo.mMoney);
            })
            if (bHalf) {
                let winType = FTGameManager.getWinType(roundWinMoney, FTGameManager.getTotalBitNum());
                this.playAvatarAnim(winType > 1 ? "winBig" : "winSmall")

                let totalWin = roundWinMoney / 10;
                FTGameManager.setWinMoney(totalWin);
                this.layerCtrl.optCtrl.showNorTitle(false);
                this.layerCtrl.optCtrl.setBigAwardNum(totalWin, 1);
                FTAudioMgr.Instance.stopLongEffect("games/rolling");
                FTAudioMgr.Instance.playLongEffect("games/rolling");
                this.scheduleOnce(() => {
                    FTAudioMgr.Instance.stopLongEffect("games/rolling");
                }, 0.5)
                resolve();
            } else {
                let totalWin = roundWinMoney;
                await this.checkBigWin(totalWin);
                FTGameManager.setWinMoney(totalWin);
                this.layerCtrl.optCtrl.setAwardNum(totalWin, 0.5);
                FTAudioMgr.Instance.stopLongEffect("games/rolling");
                FTAudioMgr.Instance.playLongEffect("games/rolling");
                this.scheduleOnce(() => {
                    FTAudioMgr.Instance.stopLongEffect("games/rolling");
                }, 0.5)
                resolve();
            }
        })
    }

    /**
     * 检查播放bigwin
     * @param coin 赢钱
     * @param bitNum 总压注
     * @param noDelayT 不播bigwin的延迟时常
     * @returns 
     */
    checkBigWin(coin: number, noDelayT: number = 0) {
        return new Promise<void>(async (resolve, reject) => {
            let bitNum = FTGameManager.getTotalBitNum()
            let bigWinType = FTGameManager.getBigWinType(coin, bitNum);
            if (!bigWinType) {
                this.scheduleOnce(() => { resolve() }, noDelayT)
                return
            }

            let endFunc = () => {
                resolve();
            }
            await this.delayTime(0.5);
            let node = xNodeFT.find("node_ani/big_win", this.layerCtrl.node);
            if (!node) {
                let prefab = FTLoadManager.ins.getPrefab("res/load/prefab/games/big_win");
                node = instantiate(prefab);
                node.parent = xNodeFT.find("node_ani", this.layerCtrl.node);
            }
            node.getComponent(FTBigWinCtrl).playBigWin(coin, bigWinType, endFunc);
        })
    }


    playWildFlyAnim(mIcons) {
        return new Promise<void>(async (resolve, reject) => {
            let hasPlay = false, playFly = false;
            let node_wildFly = this.node.getChildByName("node_wildFly");

            let playList = [6, 3, 0, 7, 4, 1, 8, 5, 2];
            for (let i = 0; i < playList.length; i++) {
                if (mIcons[playList[i]] == FTConstant.WILD_TYPE) {
                    hasPlay = true;
                    FTAudioMgr.Instance.playSound("games/fly");

                    let cell = this.getCellByIdx(playList[i]);
                    tween(cell)
                        .to(0.2, { scale: new Vec3(1.1, 1.1, 1.1) })
                        .to(0.2, { scale: new Vec3(1, 1, 1,) })
                        .start()

                    let node = FTLoadManager.ins.showGetPrefab("res/load/prefab/games/wild_fly", node_wildFly);
                    node.active = true;
                    node.position = node_wildFly.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(playList[i]));
                    let quan = node.getChildByName("quan");
                    quan.active = true;
                    let par = node.getChildByName("par");

                    let sPos = new Vec3(0, 0, 0);
                    let ePos = node.getComponent(UITransform).convertToNodeSpaceAR(this.getHBWPos());
                    let cPos = new Vec3(ePos.x - 300, ePos.y - 200, 0)
                    tween(par)
                        .to(0.35, { position: ePos }, {
                            "onUpdate": (target: Vec3, radio: number) => {
                                let sx = par.position.x as number;
                                let sy = par?.position.y as number;
                                let sz = par?.position.z as number;
                                let x = bezier(sx, sPos.x, cPos.x, ePos.x, radio);
                                let y = bezier(sy, sPos.y, cPos.y, ePos.y, radio);
                                // let z = bezier(sz, 0, 0, 0, radio);
                                par?.setPosition(new Vec3(x, y))
                            }
                        })
                        .call(() => {
                            FTAudioMgr.Instance.playSound("games/fly_end");
                            if (!playFly) {
                                playFly = true;

                                this.playAvatarAnim("wildCollect")
                            }

                        })
                        .delay(0.5)
                        .call(() => {
                            node.destroy();
                        })
                        .start()

                    await this.delayTime(0.1)
                }
            }

            if (hasPlay) {
                await this.delayTime(0.35)
            }
            resolve();
        })

    }


    /**
     * 节点播放动画时提到上层
     * @param index 0开始
     */
    playCellToTop(index, type) {
        let node_top = this.node.getChildByName("node_top");
        let cell = xNodeFT.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FTLoadManager.ins.getPrefab(FTConstant.PRAFAB_CELL_WIN));
            node_top.addChild(cell);
            cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(index));
            cell.name = `cell${index}`;
            cell.getComponent(FTCellItem).initTypeView(type);
        }
        if (cell.getComponent(FTCellItem).type !== type) {
            cell.getComponent(FTCellItem).setTypeView(type);
            cell.setSiblingIndex(FTConstant.PRAFAB_LIST[type].zIndex - index + 15);
        } else if (FTConstant.PRAFAB_LIST[type].jp_node) {
            cell.getComponent(FTCellItem).setTypeView(type);
        }
        // cell.active = true;
        return cell
    }
    copyCellToTop(ori_cell) {
        let node_top = this.node.getChildByName("node_top");
        let type = ori_cell.getComponent(FTCellItem).type;
        let index = ori_cell.getComponent(FTCellItem).index;
        let cell = xNodeFT.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FTLoadManager.ins.getPrefab(FTConstant.PRAFAB_CELL_WIN));
            node_top.addChild(cell);
            cell.name = `cell${index}`;
            cell.getComponent(FTCellItem).initTypeView(type);
        }
        cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(ori_cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
        cell.active = true;
        cell.getComponent(FTCellItem).setTypeView(type);
        cell.setSiblingIndex(FTConstant.PRAFAB_LIST[type].zIndex - index + 15);
        return cell
    }
    hideAllCellTop() {
        let node_top = this.node.getChildByName("node_top");
        if (node_top) {
            node_top.children.forEach(node => {
                node.children.forEach(node2 => {
                    node2.active = false;
                })
                node.active = false;
            })
        }
    }



    showSlotsGray(bShow) {
        let node = xNodeFT.find("mask", this.node);
        node && (node.active = bShow);
    }


    // 中线-线动画 flag_id--0开始
    playOneLine(flag_id: number) {
        let node_line = this.node.getChildByName("node_line");
        if (node_line) {
            let line = xNodeFT.find(`line${flag_id}`, node_line);
            if (!line) {
                line = instantiate(FTLoadManager.ins.getPrefab("res/load/prefab/games/win_payline"));
                node_line.addChild(line);
                line.position = new Vec3(0, ([0, 1, -1][flag_id] || 0) * 183, 0);
                line.eulerAngles = new Vec3(0, 0, [0, 0, 0, -45, 45][flag_id]);
                line.scale = new Vec3(flag_id < 3 ? 1.7 : 2, 1.7, 0);
                line.name = `line${flag_id}`;
            }
            line.active = true;
        }
        let num_line = xNodeFT.find("bg/win", this.node);
        if (num_line) {
            num_line.getChildByName("bg_payline" + (flag_id + 1) + "_0").active = true;
            num_line.getChildByName("bg_payline" + (flag_id + 1) + "_1").active = true;
        }
    }
    hideAllLine() {
        let node_line = this.node.getChildByName("node_line");
        if (node_line) {
            node_line.children.forEach(node => {
                node.active = false;
            })
        }
        let num_line = xNodeFT.find("bg/win", this.node);
        if (num_line) {
            num_line.children.forEach(node => {
                node.active = false;
            })
        }
    }

    //中线赢分 flag_id--0开始
    playOneLineMoney(flag_id: number, money: number) {
        let node_money = this.node.getChildByName("node_money");
        let mask = node_money.getChildByName(`mask_${flag_id > 2 ? 0 : flag_id}`);
        mask.active = true;
        xNodeFT.setLabel("num_info", mask, showMoney(money));
    }
    hideAllLineMoney() {
        let node_money = this.node.getChildByName("node_money");
        node_money.children.forEach(node => node.active = false);
    }

    /**
     * 中线框动画
     * @param idx 0开始
     */
    playKuang(idx: number) {
        let node_kuang = this.node.getChildByName("node_kuang");
        if (node_kuang) {
            let kuang = xNodeFT.find(`kuang${idx}`, node_kuang);
            if (!kuang) {
                kuang = instantiate(FTLoadManager.ins.getPrefab("res/load/prefab/games/win_kuang"));
                node_kuang.addChild(kuang);
                kuang.position = node_kuang.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(idx));
                kuang.name = `kuang${idx}`;
            }
            kuang.active = true;

            kuang.getComponent(Animation).play();
        }
    }
    hideAllKuang() {
        let node_kuang = this.node.getChildByName("node_kuang");
        if (node_kuang) {
            node_kuang.children.forEach(node => {
                node.active = false;
            })
        }
    }

    showCellMult() {


    }

    getHBWPos() {
        return xNodeFT.find("pos_hb", this._avatarSp.node).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0))
    }

    /**
     * 
     * @param idx 0开始
     */
    getWorldPosByIdx(idx: number): Vec3 {
        let col = idx % FTConstant.COL_COUNT;
        let row = Math.floor(idx / FTConstant.COL_COUNT);

        let y = FTConstant.CELL_SIZE.height * (row + 1 / 2);
        let pos = this.cellLayerCtrlList[col].getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, y, 0));
        return pos
    }

    // idx 0开始
    getCellByIdx(idx: number) {
        let col = idx % FTConstant.COL_COUNT;
        let row = Math.floor(idx / FTConstant.COL_COUNT);
        let node = this.cellLayerCtrlList[col]?.resultCell[row];
        return node;
    }





    clickMultPanel(event) {
        if (!this._canCLickMultPanel) {
            return
        }
        let node = event.target;

        let wPos = event.getUILocation();
        let clickPos = node.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(wPos.x, wPos.y, 0));
        let col, row;
        let posX, posY;
        if (clickPos.x < -117.5) {
            col = 0;
            posX = -150;
        } else if (clickPos.x < 117.5) {
            col = 1;
            posX = 70;
        } else {
            col = 2;
            posX = 150;
        }
        if (clickPos.y < -101.5) {
            row = 0;
            posY = -203;
        } else if (clickPos.y < 101.5) {
            row = 1;
            posY = 0;
        } else {
            row = 2;
            posY = 203;
        }

        let cellIdx = row * 3 + col;
        let cell = this.getCellByIdx(cellIdx);
        let type = cell?.getComponent(FTCellItem)?.type;

        if (!type) {
            return
        }

        let panel = node.getChildByName("mult_panel");
        if (panel && panel.active) {
            panel.active = false;
        }
        if (!panel) {
            panel = instantiate(FTLoadManager.ins.getPrefab("res/load/prefab/games/mult_panel"));
            node.addChild(panel);
            panel.name = "mult_panel";
            panel.on("click", this.onClickMultPanel, this);
        }

        xNodeFT.find("node_mult/SpriteSplash", this.node).active = true;
        panel.active = true;
        panel.position = new Vec3(posX, posY, 0)
        let num_red = panel.getChildByName("num_red");
        let num_yellow = panel.getChildByName("num_yellow");
        let cell_win = panel.getChildByName("cell_win");
        xNodeFT.setLabel("", num_red, "3");
        xNodeFT.setLabel("", num_yellow, FTConstant.PRAFAB_LIST[type].MULT);
        cell_win.children.forEach(node => node.active = false);
        let showSp: sp.Skeleton = xNodeFT.findComponent(FTConstant.PRAFAB_LIST[type].win_node, cell_win, sp.Skeleton);
        showSp.node.active = true;
        showSp.setAnimation(0, FTConstant.PRAFAB_LIST[type].idle_anim, false);

        if (col < 2) {
            num_red.position = new Vec3(43, 0, 0);
            num_yellow.position = new Vec3(126, 0, 0);
            cell_win.position = new Vec3(-85, -3, 0);
        } else {
            num_red.position = new Vec3(-160, 0, 0);
            num_yellow.position = new Vec3(-77, 0, 0);
            cell_win.position = new Vec3(85, -3, 0);
        }

        this.unschedule(this.hideOneMult);
        this.scheduleOnce(this.hideOneMult, 5);
    }

    onClickMultPanel() {
        this.unschedule(this.hideOneMult);
        this.hideOneMult();
    }

    hideOneMult() {
        xNodeFT.find("node_mult/SpriteSplash", this.node).active = false;
        let mult_panel = xNodeFT.find("node_mult/mult_panel", this.node);
        if (mult_panel) mult_panel.active = false;
    }



    setCanStop() {
        if (FTGameManager.getRotateData()) {
            if (FTGameManager.getRotateData().mFreeList) {
                this.playAvatarAnim("triSpecial");
                this._canStop = false;
                this.triFreeGameAnim(FTGameManager.getRotateData());
            } else {
                let random = Math.random();
                if (random < 0.05) {
                    //1.惊呆+生气 UI缩放
                    this.playAvatarAnim("triSpecialFail");

                    this._canStop = false;
                    this.triFreeGameFailAnim();
                } else if (random < 0.1) {
                    // 2.东张西望
                    this.playAvatarAnim("zw");
                    this._canStop = true;
                } else {
                    this._canStop = true;
                }
            }
        }
    }


    recoverToNormal() {
        FTAudioMgr.Instance.playSound("games/return");
        tween(this.node)
            .to(0.3, { scale: new Vec3(1, 1, 1) })
            .start()

        let bg = find("Canvas/GameLayer/bg");
        tween(bg)
            .to(0.5, { scale: new Vec3(1, 1, 1) })
            .start()
    }

    // 免费游戏触发动画--卷轴收缩--红包动画--免费图标
    async triFreeGameAnim(mRotateData) {
        if (mRotateData.mFreeIconIdx && mRotateData.mFreeList) {
            // FTGameManager.setState(FTSTATE.SPECIAL);

            FTAudioMgr.Instance.stopMusic();
            FTAudioMgr.Instance.playMusic("bgm_mg_b");

            FTAudioMgr.Instance.playSound("games/respin1");
            FTAudioMgr.Instance.playSound("games/respin2");

            this.layerCtrl.optCtrl.showNorTitle(true, "triFree");

            tween(this.node)
                .to(0.3, { scale: new Vec3(0.9, 0.9, 1) })
                .start()

            let bg = find("Canvas/GameLayer/bg");
            tween(bg)
                .to(0.5, { scale: new Vec3(0.9, 0.9, 1) })
                .start()

            let hongbao = xNodeFT.find("hongbao", this.node);
            hongbao.active = true;
            hongbao.children.forEach((node) => {
                node.active = false;
            })

            let hongbao_guan = hongbao.getChildByName("hongbao")
            hongbao_guan.active = true;
            hongbao_guan.position = hongbao.getComponent(UITransform).convertToNodeSpaceAR(this.getHBWPos())
            hongbao_guan.scale = new Vec3(0.3, 0.3, 0);
            hongbao_guan.eulerAngles = new Vec3(0, 0, 22);


            tween(hongbao_guan)
                .to(0.5, { position: new Vec3(0, 0, 0), eulerAngles: new Vec3(0, 0, 0), scale: new Vec3(1, 1, 1) })
                .parallel(
                    tween().by(0.05, { position: new Vec3(10, 0, 0) })
                        .by(0.05, { position: new Vec3(-20, 0, 0) })
                        .by(0.05, { position: new Vec3(20, 0, 0) })
                        .by(0.05, { position: new Vec3(-20, 0, 0) })
                        .by(0.05, { position: new Vec3(20, 0, 0) })
                        .by(0.05, { position: new Vec3(-20, 0, 0) })
                        .by(0.05, { position: new Vec3(20, 0, 0) })
                        .by(0.05, { position: new Vec3(-20, 0, 0) }),
                    tween().to(0.4, { scale: new Vec3(1, 1.2, 1) })
                )

                .start()

            await this.delayTime(0.95)
            hongbao_guan.active = false;

            let hongbao_open = hongbao.getChildByName("hongbao_open");
            hongbao_open.active = true;
            hongbao_open.scale = new Vec3(1, 1.3, 1);
            tween(hongbao_open)
                .to(0.4, { scale: new Vec3(0.7, 0.9, 0) })
                .start()
            let hongbao_open_opa = hongbao.getChildByName("hongbao_open").getComponent(UIOpacity);
            hongbao_open_opa.opacity = 255;
            tween(hongbao_open_opa)
                .to(0.4, { opacity: 110 })
                .to(0.1, { opacity: 0 })
                .call(() => {
                    hongbao_open.active = false;
                })
                .start()


            FTAudioMgr.Instance.playSound("games/respin3");
            let cell_win = hongbao.getChildByName("cell_win");
            let cell_win_opa = hongbao.getChildByName("cell_win").getComponent(UIOpacity);
            cell_win.active = true;
            cell_win.children.forEach(node => node.active = false);
            let showSp: sp.Skeleton = xNodeFT.findComponent(FTConstant.PRAFAB_LIST[mRotateData.mFreeIconIdx].win_node, cell_win, sp.Skeleton);
            showSp.node.active = true;
            showSp.setAnimation(0, FTConstant.PRAFAB_LIST[mRotateData.mFreeIconIdx].idle_anim, false);


            cell_win.position = new Vec3(0, 246, 0);
            tween(cell_win)
                .to(0.5, { position: new Vec3(0, 80, 0), scale: new Vec3(0.8, 0.8, 0.8) }, { easing: "backOut" })
                .start()

            cell_win_opa.opacity = 0
            tween(cell_win_opa)
                .to(0.2, { opacity: 255 })
                .start()


            await this.delayTime(0.4)
            let xxing = hongbao.getChildByName("xxing");
            xxing.position = new Vec3(0, 80, 0)
            xxing.active = true;
            xxing.getComponent(Animation).play("respin_hb_xx")

            await this.delayTime(0.3)

            FTGameManager.setRandomList(mRotateData.mFreeIconIdx)

            await this.delayTime(0.2)
            xxing.active = false;
            cell_win.active = false;
            hongbao.active = false;

            let mult = this._avatarSp.node.getChildByName("mult");
            mult.active = true;
            mult.position = new Vec3(30, 216, 0);
            mult.getComponent(UITransform).anchorPoint = new Vec2(0.5, 0.8);
            mult.getChildByName("mult_vfx_a_screen").active = true;
            mult.getChildByName("mult_vfx_b_add").active = true;
            mult.scale = new Vec3(0.5, 0.5, 1)
            tween(mult)
                .to(0.3, { scale: new Vec3(0.9, 0.9, 1) })
                .call(() => {
                    mult.getChildByName("mult_vfx_a_screen").active = false;
                    mult.getChildByName("mult_vfx_b_add").active = false;
                })
                .start()

            FTAudioMgr.Instance.playSound("games/respin4");
            this.playRespinFlyAnim();
            await this.delayTime(0.5)

            this.showFreeKuangBgIdleAnim(true);
            this.showTriFreeGuang();

            this._minIdleT += 2;
            this._canStop = true;
        }
    }


    triFreeGameFailAnim() {
        FTAudioMgr.Instance.playSound("games/respin2");
        tween(this.node)
            .delay(0.3)
            .to(0.5, { scale: new Vec3(0.95, 0.95, 1) })
            .delay(0.5)
            .to(0.5, { scale: new Vec3(1, 1, 1) })
            .start()

        let bg = find("Canvas/GameLayer/bg");
        tween(bg)
            .delay(0.3)
            .to(0.5, { scale: new Vec3(0.95, 0.95, 1) })
            .delay(0.5)
            .call(() => {
                FTAudioMgr.Instance.playSound("games/return");
                this.playAvatarAnim("triSpecialFailBack")
            })
            .to(0.5, { scale: new Vec3(1, 1, 1) })
            .call(() => {
                this._canStop = true;
            })
            .start()
    }


    playRespinFlyAnim() {
        let respin_bg = find("Canvas/GameLayer/bg/respin_bg");
        respin_bg.active = true;

        let guang1Opa: UIOpacity = xNodeFT.findComponent("respin_vfx_b_add", respin_bg, UIOpacity);
        guang1Opa.node.active = true;
        guang1Opa.opacity = 0;
        tween(guang1Opa)
            .to(0.5, { opacity: 255 })
            .start()
        let guang2Anim: Animation = xNodeFT.findComponent("respin_vfx_r_add_00", respin_bg, Animation);
        guang2Anim.node.active = true;
        guang2Anim.play("respin_bg_r");
        let guang3Anim: Animation = xNodeFT.findComponent("respin_vfx_c_add_00", respin_bg, Animation);
        guang3Anim.node.active = true;
        guang3Anim.play("respin_bg_c");
        let guang4Anim: Animation = xNodeFT.findComponent("respin_vfx_h_screen_00", respin_bg, Animation);
        guang4Anim.node.active = true;
        guang4Anim.play("respin_bg_h");

        let node_fly = xNodeFT.find("node_anti/fly", this.node);
        for (let i = 0; i < 3; i++) {
            let fly = FTLoadManager.ins.showGetPrefab("res/load/prefab/games/respin_fly", node_fly);
            fly.active = true;

            let sPos = fly.getComponent(UITransform).convertToNodeSpaceAR(this._avatarSp.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
            let ePos = new Vec3([-226, 0, 226][i], 304.5, 0);

            let flyAni = tween().to(0.5, { position: ePos }, {
                "onUpdate": (target: Node, radio: number) => {
                    let sx = target.position.x as number;
                    let sy = target?.position.y as number;
                    let sz = target?.position.z as number;
                    let x = bezier(sx, sPos.x, [sPos.x - 100, 0, sPos.x + 100][i], ePos.x, radio);
                    let y = bezier(sy, sPos.y, sPos.y + 500, ePos.y, radio);
                    // let z = bezier(sz, 0, 0, 0, radio);
                    target?.setPosition(new Vec3(x, y))
                }
            })

            let par = fly.getChildByName("par");
            let spr = fly.getChildByName("spr");
            par.position = sPos;
            spr.position = sPos;
            flyAni.clone(par).start();
            flyAni.clone(spr).delay(0.3).call(() => { fly.destroy() }).start();
        }
    }
    hideRespinFlyAnim() {
        let respin_bg = find("Canvas/GameLayer/bg/respin_bg");
        respin_bg.active = false;
        respin_bg.children.forEach((node) => { node.active = false; })
    }


    showTriFreeGuang() {
        let node_guang = xNodeFT.find("node_anti/guang", this.node);
        if (node_guang.children.length > 0) {
            node_guang.children.forEach((node) => { node.active = true })
        } else {
            for (let i = 0; i < 3; i++) {
                let guang = FTLoadManager.ins.showGetPrefab("res/load/prefab/games/respin_line_guang", node_guang);
                guang.position = new Vec3([-226, 0, 226][i], 0, 0);
            }
        }
    }
    hideTriFreeGuang() {
        let node_guang = xNodeFT.find("node_anti/guang", this.node);
        if (node_guang.children.length > 0) {
            node_guang.children.forEach((node) => { node.active = false })
        }
    }

    showFreeKuangBgIdleAnim(bShow) {
        let node = xNodeFT.find("bg/respin_bg_idle", this.node);
        node.active = bShow;
    }


    playMultAnimNormal(type?) {

        return new Promise<void>(async (resolve, reject) => {
            if (type) {
                let node_qp_mult = this.node.getChildByName("node_qp_mult");
                node_qp_mult.active = true;

                let qpOpa: UIOpacity = xNodeFT.findComponent("", node_qp_mult, UIOpacity);
                qpOpa.opacity = 0;
                tween(qpOpa)
                    .to(0.1, { opacity: 255 })
                    .start()

                node_qp_mult.getChildByName("mask").active = true;

                FTAudioMgr.Instance.playSound("games/x10sound1");
                let win_kuang = node_qp_mult.getChildByName("win_kuang");
                win_kuang.active = true;
                win_kuang.getComponent(Animation).play("win_kuang_bg_big");

                let cell_win = node_qp_mult.getChildByName("cell_win");
                cell_win.active = true;
                cell_win.children.forEach(node => node.active = false);
                let showSp: sp.Skeleton = xNodeFT.findComponent(FTConstant.PRAFAB_LIST[type].win_node, cell_win, sp.Skeleton);
                showSp.node.active = true;
                showSp.setAnimation(0, FTConstant.PRAFAB_LIST[type].win_anim, false);
            }

            await this.delayTime(0.5);

            FTAudioMgr.Instance.playSound("games/x10sound2");
            let mult = this._avatarSp.node.getChildByName("mult");
            mult.active = true;
            mult.position = this._avatarSp.node.getChildByName("pos_hb").position;
            mult.scale = new Vec3(0, 0, 0);
            mult.getComponent(UITransform).anchorPoint = new Vec2(0.5, 0.5);

            tween(mult)
                .to(0.3, { scale: new Vec3(0.7, 0.7, 0.7) })
                .delay(0.2)
                .call(() => {
                    mult.getChildByName("mult_vfx_a_screen").active = false;
                    mult.getChildByName("mult_vfx_b_add").active = false;
                })
                .start()


            await this.delayTime(0.8);

            FTAudioMgr.Instance.playSound("games/x10sound3");
            let newMult = instantiate(mult);
            mult.active = false;
            newMult.parent = this.node.parent;
            newMult.position = this.node.parent.getComponent(UITransform).convertToNodeSpaceAR(mult.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));

            let node_win = this.layerCtrl.optCtrl.node_win_big;
            let endPos = this.node.parent.getComponent(UITransform).convertToNodeSpaceAR(node_win.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
            tween(newMult)
                .to(0.5, { position: endPos, scale: new Vec3(0, 0, 0) })
                .call(() => {
                    newMult.destroy();
                })
                .start();

            // await this.delayTime(0.3)
            resolve();
        });
    }

    // 全屏-赢10倍动画
    playMultAnim(type?) {
        return new Promise<void>(async (resolve, reject) => {
            if (type) {
                let node_qp_mult = this.node.getChildByName("node_qp_mult");
                node_qp_mult.active = true;
                node_qp_mult.children.forEach((node) => {
                    node.active = false;
                })

                let qpOpa: UIOpacity = xNodeFT.findComponent("", node_qp_mult, UIOpacity);
                qpOpa.opacity = 0;
                tween(qpOpa)
                    .to(0.1, { opacity: 255 })
                    .start()

                node_qp_mult.getChildByName("mask").active = true;

                FTAudioMgr.Instance.playSound("games/x10sound1");
                // this.showSlotsGray(true);
                let win_kuang = node_qp_mult.getChildByName("win_kuang");
                win_kuang.active = true;
                win_kuang.getComponent(Animation).play("win_kuang_bg_big");

                let cell_win = node_qp_mult.getChildByName("cell_win");
                cell_win.active = true;
                cell_win.children.forEach(node => node.active = false);
                let showSp: sp.Skeleton = xNodeFT.findComponent(FTConstant.PRAFAB_LIST[type].win_node, cell_win, sp.Skeleton);
                showSp.node.active = true;
                showSp.setAnimation(0, FTConstant.PRAFAB_LIST[type].win_anim, false);
            }
            await this.delayTime(0.5);

            FTAudioMgr.Instance.playSound("games/x10sound2");
            let mult = this._avatarSp.node.getChildByName("mult");
            mult.active = true;
            mult.position = new Vec3(30, 216, 0);
            mult.scale = new Vec3(0.9, 0.9, 1);
            mult.getComponent(UITransform).anchorPoint = new Vec2(0.5, 0.8);

            tween(mult)
                .to(0.3, { scale: new Vec3(1.1, 1.1, 1), position: new Vec3(30, 284, 0) })
                .start()

            await this.delayTime(0.5);
            FTAudioMgr.Instance.playSound("games/x10sound3");
            let newMult = instantiate(mult);
            mult.active = false;
            newMult.parent = this.node.parent;
            newMult.position = this.node.parent.getComponent(UITransform).convertToNodeSpaceAR(mult.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));

            let node_win = this.layerCtrl.optCtrl.node_win_big;
            let endPos = this.node.parent.getComponent(UITransform).convertToNodeSpaceAR(node_win.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
            tween(newMult)
                .to(0.5, { position: endPos, scale: new Vec3(0, 0, 0) })
                .call(() => {
                    newMult.destroy();
                })
                .start();

            // await this.delayTime(0.5)
            resolve();
        })
    }

    hideMultAnim() {
        let node_qp_mult = this.node.getChildByName("node_qp_mult");
        node_qp_mult.active = false;
    }


    playAvatarAnim(type) {

        if (type == "triSpecial") { // 触发特殊
            Tween.stopAllByTarget(this._avatarSp);
            this._avatarSp.setAnimation(0, "rs_start", false);
            this._avatarSp.addAnimation(0, "rs_idle", true);
        } else if (type == "triSpecialFail") {    // 触发特殊失败--回到idle
            Tween.stopAllByTarget(this._avatarSp);
            this._avatarSp.setAnimation(0, "zo_start", false);
            this._avatarSp.addAnimation(0, "zo_idle", false);
        } else if (type == "triSpecialFailBack") {
            Tween.stopAllByTarget(this._avatarSp);
            FTAudioMgr.Instance.playSound("games/COOL");
            let entry = this._avatarSp.setAnimation(0, "zo_exit", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "zw") {  // 东张西望
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "idle5", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "wildCollect") { // wild图标收集
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "wild_collect", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "winSmall") {    // 小赢
            let effName = ["NICE", "YEAH"][Math.floor(Math.random() * 2)];
            FTAudioMgr.Instance.stopLongEffect("games/NICE");
            FTAudioMgr.Instance.stopLongEffect("games/YEAH");
            FTAudioMgr.Instance.playLongEffect("games/" + effName);
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "win", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "winBig") {  // 大赢
            // let effL = ["NICE", "YEAH"];
            // FTAudioMgr.Instance.playSound("games/" + effL[Math.floor(Math.random() * effL.length)]);
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "win2", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })

        }

    }

    playAvatarIdleAnim() {
        Tween.stopAllByTarget(this._avatarSp)
        this._avatarSp.setAnimation(0, "idle", true);
        let delayTime = 10 + Math.random() * 15;
        tween(this._avatarSp)
            .repeatForever(
                tween()
                    .delay(delayTime)
                    .call(() => {
                        delayTime = 10 + Math.random() * 15

                        let animType = Math.floor(Math.random() * 3) + 2;
                        this._avatarSp.setAnimation(0, "idle" + animType, false);
                        this._avatarSp.addAnimation(0, "idle", true);

                        if (animType == 4) {
                            FTAudioMgr.Instance.playSound("games/OH");
                        }
                    })
            )
            .start()
    }


    roundEnd() {
        ftframe.log.logView("round end");
        if (goSession.balance !== undefined) FTGlobal.USER.gold = goSession.balance;
        this.layerCtrl.setAllNum();
        this.layerCtrl.optCtrl.setAllNum();
        this.layerCtrl.optCtrl.canSendSpin = true;
        FTGameManager.restRound();
        FTGameManager.setAudoNum(FTGameManager.getAudoNum() - 1)
        if (goSession.replay) this.layerCtrl.finishReplay();
        else this.layerCtrl.optCtrl.checkAudo();
        FTGameManager.setWinAllMoney(0)
       
        this._canCLickMultPanel = true;
    }

    update(dt) {
        if (this._startMove) {
            if (this._minIdleT > 0) {
                this._minIdleT -= dt;
            }

            if (this._minIdleT <= 0 /*&& !this._bStop*/ && this._startLayerCnt == FTConstant.COL_COUNT && this._canStop) {
                FTGameManager.setRoundTime(FTGameManager.getRoundTime() + dt);
                let canStop: IgetCanStop = FTGameManager.getCanStop();
                if (canStop && canStop.state > 0 && this._canStop) {
                    // this._bStop = true;
                    this._startMove = false;
                    if (canStop.state == 1) {
                        this.cellLayerCtrlList.forEach((layerCtrl, idx) => {
                            layerCtrl.setResultData(FTGameManager.getResultData(idx));
                            layerCtrl.setDelayT(FTGameManager.getNormalDelayT(idx));
                            layerCtrl.setStopMove(true);
                        })
                    } else {
                        this.cellLayerCtrlList.forEach((layerCtrl, idx) => {
                            layerCtrl.setResultData([]);
                            layerCtrl.setDelayT(idx * 0.05 * 5);
                            layerCtrl.setStopMove(true);
                        })
                        this.scheduleOnce(() => {
                            FTLoadManager.ins.showAlertWithInit(FTConfigCtrl.Instance.getLanguageText(FTLanguage.NONET), () => { })
                        }, 1)
                    }
                }
                // }
            }

        }
    }
}