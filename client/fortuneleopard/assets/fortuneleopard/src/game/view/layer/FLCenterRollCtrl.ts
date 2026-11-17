import { _decorator, instantiate, Vec3, tween, find, sp, Label, Node, UIOpacity, UITransform, Sprite, Color, isValid, Prefab, Tween, ParticleSystem2D, bezier, NodeEventType, Animation, math, view, Vec2, } from 'cc';
import { flframe } from '../../../flframe/flframe';
import { xNodeFL } from '../../../xtools/xNodeFL';
import type { RotateData } from '../../net/FLResultAdapter';
import { FLBaseNode } from '../../base/FLBaseNode';
import { longToNumber, showMoney } from '../../common/FLUtils';

import { FLConstant, FLSTATE, WINTYPE } from '../../FLConstant/FLConstant';
import FLLoadManager from '../../load/FLLoadManager';
import { FLGameManager, IgetCanStop } from '../../mgr/FLGameManager';
import { FLAudioMgr } from './FLAudioMgr';
import { FLCellItem } from './FLCellItem';
import { FLConfigCtrl } from './FLConfigCtrl';
import { FLGameLayerCtrl } from './FLGameLayerCtrl';
import { FLGlobal } from './FLGlobal';
import { FLLanguage } from './FLLanguage';
// import FLPopupCtrl from './FLPopupCtrl';
// import { FLTransitionCtrl } from './FLTransitionCtrl';
import type { OriginalAward } from '../../net/FLResultAdapter';
import { goSession } from '../../net/FLGoSession';
import { FLCellLayer } from './FLCellLayer';
import { FLBigWinCtrl } from './FLBigWinCtrl';

// Reel positions in the same order as AG9's five pay lines.
const RESPIN_LINES = [[3, 4, 5], [6, 7, 8], [0, 1, 2], [6, 4, 2], [0, 4, 8]];

const { ccclass } = _decorator;

@ccclass('FLCenterRollCtrl')
export default class FLCenterRollCtrl extends FLBaseNode {

    private cellLayerCtrlList: FLCellLayer[] = [];

    layerCtrl: FLGameLayerCtrl = null;
    // popupCtrl: FLPopupCtrl = null;
    // transCtrl: FLTransitionCtrl = null;

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
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FLGameLayerCtrl);
        this._avatarSp = xNodeFL.findComponent("avatar", this.node, sp.Skeleton);
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
            let cellLayerCtrl = pNode.addComponent(FLCellLayer);
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
        // FLAudioMgr.Instance.stopSound();
        this.unscheduleAllCallbacks();
        this.hideAllLineMoney();
        this.hideAllLine();
        this.hideAllKuang();
        this.hideAllCellTop();
        this.showSlotsGray(FLGameManager.isHaveBonus());
        // this.cellLayerCtrlList.forEach(layerCtrl => {
        //     layerCtrl.allCellList.forEach(node => {
        //         node.active = true;
        //     })
        // })
    }

    /**开始转动 */
    public startRotation() {
        flframe.log.logView("startRotation");
        if (this._startMove) return
        this.unscheduleAllCallbacks();
        if (!FLAudioMgr.Instance.isMusicPlaying()) {
            FLAudioMgr.Instance.playMusic();
        }
        this._canCLickMultPanel = false;

        this.unschedule(this.hideOneMult);
        this.hideOneMult();

        FLGameManager.setStop(false);
        this.resData();
        this.initLight();
        this.showFreeKuangBgIdleAnim(false);
        this.playStartKuangGuangAnim();

        this._startMove = true;
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.setStartMove();
        })
    }

    // 开始旋转--回弹结束
playStartKuangGuangAnim() {
        let guang1: sp.Skeleton = xNodeFL.findComponent("sb_vfx_e_add", this.node, sp.Skeleton);
        guang1.node.active = true;
        guang1.setAnimation(0, "animation", false);
    }

    playStartRoll(index) {
        this._startLayerCnt += 1;

        if (!FLGameManager.getFast()) {
            this._minIdleT += 0.3;
        } else {
            this._minIdleT += 0.13;
        }
    }

    // 准备停止
    playReadyToStop(index) {

    }

    // 开始滚动回弹
    playBackRoll(index) {
        if (!this._hasPlayWildStop) {
            let data = FLGameManager.getResultData(index)
            for (let i = 0; i < FLConstant.ROW_COUNT; i++) {
                if (data[i] == FLConstant.WILD_TYPE) {
                    this._hasPlayWildStop = true;
                    FLAudioMgr.Instance.playSound("games/wild");
                }
            }

        }
    }

    // 停止转动
    playStopRoll(index) {
        this._stopLayerCnt += 1;
        if (this._stopLayerCnt == FLConstant.COL_COUNT) {
            this.oneRoundEnd();
        }
        this.hideTriFreeGuang();
    }

    private startRespinStage() {
        this.resData();
        this._startMove = true;
        this._canStop = goSession.replay;
        for (const reel of this.cellLayerCtrlList) {
            reel.allCellList.forEach(node => { node.active = true; });
            reel.setStartMove();
        }
        if (!goSession.replay) void this.layerCtrl.requestNextRespin();
    }

    resumeRespin(symbols: number[]) {
        const data = FLGameManager.getRotateData();
        FLGameManager.setFreeIndex(0);
        this._canCLickMultPanel = false;
        this.setIdleBoard(symbols);
        this.node.setScale(0.9, 0.9, 1);
        find("Canvas/GameLayer/bg").setScale(0.9, 0.9, 1);
        find("Canvas/GameLayer/bg/respin_bg").active = true;
        this.showFreeKuangBgIdleAnim(true);
        this.layerCtrl.optCtrl.showNorTitle(true, data.mFreeIconIdx);
        FLGameManager.setRandomList(data.mFreeIconIdx);
        FLAudioMgr.Instance.stopMusic();
        FLAudioMgr.Instance.playMusic("bgm_mg_b");
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
            cell.getComponent(FLCellItem).playIdleAnim();
        });
        this.showRespinLines(symbols, false);
        this.startRespinStage();
    }

    setIdleBoard(symbols = [3, 7, 5, 6, 7, 5, 6, 7, 2]) {
        for (let i = 0; i < symbols.length; i++) this.getCellByIdx(i)?.getComponent(FLCellItem).setTypeView(symbols[i]);
    }

    stopForConnectionError() {
        this._startMove = false;
        for (const reel of this.cellLayerCtrlList) {
            // Include the offscreen top symbol required by resumeSpecial().
            reel.setResultData([0, 0, 0]);
            reel.resumeSpecial();
            reel._startMove = false;
        }
    }

    async oneRoundEnd() {
        flframe.log.logView("oneRoundEnd")
        let rotateData: RotateData = null;
        rotateData = FLGameManager.getRotateData();
        if (rotateData == null) {
            this.roundEnd();
            return;
        }
        this.layerCtrl.reportReplayStep(FLGameManager.getFreeIndex() + 2);
        this._canCLickMultPanel = true;

        let awardList = rotateData.mAwardList;
        const multiplier = (rotateData as OriginalAward['mRotateData']).bonusMultiplier ?? (awardList?.length === 5 ? 10 : 1);
        if (rotateData.mIcons) {  // 普通游戏
            await this.playWildFlyAnim(rotateData.mIcons);

            if (awardList) {
                if (multiplier === 10) {
                    let type = rotateData.mIcons.find(value => value != FLConstant.WILD_TYPE);
                    if (!type) {
                        type = FLConstant.WILD_TYPE;
                    }

                    for (let i = 0; i < rotateData.mIcons.length; i++) {
                        let idx = i;
                        let cell = this.getCellByIdx(idx);
                        let type = cell.getComponent(FLCellItem).type;
                        let cellTop = this.playCellToTop(idx, type);
                        cellTop.active = true;
                        cellTop.getComponent(FLCellItem).playIdleAnim();
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

        FLGameManager.resOneRound();

        let freeList = rotateData.mFreeList;
        if (freeList && freeList.length > 0) {
            let freeIndex = FLGameManager.getFreeIndex();

            let mFreeIcons = freeList[freeIndex].mFreeIcons;
            for (let i = 0; i < mFreeIcons.length; i++) {
                if (mFreeIcons[i] != 0) {
                    let cellTop = this.playCellToTop(i, mFreeIcons[i]);
                    cellTop.active = true;
                    cellTop.getComponent(FLCellItem).playIdleAnim();
                }
            }
            this.showRespinLines(mFreeIcons, true);
            await this.delayTime(0.5);

            const hasNext = goSession.replay ? freeIndex < freeList.length - 1 : goSession.hasNextRespin;
            if (!hasNext) {
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
                FLGameManager.setRandomList()


                FLAudioMgr.Instance.stopMusic();
                FLAudioMgr.Instance.playMusic();

                await this.delayTime(0.5);


            } else {

                this.layerCtrl.optCtrl.showNorTitle(true, rotateData.mFreeIconIdx);

                this.startRespinStage();
                return
            }
        } else {
            if (FLGameManager.getAudoNum() > 0) {
                await this.delayTime(0.3);
            }
        }

        this.roundEnd()
    }


    private showRespinLines(symbols: number[], sound: boolean) {
        let last = -1;
        RESPIN_LINES.forEach((positions, index) => {
            if (!positions.every(pos => symbols[pos] !== 0)) return;
            if (xNodeFL.find(`node_line/line${index}`, this.node)?.active) return;
            this.playOneLine(index);
            last = index;
        });
        if (sound && last >= 0) FLAudioMgr.Instance.playSound('games/re_result' + (last + 1));
    }

    showWinTrace(awardList, index, multiplier = 1) {

        let playLine = (awardData, bShowMoney) => {
            let mIconIdxs = awardData.mIconIdxs;
            let money = longToNumber(awardData.mMoney);
            let flag_id = awardData.flag_id;

            for (let i = 0; i < mIconIdxs.length; i++) {
                let idx = mIconIdxs[i] - 1;
                let cell = this.getCellByIdx(idx);
                let type = cell.getComponent(FLCellItem).type;
                let cellTop = this.playCellToTop(idx, type);
                cellTop.active = true;
                cellTop.getComponent(FLCellItem).playWinAni(false);
                this.playKuang(idx);
            }

            this.playOneLine(flag_id - 1);
            if (bShowMoney) {
                this.playOneLineMoney(flag_id - 1, money / multiplier);
            }

            if (FLGameManager.isSpecialGame()) {
                FLAudioMgr.Instance.playSound("games/re_result" + flag_id);
            } else {
                FLAudioMgr.Instance.playSound("games/flashing")
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
            let winType = FLGameManager.getWinType(roundWinMoney, FLGameManager.getTotalBitNum());
            this.playAvatarAnim(winType > 1 ? "winBig" : "winSmall")

            await this.checkBigWin(roundWinMoney);

            FLGameManager.setWinMoney(totalWin);
            this.layerCtrl.optCtrl.showNorTitle(false);
            this.layerCtrl.optCtrl.setAwardNum(totalWin, 0.5);
            FLAudioMgr.Instance.stopLongEffect("games/rolling");
            FLAudioMgr.Instance.playLongEffect("games/rolling");
            this.scheduleOnce(() => {
                FLAudioMgr.Instance.stopLongEffect("games/rolling");
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
                let winType = FLGameManager.getWinType(roundWinMoney, FLGameManager.getTotalBitNum());
                this.playAvatarAnim(winType > 1 ? "winBig" : "winSmall")

                let totalWin = roundWinMoney / 10;
                FLGameManager.setWinMoney(totalWin);
                this.layerCtrl.optCtrl.showNorTitle(false);
                this.layerCtrl.optCtrl.setBigAwardNum(totalWin, 1);
                FLAudioMgr.Instance.stopLongEffect("games/rolling");
                FLAudioMgr.Instance.playLongEffect("games/rolling");
                this.scheduleOnce(() => {
                    FLAudioMgr.Instance.stopLongEffect("games/rolling");
                }, 0.5)
                resolve();
            } else {
                let totalWin = roundWinMoney;
                await this.checkBigWin(totalWin);
                FLGameManager.setWinMoney(totalWin);
                this.layerCtrl.optCtrl.setAwardNum(totalWin, 0.5);
                FLAudioMgr.Instance.stopLongEffect("games/rolling");
                FLAudioMgr.Instance.playLongEffect("games/rolling");
                this.scheduleOnce(() => {
                    FLAudioMgr.Instance.stopLongEffect("games/rolling");
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
            let bitNum = FLGameManager.getTotalBitNum()
            let bigWinType = FLGameManager.getBigWinType(coin, bitNum);
            if (!bigWinType) {
                this.scheduleOnce(() => { resolve() }, noDelayT)
                return
            }

            let endFunc = () => {
                resolve();
            }
            await this.delayTime(0.5);
            let node = xNodeFL.find("node_ani/big_win_2", this.layerCtrl.node);
            if (!node) {
                let prefab = FLLoadManager.ins.getPrefab("res/load/prefab/games/big_win_2");
                node = instantiate(prefab);
                node.parent = xNodeFL.find("node_ani", this.layerCtrl.node);
            }
            node.getComponent(FLBigWinCtrl).playBigWin(coin, bigWinType, endFunc);
        })
    }


    playWildFlyAnim(mIcons) {
        return new Promise<void>(async (resolve, reject) => {
            let hasPlay = false, playFly = false;
            let node_wildFly = this.node.getChildByName("node_wildFly");

            let playList = [6, 3, 0, 7, 4, 1, 8, 5, 2];
            for (let i = 0; i < playList.length; i++) {
                if (mIcons[playList[i]] == FLConstant.WILD_TYPE) {
                    hasPlay = true;
                    FLAudioMgr.Instance.playSound("games/fly");

                    let cell = this.getCellByIdx(playList[i]);
                    tween(cell)
                        .to(0.2, { scale: new Vec3(1.1, 1.1, 1.1) })
                        .to(0.2, { scale: new Vec3(1, 1, 1,) })
                        .start()

                    let node = FLLoadManager.ins.showGetPrefab("res/load/prefab/games/wild_fly", node_wildFly);
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
                            FLAudioMgr.Instance.playSound("games/fly_end");
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
        let cell = xNodeFL.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FLLoadManager.ins.getPrefab(FLConstant.PRAFAB_CELL_WIN));
            node_top.addChild(cell);
            cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(index));
            cell.name = `cell${index}`;
            cell.getComponent(FLCellItem).initTypeView(type);
        }
        if (cell.getComponent(FLCellItem).type !== type) {
            cell.getComponent(FLCellItem).setTypeView(type);
            cell.setSiblingIndex(FLConstant.PRAFAB_LIST[type].zIndex - index + 15);
        } else if (FLConstant.PRAFAB_LIST[type].jp_node) {
            cell.getComponent(FLCellItem).setTypeView(type);
        }
        // cell.active = true;
        return cell
    }
    copyCellToTop(ori_cell) {
        let node_top = this.node.getChildByName("node_top");
        let type = ori_cell.getComponent(FLCellItem).type;
        let index = ori_cell.getComponent(FLCellItem).index;
        let cell = xNodeFL.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FLLoadManager.ins.getPrefab(FLConstant.PRAFAB_CELL_WIN));
            node_top.addChild(cell);
            cell.name = `cell${index}`;
            cell.getComponent(FLCellItem).initTypeView(type);
        }
        cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(ori_cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
        cell.active = true;
        cell.getComponent(FLCellItem).setTypeView(type);
        cell.setSiblingIndex(FLConstant.PRAFAB_LIST[type].zIndex - index + 15);
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
        let node = xNodeFL.find("mask", this.node);
        node && (node.active = bShow);
    }


    // 中线-线动画 flag_id--0开始
    playOneLine(flag_id: number) {
        let node_line = this.node.getChildByName("node_line");
        if (node_line) {
            let line = xNodeFL.find(`line${flag_id}`, node_line);
            if (!line) {
                line = instantiate(FLLoadManager.ins.getPrefab("res/load/prefab/games/win_payline"));
                node_line.addChild(line);
                line.position = new Vec3(0, ([0, 1, -1][flag_id] || 0) * 183, 0);
                line.eulerAngles = new Vec3(0, 0, [0, 0, 0, -45, 45][flag_id]);
                line.scale = new Vec3(flag_id < 3 ? 1.7 : 2, 1.7, 0);
                line.name = `line${flag_id}`;
            }
            line.active = true;
        }
        xNodeFL.find("bg/num_red_" + (flag_id + 1) + "_0", this.node).active = false;
        xNodeFL.find("bg/num_red_" + (flag_id + 1) + "_1", this.node).active = false;
        xNodeFL.find("bg/num_yellow_" + (flag_id + 1) + "_0", this.node).active = true;
        xNodeFL.find("bg/num_yellow_" + (flag_id + 1) + "_1", this.node).active = true;
    }
    hideAllLine() {
        let node_line = this.node.getChildByName("node_line");
        if (node_line) {
            node_line.children.forEach(node => {
                node.active = false;
            })
        }
        let num_line = xNodeFL.find("bg", this.node);
        num_line.children.forEach(node => {
            if (node.name.startsWith("num_red")) {
                node.active = true;
            }
            if (node.name.startsWith("num_yellow")) {
                node.active = false;
            }
        })
    }

    //中线赢分 flag_id--0开始
    playOneLineMoney(flag_id: number, money: number) {
        let node_money = this.node.getChildByName("node_money");
        let mask = node_money.getChildByName(`mask_${flag_id > 2 ? 0 : flag_id}`);
        mask.active = true;
        xNodeFL.setLabel("num_info", mask, showMoney(money));
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
            let kuang = xNodeFL.find(`kuang${idx}`, node_kuang);
            if (!kuang) {
                kuang = instantiate(FLLoadManager.ins.getPrefab("res/load/prefab/games/win_kuang"));
                node_kuang.addChild(kuang);
                kuang.position = node_kuang.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(idx));
                kuang.name = `kuang${idx}`;
            }
            kuang.active = true;

            const frame = kuang.getChildByName("wh_vfx_c_screen").getComponent(sp.Skeleton);
            frame.setAnimation(0, "animation", false);
            frame.addAnimation(0, "animation", false);
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
        return xNodeFL.find("pos_hb", this._avatarSp.node).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0))
    }

    /**
     * 
     * @param idx 0开始
     */
    getWorldPosByIdx(idx: number): Vec3 {
        let col = idx % FLConstant.COL_COUNT;
        let row = Math.floor(idx / FLConstant.COL_COUNT);

        let y = FLConstant.CELL_SIZE.height * (row + 1 / 2);
        let pos = this.cellLayerCtrlList[col].getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, y, 0));
        return pos
    }

    // idx 0开始
    getCellByIdx(idx: number) {
        let col = idx % FLConstant.COL_COUNT;
        let row = Math.floor(idx / FLConstant.COL_COUNT);
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
        if (clickPos.x < -115) {
            col = 0;
        } else if (clickPos.x < 115) {
            col = 1;
        } else {
            col = 2;
        }
        if (clickPos.y < -103) {
            row = 0;
        } else if (clickPos.y < 103) {
            row = 1;
        } else {
            row = 2;
        }

        let cellIdx = row * 3 + col;
        let cell = this.getCellByIdx(cellIdx);
        let type = cell.getComponent(FLCellItem).type;
        let refPos = node.getComponent(UITransform).convertToNodeSpaceAR(cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
        posX = col > 1 ? refPos.x - 80 : refPos.x + 80;
        posY = refPos.y;

        if (type == 0) {
            return
        }

        let panel = node.getChildByName("mult_panel");
        if (panel && panel.active) {
            panel.active = false;
        }
        if (!panel) {
            panel = instantiate(FLLoadManager.ins.getPrefab("res/load/prefab/games/mult_panel"));
            node.addChild(panel);
            panel.name = "mult_panel";
            panel.on("click", this.onClickMultPanel, this);
        }

        xNodeFL.find("node_mult/SpriteSplash", this.node).active = true;
        panel.active = true;
        panel.position = new Vec3(posX, posY, 0)
        let num_red = panel.getChildByName("num_red");
        let num_yellow = panel.getChildByName("num_yellow");
        let cell_win = panel.getChildByName("cell_win");
        xNodeFL.setLabel("", num_red, "3");
        xNodeFL.setLabel("", num_yellow, FLConstant.PRAFAB_LIST[type].MULT);
        cell_win.children.forEach(node => node.active = false);
        let showSp: sp.Skeleton = xNodeFL.findComponent(FLConstant.PRAFAB_LIST[type].win_node, cell_win, sp.Skeleton);
        showSp.node.active = true;
        showSp.setAnimation(0, FLConstant.PRAFAB_LIST[type].idle_anim, false);

        if (col < 2) {
            num_red.position = new Vec3(43, 0, 0);
            num_yellow.position = new Vec3(117, 0, 0);
            cell_win.position = new Vec3(-85, -3, 0);
        } else {
            num_red.position = new Vec3(-145, 0, 0);
            num_yellow.position = new Vec3(-74, 0, 0);
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
        xNodeFL.find("node_mult/SpriteSplash", this.node).active = false;
        let mult_panel = xNodeFL.find("node_mult/mult_panel", this.node);
        if (mult_panel) mult_panel.active = false;
    }



    setCanStop() {
        if (FLGameManager.getRotateData()) {
            if (FLGameManager.getRotateData().mFreeList) {
                this.playAvatarAnim("triSpecial");
                this._canStop = false;
                this.triFreeGameAnim(FLGameManager.getRotateData());
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
        FLAudioMgr.Instance.playSound("games/return");
        tween(this.node)
            .to(0.3, { scale: new Vec3(1, 1, 1) })
            .start()

        let bg = find("Canvas/GameLayer/bg");
        tween(bg)
            .to(0.5, { scale: new Vec3(1, 1, 1) })
            .start()

        let ui_02e_opa: UIOpacity = xNodeFL.findComponent("ui_02e", this.node, UIOpacity);
        ui_02e_opa.node.active = false;
        let ui_03e_opa: UIOpacity = xNodeFL.findComponent("ui_03e", this.node, UIOpacity);
        ui_03e_opa.node.active = false;
    }

    // 免费游戏触发动画--卷轴收缩--红包动画--免费图标
    async triFreeGameAnim(mRotateData) {
        if (mRotateData.mFreeIconIdx && mRotateData.mFreeList) {
            // FLGameManager.setState(FLSTATE.SPECIAL);

            FLAudioMgr.Instance.stopMusic();
            FLAudioMgr.Instance.playMusic("bgm_mg_b");

            FLAudioMgr.Instance.playSound("games/respin1");
            FLAudioMgr.Instance.playSound("games/respin2");

            this.layerCtrl.optCtrl.showNorTitle(true, "triFree");

            tween(this.node)
                .to(0.5, { scale: new Vec3(0.94, 0.94, 1) })
                .start()

            let ui_02e_opa: UIOpacity = xNodeFL.findComponent("ui_02e", this.node, UIOpacity);
            ui_02e_opa.node.active = true;
            ui_02e_opa.opacity = 0;
            tween(ui_02e_opa).to(0.5, { opacity: 255 }).start()
            let ui_03e_opa: UIOpacity = xNodeFL.findComponent("ui_03e", this.node, UIOpacity);
            ui_03e_opa.node.active = true;
            ui_03e_opa.opacity = 0;
            tween(ui_03e_opa).to(0.5, { opacity: 255 }).start()

            let hongbao = xNodeFL.find("hongbao", this.node);
            hongbao.active = true;
            hongbao.children.forEach((node) => {
                node.active = false;
            })

            let hbSp: sp.Skeleton = xNodeFL.findComponent("rs_start_hongbao", hongbao, sp.Skeleton);
            hbSp.node.active = true;
            hbSp.setAnimation(0, "rs_start_hb", false);

            tween(hbSp.node)
                .delay(0.4)
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
                .to(0.4, { scale: new Vec3(0.7, 0.9, 1) })
                .start();
            let hbOpa: UIOpacity = xNodeFL.findComponent("rs_start_hongbao", hongbao, UIOpacity);
            hbOpa.opacity = 255;
            tween(hbOpa)
                .delay(0.8)
                .to(0.4, { opacity: 60 })
                .to(0.1, { opacity: 0 })
                .start()

            await this.delayTime(1.1);

            FLAudioMgr.Instance.playSound("games/respin3");
            let cell_win = hongbao.getChildByName("cell_win");
            let cell_win_opa = hongbao.getChildByName("cell_win").getComponent(UIOpacity);
            cell_win.active = true;
            cell_win.children.forEach(node => node.active = false);
            let showSp: sp.Skeleton = xNodeFL.findComponent(FLConstant.PRAFAB_LIST[mRotateData.mFreeIconIdx].win_node, cell_win, sp.Skeleton);
            showSp.node.active = true;
            showSp.setAnimation(0, FLConstant.PRAFAB_LIST[mRotateData.mFreeIconIdx].idle_anim, false);


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

            FLGameManager.setRandomList(mRotateData.mFreeIconIdx)

            await this.delayTime(0.2)
            xxing.active = false;
            cell_win.active = false;
            hongbao.active = false;

            let mult = this._avatarSp.node.getChildByName("mult");
            mult.active = true;
            mult.position = new Vec3(0, 480, 0);
            mult.getComponent(UITransform).anchorPoint = new Vec2(0.5, 0.8);
            mult.getChildByName("mult_vfx_a_screen").active = true;
            mult.getChildByName("mult_vfx_b_add").active = true;
            mult.scale = new Vec3(0.5, 0.5, 1)
            tween(mult)
                .to(0.3, { scale: new Vec3(1.8, 1.8, 1) })
                .call(() => {
                    mult.getChildByName("mult_vfx_a_screen").active = false;
                    mult.getChildByName("mult_vfx_b_add").active = false;
                })
                .start()

            FLAudioMgr.Instance.playSound("games/respin4");
            this.playRespinFlyAnim();
            await this.delayTime(0.5)

            this.showFreeKuangBgIdleAnim(true);
            this.showTriFreeGuang();

            this._minIdleT += 2;
            this._canStop = true;
        }
    }


    triFreeGameFailAnim() {
        FLAudioMgr.Instance.playSound("games/respin2");
        let ui_02e_opa: UIOpacity = xNodeFL.findComponent("ui_02e", this.node, UIOpacity);
        ui_02e_opa.node.active = true;
        ui_02e_opa.opacity = 0;
        tween(ui_02e_opa).delay(0.3).to(0.5, { opacity: 255 }).delay(0.5).to(0.5, { opacity: 0 }).start()
        let ui_03e_opa: UIOpacity = xNodeFL.findComponent("ui_03e", this.node, UIOpacity);
        ui_03e_opa.node.active = true;
        ui_03e_opa.opacity = 0;
        tween(ui_03e_opa).delay(0.3).to(0.5, { opacity: 255 }).delay(0.5).to(0.5, { opacity: 0 }).start()

        tween(this.node)
            .delay(0.3)
            .to(0.5, { scale: new Vec3(0.95, 0.95, 1) })
            .delay(0.5)
            .call(() => {
                FLAudioMgr.Instance.playSound("games/return");
                this.playAvatarAnim("triSpecialFailBack");
            })
            .to(0.5, { scale: new Vec3(1, 1, 1) })
            .call(() => {
                this._canStop = true;
            })
            .start()



        // let bg = find("Canvas/GameLayer/bg");
        // tween(bg)
        //     .delay(0.3)
        //     .to(0.5, { scale: new Vec3(0.95, 0.95, 1) })
        //     .delay(0.5)
        //     .to(0.5, { scale: new Vec3(1, 1, 1) })
        //     .start()
    }


    playRespinFlyAnim() {
        let respin_bg = find("Canvas/GameLayer/layout_center/respin_bg");
        respin_bg.active = true;

        let guang1Opa: UIOpacity = xNodeFL.findComponent("respin_vfx_b_add", respin_bg, UIOpacity);
        guang1Opa.node.active = true;
        guang1Opa.opacity = 0;
        tween(guang1Opa)
            .to(0.5, { opacity: 255 })
            .start()
        let guang2Anim: Animation = xNodeFL.findComponent("respin_vfx_r_add_00", respin_bg, Animation);
        guang2Anim.node.active = true;
        guang2Anim.play("respin_bg_r");
        let guang3Anim: Animation = xNodeFL.findComponent("respin_vfx_c_add_00", respin_bg, Animation);
        guang3Anim.node.active = true;
        guang3Anim.play("respin_bg_c");
        let guang4Anim: Animation = xNodeFL.findComponent("respin_vfx_h_screen_00", respin_bg, Animation);
        guang4Anim.node.active = true;
        guang4Anim.play("respin_bg_h");

        let node_fly = xNodeFL.find("node_anti/fly", this.node);
        for (let i = 0; i < 3; i++) {
            let fly = FLLoadManager.ins.showGetPrefab("res/load/prefab/games/respin_fly", node_fly);
            fly.active = true;

            let sPos = fly.getComponent(UITransform).convertToNodeSpaceAR(this._avatarSp.node.getChildByName("pos_avatar").getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
            let ePos = new Vec3([-230, 0, 230][i], 309, 0);

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
        let respin_bg = find("Canvas/GameLayer/layout_center/respin_bg");
        respin_bg.active = false;
        respin_bg.children.forEach((node) => { node.active = false; })
    }


    showTriFreeGuang() {
        let node_guang = xNodeFL.find("node_anti/guang", this.node);
        let node = node_guang.getChildByName("respin_line_guang");
        if (!node) {
            node = FLLoadManager.ins.showGetPrefab("res/load/prefab/games/respin_line_guang", node_guang);
        }
        node.active = true;
        let nodeSp = node.children[0].getComponent(sp.Skeleton);
        let entry = nodeSp.setAnimation(0, "animation", false);
        nodeSp.setTrackCompleteListener(entry, () => {
            node.active = false;
        })


        if (node_guang.children.length > 0) {
            node_guang.children.forEach((node) => { node.active = true })
        } else {
            for (let i = 0; i < 3; i++) {
                let guang = FLLoadManager.ins.showGetPrefab("res/load/prefab/games/respin_line_guang", node_guang);
                guang.getChildByName
            }
        }
    }
    hideTriFreeGuang() {
        let node_guang = xNodeFL.find("node_anti/guang", this.node);
        if (node_guang.children.length > 0) {
            node_guang.children.forEach((node) => { node.active = false })
        }
    }

    showFreeKuangBgIdleAnim(bShow) {
        let node = xNodeFL.find("bg/respin_bg_idle", this.node);
        node.active = bShow;
    }


    playMultAnimNormal(type?) {

        return new Promise<void>(async (resolve, reject) => {
            if (type) {
                let node_qp_mult = this.node.getChildByName("node_qp_mult");
                node_qp_mult.active = true;

                let qpOpa: UIOpacity = xNodeFL.findComponent("", node_qp_mult, UIOpacity);
                qpOpa.opacity = 0;
                tween(qpOpa)
                    .to(0.1, { opacity: 255 })
                    .start()

                node_qp_mult.getChildByName("mask").active = true;

                FLAudioMgr.Instance.playSound("games/x10sound1");
                let win_kuang = node_qp_mult.getChildByName("win_kuang");
                win_kuang.active = true;
                // win_kuang.getComponent(Animation).play("win_kuang_bg_big");
                win_kuang.getChildByName("wh_vfx_c_screen").getComponent(sp.Skeleton).setAnimation(0, "animation", false);

                let cell_win = node_qp_mult.getChildByName("cell_win");
                cell_win.active = true;
                cell_win.children.forEach(node => node.active = false);
                let showSp: sp.Skeleton = xNodeFL.findComponent(FLConstant.PRAFAB_LIST[type].win_node, cell_win, sp.Skeleton);
                showSp.node.active = true;
                showSp.setAnimation(0, FLConstant.PRAFAB_LIST[type].win_anim, false);
            }

            await this.delayTime(0.5);

            FLAudioMgr.Instance.playSound("games/x10sound2");
            let mult = this._avatarSp.node.getChildByName("mult");
            mult.active = true;
            mult.position = this._avatarSp.node.getChildByName("pos_hb").position;
            mult.scale = new Vec3(0, 0, 0);
            mult.getComponent(UITransform).anchorPoint = new Vec2(0.5, 0.5);

            tween(mult)
                .to(0.3, { scale: new Vec3(1.8, 1.8, 1) })
                .delay(0.2)
                .call(() => {
                    mult.getChildByName("mult_vfx_a_screen").active = false;
                    mult.getChildByName("mult_vfx_b_add").active = false;
                })
                .start()


            await this.delayTime(0.8);

            FLAudioMgr.Instance.playSound("games/x10sound3");
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

                let qpOpa: UIOpacity = xNodeFL.findComponent("", node_qp_mult, UIOpacity);
                qpOpa.opacity = 0;
                tween(qpOpa)
                    .to(0.1, { opacity: 255 })
                    .start()

                node_qp_mult.getChildByName("mask").active = true;

                FLAudioMgr.Instance.playSound("games/x10sound1");
                // this.showSlotsGray(true);
                let win_kuang = node_qp_mult.getChildByName("win_kuang");
                win_kuang.active = true;
                // win_kuang.getComponent(Animation).play("win_kuang_bg_big");
                win_kuang.getChildByName("wh_vfx_c_screen").getComponent(sp.Skeleton).setAnimation(0, "animation", false);


                let cell_win = node_qp_mult.getChildByName("cell_win");
                cell_win.active = true;
                cell_win.children.forEach(node => node.active = false);
                let showSp: sp.Skeleton = xNodeFL.findComponent(FLConstant.PRAFAB_LIST[type].win_node, cell_win, sp.Skeleton);
                showSp.node.active = true;
                showSp.setAnimation(0, FLConstant.PRAFAB_LIST[type].win_anim, false);
            }
            await this.delayTime(0.5);

            FLAudioMgr.Instance.playSound("games/x10sound2");
            let mult = this._avatarSp.node.getChildByName("mult");
            mult.active = true;
            // mult.position = new Vec3(30, 216, 0);
            // mult.scale = new Vec3(0.9, 0.9, 1);
            mult.getComponent(UITransform).anchorPoint = new Vec2(0.5, 0.8);

            tween(mult)
                .to(0.3, { scale: new Vec3(2.3, 2.3, 1), position: new Vec3(0, 550, 0) })
                .start()

            await this.delayTime(0.5);
            FLAudioMgr.Instance.playSound("games/x10sound3");
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


    private avatarAnimationVersion = 0;

    playAvatarAnim(type) {
        const version = ++this.avatarAnimationVersion;

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
            FLAudioMgr.Instance.playSound("games/COOL");
            let entry = this._avatarSp.setAnimation(0, "zo_exit", false);
            this._avatarSp.addAnimation(0, "idle", true);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this.scheduleOnce(() => {
                    if (this.avatarAnimationVersion === version) this.playAvatarIdleAnim();
                }, 0);
            })
        } else if (type == "zw") {  // 东张西望
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "idle5", false);
            this._avatarSp.addAnimation(0, "idle", true);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this.scheduleOnce(() => {
                    if (this.avatarAnimationVersion === version) this.playAvatarIdleAnim();
                }, 0);
            })
        } else if (type == "wildCollect") { // wild图标收集
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "wild_collect", false);
            this._avatarSp.addAnimation(0, "idle", true);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this.scheduleOnce(() => {
                    if (this.avatarAnimationVersion === version) this.playAvatarIdleAnim();
                }, 0);
            })
        } else if (type == "winSmall") {    // 小赢
            let effName = ["NICE", "YEAH"][Math.floor(Math.random() * 2)];
            FLAudioMgr.Instance.stopLongEffect("games/NICE");
            FLAudioMgr.Instance.stopLongEffect("games/YEAH");
            FLAudioMgr.Instance.playLongEffect("games/" + effName);
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "win", false);
            this._avatarSp.addAnimation(0, "idle", true);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this.scheduleOnce(() => {
                    if (this.avatarAnimationVersion === version) this.playAvatarIdleAnim();
                }, 0);
            })
        } else if (type == "winBig") {  // 大赢
            // let effL = ["NICE", "YEAH"];
            // FLAudioMgr.Instance.playSound("games/" + effL[Math.floor(Math.random() * effL.length)]);
            Tween.stopAllByTarget(this._avatarSp);
            let entry = this._avatarSp.setAnimation(0, "win2", false);
            this._avatarSp.addAnimation(0, "idle", true);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this.scheduleOnce(() => {
                    if (this.avatarAnimationVersion === version) this.playAvatarIdleAnim();
                }, 0);
            })

        }

    }

    playAvatarIdleAnim() {
        ++this.avatarAnimationVersion;
        Tween.stopAllByTarget(this._avatarSp)
        this._avatarSp.setAnimation(0, "idle", true);
        let delayTime = 10 + Math.random() * 15;
        tween(this._avatarSp)
            .repeatForever(
                tween()
                    .delay(delayTime)
                    .call(() => {
                        delayTime = 10 + Math.random() * 15

                        const idleVariants = [2, 4, 5];
                        const animType = idleVariants[Math.floor(Math.random() * idleVariants.length)];
                        this._avatarSp.setAnimation(0, "idle" + animType, false);
                        this._avatarSp.addAnimation(0, "idle", true);

                        if (animType == 4) {
                            FLAudioMgr.Instance.playSound("games/OH");
                        }
                    })
            )
            .start()
    }


    roundEnd() {
        flframe.log.logView("round end");
        if (goSession.balance !== undefined) FLGlobal.USER.gold = goSession.balance;
        this.layerCtrl.optCtrl.setAllNum();
        this.layerCtrl.optCtrl.canSendSpin = true;
        FLGameManager.restRound();
        FLGameManager.setAudoNum(FLGameManager.getAudoNum() - 1)
        if (goSession.replay) this.layerCtrl.finishReplay();
        else this.layerCtrl.optCtrl.checkAudo();
        FLGameManager.setWinAllMoney(0)
       
        this._canCLickMultPanel = true;
    }

    update(dt) {
        if (this._startMove) {
            if (this._minIdleT > 0) {
                this._minIdleT -= dt;
            }

            if (this._minIdleT <= 0 /*&& !this._bStop*/ && this._startLayerCnt == FLConstant.COL_COUNT && this._canStop) {
                FLGameManager.setRoundTime(FLGameManager.getRoundTime() + dt);
                let canStop: IgetCanStop = FLGameManager.getCanStop();
                if (canStop && canStop.state > 0 && this._canStop) {
                    // this._bStop = true;
                    this._startMove = false;
                    if (canStop.state == 1) {
                        this.cellLayerCtrlList.forEach((layerCtrl, idx) => {
                            layerCtrl.setResultData(FLGameManager.getResultData(idx));
                            layerCtrl.setDelayT(FLGameManager.getNormalDelayT(idx));
                            layerCtrl.setStopMove(true);
                        })
                    } else {
                        this.cellLayerCtrlList.forEach((layerCtrl, idx) => {
                            layerCtrl.setResultData([]);
                            layerCtrl.setDelayT(idx * 0.05 * 5);
                            layerCtrl.setStopMove(true);
                        })
                        this.scheduleOnce(() => {
                            FLLoadManager.ins.showAlertWithInit(FLConfigCtrl.Instance.getLanguageText(FLLanguage.NONET), () => { })
                        }, 1)
                    }
                }
                // }
            }

        }
    }
}
