import { _decorator, instantiate, Vec3, tween, find, sp, Label, Node, UIOpacity, UITransform, Sprite, Color, isValid, Prefab, Tween, ParticleSystem2D, bezier, NodeEventType, Camera, screen, Animation, math, view, Vec2, Widget, } from 'cc';
import { foxframe } from '../../../foxframe/foxframe';
import { xNodeFOX } from '../../../xtools/xNodeFOX';
import { columnIcons, Frame } from '../../net/FOXResultAdapter';
import { FOXBaseNode } from '../../base/FOXBaseNode';
import { showMoney } from '../../common/FOXUtils';

import { FOXConstant, FOXSTATE, WINTYPE } from '../../FOXConstant/FOXConstant';
import FOXLoadManager from '../../load/FOXLoadManager';
import { FOXGameManager, IgetCanStop } from '../../mgr/FOXGameManager';
import { FOXAudioMgr } from './FOXAudioMgr';
import { FOXCellItem } from './FOXCellItem';
import { FOXConfigCtrl } from './FOXConfigCtrl';
import { FOXGameLayerCtrl } from './FOXGameLayerCtrl';
import { FOXGlobal } from './FOXGlobal';
import { FOXLanguage } from './FOXLanguage';
// import FOXPopupCtrl from './FOXPopupCtrl';
// import { FOXTransitionCtrl } from './FOXTransitionCtrl';
import { FOXCellLayer } from './FOXCellLayer';
import { FOXBigWinCtrl } from './FOXBigWinCtrl';
import { FOXSpriteCtrl } from './FOXSpriteCtrl';

const { ccclass } = _decorator;

@ccclass('FOXCenterRollCtrl')
export default class FOXCenterRollCtrl extends FOXBaseNode {

    private frame?: Frame;
    private specialPresented = false;
    private cellLayerCtrlList: FOXCellLayer[] = [];

    layerCtrl: FOXGameLayerCtrl = null;
    // popupCtrl: FOXPopupCtrl = null;
    // transCtrl: FOXTransitionCtrl = null;

    _startMove: boolean = false;// 是否开始旋转
    _canStop: boolean = false;// 可以停止
    _bStop: boolean = false;    // 是否已经开始停止
    _stopLayerCnt: number = 0;  //停止旋转的列个数--5列都停了才开始处理停止操作
    _readyStopLayerCnt: number = 0;
    _startLayerCnt: number = 0; // 开始旋转的列个数--要等到5列都开始转才能停止
    _minIdleT: number = 0;  // 开始转动的额外空转时间

    _canCLickMultPanel = false; // 是否可以点击图标
    _avatarSp: sp.Skeleton = null;

    _shakeNodeSPos: Vec3;
    _playAntiIndex = -1;
    _wildFlyCnt = 0;    // 飞的wild个数，区分动画--5及以下fx_wild_collect, 12及以下fx_wild_collect2, 12以上fx_wild_collect3
    _isAvaterPlayOther = false;

    protected initAttribute() {
        this.layerCtrl = find("Canvas").getChildByName("GameLayer").getComponent(FOXGameLayerCtrl);
        this._avatarSp = find("Canvas/GameLayer/avatar").getComponent(sp.Skeleton);

        this.playAvatarIdleAnim();
        // this.setAvatarNormalPos(true);

        this.node.getChildByName("node_mult").on(NodeEventType.TOUCH_END, this.clickMultPanel, this);
        this._canCLickMultPanel = true;
        document.addEventListener("pointerup", this.onBoardPress, true);
    }
    private onBoardPress = (event: PointerEvent) => {
        if (!this._startMove && !(this.frame && this._stopLayerCnt < FOXConstant.COL_COUNT)) return;
        const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
        if (event.target !== canvas || !event.isPrimary || event.button !== 0) return;
        const camera = find('Canvas').getComponentInChildren(Camera);
        const bounds = canvas.getBoundingClientRect();
        const {width, height} = screen.windowSize;
        const px = (event.clientX - bounds.left) * width / bounds.width;
        const py = (bounds.bottom - event.clientY) * height / bounds.height;
        const project = (p: Vec3) => camera.worldToScreen(p, new Vec3());
        const onReels = this.cellLayerCtrlList.some((reel, col) => {
            const transform = reel.node.getComponent(UITransform);
            const a = project(transform.convertToWorldSpaceAR(new Vec3(-111.5, 0, 0)));
            const b = project(transform.convertToWorldSpaceAR(new Vec3(111.5, FOXConstant.CELL_SIZE.height * FOXConstant.ROW_REAL_COUNT[col], 0)));
            return px >= a.x && px <= b.x && py >= a.y && py <= b.y;
        });
        if (onReels) this.layerCtrl.optCtrl.onStopRollClick(true);
    };

    onDestroy() {
        document.removeEventListener('pointerup', this.onBoardPress, true);
        super.onDestroy();
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
            let cellLayerCtrl = pNode.addComponent(FOXCellLayer);
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
        this._readyStopLayerCnt = 0;
        this._startLayerCnt = 0;
        this._minIdleT = 0;
        this._playAntiIndex = -1;
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.resData();
        })
    }

    // 初始化所有节点，即中线动画全部隐藏、top层的全部隐藏、卷轴层的全部显示为默认,且不置灰、
    initLight() {
        // FOXAudioMgr.Instance.stopSound();
        if (this._isAvaterPlayOther) {
            this.playAvatarIdleAnim();
            this.playLightAnim(false);
        }
        this.unscheduleAllCallbacks();
        this.hideAllLineMoney();
        this.hideAllLine();
        this.hideAllKuang();
        this.hideAllCellTop();
        this.showSlotsGray(false);
        this.playLightAnim(false);
        // this.cellLayerCtrlList.forEach(layerCtrl => {
        //     layerCtrl.allCellList.forEach(node => {
        //         node.active = true;
        //     })
        // })
    }

    /**开始转动 */
    public startRotation() {
        foxframe.log.logView("startRotation");
        if (this._startMove) return
        this.unscheduleAllCallbacks();
        if (!FOXAudioMgr.Instance.isMusicPlaying()) {
            FOXAudioMgr.Instance.playMusic();
        }
        this._canCLickMultPanel = false;

        this.unschedule(this.hideOneMult);
        this.hideOneMult();

        FOXGameManager.setStop(false);
        this.frame = undefined;
        this.specialPresented = false;
        FOXGameManager.specialSpin = false;
        FOXGameManager.setRotateData(null);
        FOXGameManager.setRoundTime(0);
        this._wildFlyCnt = 0;
        this.initLight();
        this.resData();
        this._canStop = false;

        this._startMove = true;
        this.cellLayerCtrlList.forEach(layerCtrl => {
            layerCtrl.setStartMove();
        })
    }

    // 开始旋转--回弹结束
    playStartRoll(index) {
        this._startLayerCnt += 1;

        if (FOXGameManager.getFast()) {
            this._minIdleT += 0.08;
        } else {
            this._minIdleT += 0.15;
        }

        // FOXAudioMgr.Instance.playSound("games/spin_active_loop");
    }

    playReadyToStop(_index: number) {}
    playBackRoll(_index: number) {}

    playStopRoll(_index: number) {
        if (++this._stopLayerCnt === FOXConstant.COL_COUNT)
            void this.oneRoundEnd().catch(error => this.layerCtrl.handleAnimationError(error));
    }

    acceptFrame(frame: Frame) {
        this.frame = frame;
        FOXGameManager.specialSpin = frame.gameData.special;
        if (frame.gameData.special && !this.specialPresented) {
            this.specialPresented = true;
            void this.triFreeGameAnim().catch(error => this.layerCtrl.handleAnimationError(error));
        } else {
            this._canStop = true;
        }
    }

    showStoredBoard(icons: number[]) {
        this.initLight();
        this.setStoredSymbols(icons);
    }

    private setStoredSymbols(icons: number[]) {
        this.cellLayerCtrlList.forEach((layer, col) => layer.showStoredSymbols(columnIcons(icons, col)));
    }

    cancelRoll(icons: number[]) {
        this.frame = undefined;
        this.specialPresented = false;
        FOXGameManager.specialSpin = false;
        this.resData();
        FOXAudioMgr.Instance.stopLongEffect('games/rolling');
        this.showStoredBoard(icons);
    }

    restoreSpecial() {
        this.specialPresented = true;
        FOXGameManager.specialSpin = true;
        this.node.setScale(0.9, 0.9, 1);
        this.playMfCoinAnim(true, true, 0);
        this.playLightAnim(true);
        this._avatarSp.setAnimation(0, 'rs_idle', true);
        const title = xNodeFOX.find('panel_special/mf_text_shine', this.node);
        title.active = true;
        title.setScale(1, 1, 1);
        title.getComponent(Animation).play();
        for (const col of [0, 2]) xNodeFOX.findComponent('bg/ui_reel_side_' + col, this.node, FOXSpriteCtrl).sprIndex = 1;
        this.layerCtrl.optCtrl.showNorTitle(true, 'triFree');
        FOXAudioMgr.Instance.stopMusic();
        FOXAudioMgr.Instance.playMusic('games/bgm_feature_loop');
    }

    startSpecialRotation() {
        this.frame = undefined;
        FOXGameManager.resOneRound();
        FOXGameManager.specialSpin = true;
        FOXGameManager.setRotateData(null);
        this.resData();
        this._startMove = true;
        this._canStop = false;
        this.playSpecialStartMoveAnim();
        this.cellLayerCtrlList.forEach(layer => layer.setStartMove());
    }

    private async oneRoundEnd() {
        const frame = this.frame;
        const rotate = FOXGameManager.getRotateData();
        if (!frame || !rotate) return;
        const {mIcons, mAwardList} = rotate;
        this.setStoredSymbols(mIcons);
        if (frame.nextAction === 'continue') {
            await this.delayTime(0.3);
            await this.layerCtrl.continuePlay(frame);
            return;
        }

        if (!frame.gameData.special && !frame.gameData.jackpot) await this.playWildFlyAnim(mIcons);
        if (mAwardList.length) {
            const full = frame.gameData.fullBoard && !frame.gameData.jackpot;
            this.showSlotsGray(true);
            this.showWinTrace(mAwardList, mAwardList.length, full);
            if (full) {
                this.playAvatarAnim('win_X10');
                await this.showBottomWin(mAwardList, true, true);
                await this.playWinX10Anim(true);
            }
            await this.showBottomWin(mAwardList, false, full);
        }

        if (frame.gameData.special) {
            this.playAvatarAnim('endSpecial');
            await this.delayTime(0.5);
            this.recoverToNormal();
            FOXAudioMgr.Instance.stopMusic();
            FOXAudioMgr.Instance.playMusic();
            await this.delayTime(0.8);
        } else if (FOXGameManager.getAudoNum() > 0) {
            await this.delayTime(mAwardList.length ? 0.8 : 0.3);
        }
        this.roundEnd();
    }

    showWinTrace(awardList, index, isWinX10 = false) {
        let playLine = (awardData, bShowMoney) => {
            let mIconIdxs = awardData.mIconIdxs;
            let money = awardData.mMoney;
            let flag_id = awardData.flag_id;

            for (let i = 0; i < mIconIdxs.length; i++) {
                let idx = mIconIdxs[i] - 1;

                let delayT = idx % FOXConstant.COL_COUNT * 0.05;
                this.scheduleOnce(() => {

                    let cell = this.getCellByIdx(idx);
                    let type = cell.getComponent(FOXCellItem).type;
                    let cellTop = this.playCellToTop(idx, type);
                    cellTop.active = true;
                    cellTop.getComponent(FOXCellItem).playWinAni(false);
                    this.playKuang(idx);

                }, delayT)
            }

            if (flag_id > 0) this.playOneLine(flag_id - 1);
            if (flag_id > 0 && bShowMoney) {
                this.playOneLineMoney(flag_id - 1, isWinX10 ? money / 10 : money);
            }

        }

        if (awardList) {
            this.hideAllLineMoney();
            this.hideAllLine();
            this.hideAllKuang();
            this.hideAllCellTop();
            FOXAudioMgr.Instance.playSound("games/prizeWinHighlight");
            if (index == awardList.length) {  // 总的
                for (let i = 0; i < awardList.length; i++) {
                    playLine(awardList[i], false);
                }
                this.scheduleOnce(() => this.showWinTrace(awardList, 0, isWinX10), 1.5);
            } else {    // 单的
                playLine(awardList[index], true);
                this.scheduleOnce(() => this.showWinTrace(awardList, index + 1, isWinX10), 1.5);
            }
        }

    }


    showBottomWin(awardList, bShowAll = false, isWinX10 = false) {
        return new Promise<void>(async (resolve, reject) => {

            let roundWinMoney: number = 0;
            awardList.forEach(arardInfo => {
                roundWinMoney += arardInfo.mMoney;
            })

            if (bShowAll && isWinX10) {
                let totalWin = roundWinMoney / 10;
                this.layerCtrl.optCtrl.showNorTitle(false);
                this.layerCtrl.optCtrl.setAwardNum(totalWin);
                this.layerCtrl.optCtrl.setBigAwardNum(totalWin, 1);
            } else {
                let totalWin = roundWinMoney;
                let bitNum = FOXGameManager.visualStake ?? FOXGameManager.getTotalBitNum()
                let bigWinType = FOXGameManager.getBigWinType(roundWinMoney, bitNum);
                let winType = FOXGameManager.getWinType(roundWinMoney, bitNum);
                if (bigWinType > 0) {
                    FOXAudioMgr.Instance.playSound("games/prizeBigwinBefore");
                    await this.delayTime(0.3)
                    await new Promise<void>((resolve, reject) => {

                        let node = xNodeFOX.find("Canvas/SafeLayer/big_win");
                        if (!node) {
                            let prefab = FOXLoadManager.ins.getPrefab("res/load/prefab/games/big_win");
                            node = instantiate(prefab);
                            node.parent = xNodeFOX.find("Canvas/SafeLayer");
                        }
                        node.getComponent(FOXBigWinCtrl).playBigWin(roundWinMoney, bigWinType, resolve);
                    })
                }

                FOXGameManager.setWinMoney(totalWin);
                this.layerCtrl.showSettledBalance(0.5);
                this.layerCtrl.optCtrl.showNorTitle(false);
                this.layerCtrl.optCtrl.setAwardNum(totalWin, 0.5);
                this.layerCtrl.optCtrl.setBigAwardNum(totalWin, winType, (bigWinType > 0 || winType == 1) ? 0 : 0.5);


                if (bigWinType > 0) {
                    FOXAudioMgr.Instance.playSound("games/prizeBigwinAfter");
                } else if (winType == 1) {
                    FOXAudioMgr.Instance.playSound("games/prizeSmallwin");
                } else {
                    FOXAudioMgr.Instance.playLongEffect("games/prizeMedwinMain");
                }

                if (isWinX10) {
                } else if (FOXGameManager.isSpecialGame()) {
                    this.playAvatarAnim("win2")
                } else {
                    this.playAvatarAnim(winType == 1 ? "win" : "win2");
                    if (bigWinType > 0 || winType == 1) {
                        let effList = ["voxWin1", "voxWin2", "voxWin3"];
                        FOXAudioMgr.Instance.playSound("games/" + effList[Math.floor(Math.random() * effList.length)]);
                    } else {

                        let effList = ["voxMedwin1", "voxMedwin2"];
                        FOXAudioMgr.Instance.playSound("games/" + effList[Math.floor(Math.random() * effList.length)]);
                    }
                }

            }
            resolve();
        })
    }


    playWildFlyAnim(mIcons) {
        return new Promise<void>(async (resolve, reject) => {
            let hasPlay = false, playFlyEff = false, playFly = false;
            // let node_wildFly = this.node.getChildByName("node_wildFly");
            let parentNode = this.layerCtrl.node;

            // let playList = [[6, 3, 0], [7, 4, 1, 10], [8, 5, 2]];
            for (let i = 0; i < FOXConstant.COL_COUNT * FOXConstant.ROW_COUNT; i++) {
                if (mIcons[i] == FOXConstant.WILD_TYPE) {
                    if (!hasPlay) {
                        FOXAudioMgr.Instance.playSound("games/symWildSpawn");
                        hasPlay = true;
                    }
                    this._wildFlyCnt += 1;

                    let cellTop = this.playCellToTop(i, mIcons[i]);
                    cellTop.active = true;
                    cellTop.getComponent(FOXCellItem).playSpawnAnim();

                    let wild_fly = FOXLoadManager.ins.showGetPrefab("res/load/prefab/games/wild_fly", parentNode);
                    wild_fly.active = true;
                    wild_fly.position = parentNode.getComponent(UITransform).convertToNodeSpaceAR(cellTop.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
                    let par = wild_fly.getChildByName("par");
                    par.position = new Vec3(0, 0, 0);
                    let wc_anim = wild_fly.getChildByName("wc_wild_sweep_00");
                    wc_anim.active = true;
                    wc_anim.getComponent(Animation).play();

                    let ePos = wild_fly.getComponent(UITransform).convertToNodeSpaceAR(this.getHBWPos());
                    tween(par)
                        .delay(0.1)
                        .call(() => {
                            if (!playFlyEff) {
                                FOXAudioMgr.Instance.playSound("games/symWildReach");
                                playFlyEff = true;
                            }
                        })
                        .to(0.35, { position: ePos })
                        .call(() => {
                            wild_fly.destroy();
                            //     if (!playFly) {
                            //         // FOXAudioMgr.Instance.playSound("games/voxWildCollect0" + Math.ceil(Math.random() * 3));
                            //         playFly = true;

                            //         // this.playAvatarAnim("wildCollect")
                            //     }
                        })
                        .start()
                }
            }

            if (hasPlay) {
                this.playAvatarAnim("wildCollect")
                await this.delayTime(0.5)
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
        let cell = xNodeFOX.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FOXLoadManager.ins.getPrefab(FOXConstant.PRAFAB_CELL_WIN));
            cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(this.getWorldPosByIdx(index));
            cell.name = `cell${index}`;
            this.sortChildToParent(node_top, cell, "cell");
            cell.getComponent(FOXCellItem).initTypeView(type);
        }
        if (cell.getComponent(FOXCellItem).type !== type) {
            cell.getComponent(FOXCellItem).setTypeView(type);
        }

        return cell
    }
    copyCellToTop(ori_cell) {
        let node_top = this.node.getChildByName("node_top");
        let type = ori_cell.getComponent(FOXCellItem).type;
        let index = ori_cell.getComponent(FOXCellItem).index;
        let cell = xNodeFOX.find(`cell${index}`, node_top);
        if (!cell) {
            cell = instantiate(FOXLoadManager.ins.getPrefab(FOXConstant.PRAFAB_CELL_WIN));
            cell.name = `cell${index}`;
            this.sortChildToParent(node_top, cell, "cell");
            cell.getComponent(FOXCellItem).initTypeView(type);
        }
        cell.position = node_top.getComponent(UITransform).convertToNodeSpaceAR(ori_cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
        cell.active = true;
        cell.getComponent(FOXCellItem).setTypeView(type);
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
        let node = xNodeFOX.find("frame/ui_reel_tint", this.node);
        node && (node.active = bShow);
    }


    // 中线-线动画 flag_id--0开始
    playOneLine(flag_id: number) {
        let node_line = this.node.getChildByName("node_line");
        if (node_line) {
            let line = xNodeFOX.find(`line${flag_id + 1}`, node_line);
            // if (!line) {
            //     line = instantiate(FOXLoadManager.ins.getPrefab("res/load/prefab/games/win_payline"));
            //     node_line.addChild(line);
            //     line.position = new Vec3(0, [6, 209, -197, 6, 6][flag_id], 0);
            //     line.eulerAngles = new Vec3(0, 0, [0, 0, 0, -39, 39][flag_id]);
            //     line.scale = new Vec3(flag_id < 3 ? 1.4 : 1.85, 1.4, 0);
            //     line.children.forEach((node) => {
            //         node.scale = new Vec3(flag_id < 3 ? 0.6 : 1.5, 1, 0);
            //     })
            //     line.name = `line${flag_id}`;
            // }
            line.active = true;
            line.children.forEach((node) => {
                node.getComponent(Animation).play();
            })
        }
        let num_line = xNodeFOX.find("frame/payline_num/win", this.node);
        if (num_line) {
            num_line.getChildByName("bg_payline_l_" + (flag_id + 1)).active = true;
            num_line.getChildByName("bg_payline_r_" + (flag_id + 1)).active = true;
            num_line.getChildByName("yellow_l_" + (flag_id + 1)).active = true;
            num_line.getChildByName("yellow_r_" + (flag_id + 1)).active = true;
        }
    }
    hideAllLine() {
        let node_line = this.node.getChildByName("node_line");
        if (node_line) {
            node_line.children.forEach(node => {
                node.active = false;
            })
        }
        let num_line = xNodeFOX.find("frame/payline_num/win", this.node);
        if (num_line) {
            num_line.children.forEach(node => {
                node.active = false;
            })
        }
    }

    //中线赢分 flag_id--0开始
    playOneLineMoney(flag_id: number, money: number) {
        let node_money = this.node.getChildByName("node_money");
        let money_id;
        if (flag_id == 0) {
            money_id = 0;
        } else if (flag_id < 5) {
            money_id = 1;
        } else if (flag_id < 9) {
            money_id = 2;
        } else {
            money_id = 3;
        }
        let mask = node_money.getChildByName(`mask_${money_id}`);
        mask.active = true;
        xNodeFOX.setLabel("num_info", mask, showMoney(money));
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
            let kuang = xNodeFOX.find(`kuang${idx}`, node_kuang);
            if (!kuang) {
                kuang = instantiate(FOXLoadManager.ins.getPrefab("res/load/prefab/games/win_kuang"));
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


    getHBWPos() {
        return xNodeFOX.find("pos_yb", this._avatarSp.node).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0))
    }

    /**
     * 
     * @param idx 0开始
     */
    getWorldPosByIdx(idx: number): Vec3 {
        let col = idx % FOXConstant.COL_COUNT;
        let row = Math.floor(idx / FOXConstant.COL_COUNT);

        let y = FOXConstant.CELL_SIZE.height * (row + 1 / 2);
        let pos = this.cellLayerCtrlList[col].getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, y, 0));
        return pos
    }

    // idx 0开始
    getCellByIdx(idx: number) {
        let col = idx % FOXConstant.COL_COUNT;
        let row = Math.floor(idx / FOXConstant.COL_COUNT);
        let node = this.cellLayerCtrlList[col].resultCell[row];
        return node;
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

        let listX = [-320, -111, 111, 320];
        let index = listX.findIndex((value, index) => clickPos.x <= value && (index > 0 && clickPos.x >= listX[index - 1]));
        if (index > 0) {
            col = index - 1;
        }

        let bottomY = (col == 0 || col == 2) ? this.cellLayerCtrlList[0].node.position.y : this.cellLayerCtrlList[1].node.position.y;
        for (let i = 0; i < 5; i++) {
            if (clickPos.y >= bottomY + FOXConstant.CELL_SIZE.height * i && clickPos.y <= bottomY + FOXConstant.CELL_SIZE.height * (i + 1)) {
                row = i;
                break;
            }
        }

        if (col >= 0 && row >= 0) {
            let cell_ref = FOXConstant.CELL_SIZE.weight / 2 - 10
            let cellIdx = row * 3 + col;
            let cell = this.getCellByIdx(cellIdx);
            let type = cell.getComponent(FOXCellItem).type;
            let refPos = node.getComponent(UITransform).convertToNodeSpaceAR(cell.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0)));
            posX = col > 1 ? refPos.x - cell_ref : refPos.x + cell_ref;
            posY = refPos.y;

            if (type == 0) {
                return
            }

            let panel = node.getChildByName("mult_panel");
            if (panel && panel.active) {
                panel.active = false;
            }
            if (!panel) {
                panel = instantiate(FOXLoadManager.ins.getPrefab("res/load/prefab/games/mult_panel"));
                node.addChild(panel);
                panel.name = "mult_panel";
                panel.on("click", this.onClickMultPanel, this);
            }

            FOXAudioMgr.Instance.playSound("games/uiInfo");
            xNodeFOX.find("node_mult/ui_reel_tint_mult", this.node).active = true;
            panel.active = true;
            panel.position = new Vec3(posX, posY, 0);

            let ui_paytable = panel.getChildByName("ui_paytable");
            let num_cnt = panel.getChildByName("num_cnt");
            let num_mult = panel.getChildByName("num_mult");
            let cell_win = panel.getChildByName("cell_win");
            ui_paytable.scale = new Vec3(col > 1 ? -1 : 1, 1, 1);
            xNodeFOX.setLabel("", num_cnt, "3");
            xNodeFOX.setLabel("", num_mult, FOXConstant.PRAFAB_LIST[type].MULT);
            cell_win.children.forEach(node => node.active = false);
            let showSp: sp.Skeleton = xNodeFOX.findComponent(FOXConstant.PRAFAB_LIST[type].win_node, cell_win, sp.Skeleton);
            showSp.node.active = true;
            showSp.setAnimation(0, FOXConstant.PRAFAB_LIST[type].win_idle_anim, false);

            if (col < 2) {
                num_cnt.position = new Vec3(50, 0, 0);
                num_mult.position = new Vec3(130, 0, 0);
                cell_win.position = new Vec3(-cell_ref, 0, 0);
            } else {
                num_cnt.position = new Vec3(-150, 0, 0);
                num_mult.position = new Vec3(-70, 0, 0);
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
        xNodeFOX.find("node_mult/ui_reel_tint_mult", this.node).active = false;
        let mult_panel = xNodeFOX.find("node_mult/mult_panel", this.node);
        if (mult_panel) mult_panel.active = false;
    }



    recoverToNormal() {

        FOXAudioMgr.Instance.playSound("games/featureRespinQuit");
        tween(this.node)
            .to(1, { scale: new Vec3(1, 1, 1) })
            .start()

        this.playMfCoinAnim(false, true, 1);
        this.playLightAnim(false)

        let mf_text_shine = xNodeFOX.find("panel_special/mf_text_shine", this.node);
        mf_text_shine.active = true;
        tween(mf_text_shine).to(0.5, { scale: new Vec3(0, 0, 0) }).call(() => { mf_text_shine.active = false; }).start()

        let ui_reel_side_0 = xNodeFOX.find("bg/ui_reel_side_0", this.node);
        let ui_reel_side_2 = xNodeFOX.find("bg/ui_reel_side_2", this.node);
        ui_reel_side_0.getComponent(FOXSpriteCtrl).sprIndex = 0;
        ui_reel_side_2.getComponent(FOXSpriteCtrl).sprIndex = 0;
    }

    // 角色前方金币
    playMfCoinAnim(bTri, bPlay, playT, bHalf = false) {
        let mf_coin = xNodeFOX.find("Canvas/GameLayer/mf_coin");
        let mf_coin_a_opa: UIOpacity = xNodeFOX.findComponent("mf_coin_a", mf_coin, UIOpacity);
        let mf_coin_b_opa: UIOpacity = xNodeFOX.findComponent("mf_coin_b", mf_coin, UIOpacity);

        if (bPlay) {
            if (bTri) {
                mf_coin.active = true;
                tween(mf_coin_a_opa).to(playT, { opacity: 255 }).start()
                tween(mf_coin_b_opa).to(playT, { opacity: 255 }).start()
                mf_coin_a_opa.node.position = new Vec3(-518, -430, 0)
                mf_coin_b_opa.node.position = new Vec3(518, -430, 0)
                tween(mf_coin_a_opa.node).to(playT, { position: new Vec3(-418, -330, 0) }).start()
                tween(mf_coin_b_opa.node).to(playT, { position: new Vec3(418, -330, 0) }).start()
            } else {
                tween(mf_coin_a_opa).to(playT, { opacity: 0 }).start()
                tween(mf_coin_b_opa).to(playT, { opacity: 0 }).start()
                tween(mf_coin).delay(playT).call(() => { mf_coin.active = false }).start();
            }
        }
    }

    // 角色后方光效
    playLightAnim(bPlay) {
        let mf_btm_glow_opa: UIOpacity = xNodeFOX.findComponent("panel_special/mf_btm_glow", this.node, UIOpacity)
        let par_bg_1 = xNodeFOX.find("panel_special/par_bg_1", this.node);
        if (bPlay) {
            mf_btm_glow_opa.node.active = true;
            mf_btm_glow_opa.opacity = 0;
            tween(mf_btm_glow_opa).to(0.5, { opacity: 255 }).start()
            par_bg_1.active = true;
            par_bg_1.getComponent(ParticleSystem2D).resetSystem();
        } else {
            mf_btm_glow_opa.node.active = false;
            par_bg_1.active = false;
        }

    }


    // 免费游戏触发动画
    async triFreeGameAnim() {
        FOXAudioMgr.Instance.stopMusic();

        this.playAvatarAnim("triSpecial");

        FOXAudioMgr.Instance.playSound("games/featureRespinZoom");

        let triT = 2;
        tween(this.node)
            .to(triT, { scale: new Vec3(0.9, 0.9, 1) })
            .start()

        this.playMfCoinAnim(true, true, 1);

        await this.delayTime(triT);

        FOXAudioMgr.Instance.playMusic("games/bgm_feature_loop");
        FOXAudioMgr.Instance.playSound("games/bgm_feature_intro");

        this.layerCtrl.optCtrl.showNorTitle(true, "triFree");
        this.playAvatarAnim("triSpecialSucc");
        this.playLightAnim(true);

        await this.delayTime(0.5);
        let mf_chac_snap_00: Animation = xNodeFOX.findComponent("mf_chac_snap_00", this._avatarSp.node, Animation);
        mf_chac_snap_00.node.active = true;
        mf_chac_snap_00.play();
        let mf_rs_particle_a_00: Animation = xNodeFOX.findComponent("frame/mf_rs_particle_a_00", this.node, Animation);
        mf_rs_particle_a_00.node.active = true
        mf_rs_particle_a_00.play();

        await this.delayTime(0.2);
        let mf_chac_snap_01: Animation = xNodeFOX.findComponent("mf_chac_snap_01", this._avatarSp.node, Animation);
        mf_chac_snap_01.node.active = true;
        mf_chac_snap_01.play();
        let mf_rs_particle_a_01: Animation = xNodeFOX.findComponent("frame/mf_rs_particle_a_01", this.node, Animation);
        mf_rs_particle_a_01.node.active = true
        mf_rs_particle_a_01.play();

        await this.delayTime(0.3);
        let mf_reel_glow_00: Animation = xNodeFOX.findComponent("frame/mf_reel_glow_00", this.node, Animation);
        mf_reel_glow_00.node.active = true;
        mf_reel_glow_00.play();
        let mf_reel_glow_01: Animation = xNodeFOX.findComponent("frame/mf_reel_glow_01", this.node, Animation);
        mf_reel_glow_01.node.active = true;
        mf_reel_glow_01.play();

        let mf_text_shine = xNodeFOX.find("panel_special/mf_text_shine", this.node);
        mf_text_shine.active = true;
        mf_text_shine.scale = new Vec3(0, 0, 1);
        tween(mf_text_shine).to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" }).call(() => { mf_text_shine.getComponent(Animation).play() }).start();
        FOXAudioMgr.Instance.playSound("games/featureRespinTitle");

        await this.delayTime(0.3);
        let ui_reel_side_0 = xNodeFOX.find("bg/ui_reel_side_0", this.node);
        let ui_reel_side_2 = xNodeFOX.find("bg/ui_reel_side_2", this.node);
        ui_reel_side_0.getComponent(FOXSpriteCtrl).sprIndex = 1;
        ui_reel_side_2.getComponent(FOXSpriteCtrl).sprIndex = 1;

        await this.delayTime(0.2);

        this._minIdleT += 0.5;
        this._canStop = true;
    }

    // 虚晃一枪--触发动画都只又一半就恢复了
    async triFreeGameFailAnim() {
        FOXAudioMgr.Instance.playSound("games/featureRespinZoom");
        this.playAvatarAnim("triSpecial");
        let triT = 1;
        tween(this.node)
            .to(triT, { scale: new Vec3(0.95, 0.95, 1) })
            .start()
        this.playMfCoinAnim(true, true, triT, true);

        await this.delayTime(triT + 0.1);
        this.playAvatarAnim("triSpecialFail");
        this.playMfCoinAnim(false, true, triT);
        tween(this.node)
            .to(triT, { scale: new Vec3(1, 1, 1) })
            .start()

        await this.delayTime(triT + 0.1);
        this._canStop = true;

    }


    shakeNode(node: Node, param?: { times?: number, duration?: number, amp?: number, srcPos?: Vec3 }) {
        if (!param) {
            param = { times: 5, duration: 0.05, amp: 5 };
        }
        let times = param.times || 6;
        let duration = param.duration || 0.2;
        let amp = param.amp || 5;
        let srcPos = param.srcPos || node.position;
        let destPos = new Vec3;
        let arr: Tween<Node>[] = [];

        let pcnt = Math.floor(times / duration);
        for (let i = 0; i < pcnt; ++i) {
            if (i == pcnt - 1) {
                destPos.x = srcPos.x;
                destPos.y = srcPos.y;
            } else {
                let angle = Math.random() * Math.PI * 2;
                destPos.x = Math.cos(angle) * amp + srcPos.x;
                destPos.y = Math.sin(angle) * amp + srcPos.y;
            }
            arr.push(tween().to(duration, { position: new Vec3(destPos.x, destPos.y) }));
        }
        tween(node).sequence(...arr).start()
    }

    stopShakeNode(node: Node, pos: Vec3) {
        Tween.stopAllByTarget(node);
        node.position = pos;
    }

    // 特殊游戏加速框动画
    playAntiAnim(index) {
        this._playAntiIndex = index;

        FOXAudioMgr.Instance.playLongEffect("games/fastspinStart");

        let GameLayer = xNodeFOX.find("Canvas/GameLayer");
        this._shakeNodeSPos = new Vec3(GameLayer.position.x, GameLayer.position.y, 0);
        this.shakeNode(GameLayer);

        let SpriteSplash = xNodeFOX.find("panel_special/SpriteSplash", this.node);
        SpriteSplash.active = true;
        SpriteSplash.getComponent(Widget).updateAlignment();
        let SpriteSplashOpa = SpriteSplash.getComponent(UIOpacity);
        SpriteSplashOpa.opacity = 0;
        tween(SpriteSplashOpa).to(0.5, { opacity: 255 }).start()

        let x10_b: Animation = xNodeFOX.findComponent("panel_special/x10_b", this.node, Animation);
        x10_b.node.active = true;
        x10_b.play()

        let anti = xNodeFOX.find("panel_special/anti" + index, this.node);
        anti.active = true;
        let layerNode = xNodeFOX.find("layerNode", anti);
        layerNode.active = true;
        let pos = this.cellLayerCtrlList[index].node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
        this.cellLayerCtrlList[index].node.parent = layerNode;
        this.cellLayerCtrlList[index].node.position = layerNode.getComponent(UITransform).convertToNodeSpaceAR(pos);

        let bSpecial = FOXGameManager.isSpecialGame();
        if (bSpecial) {

        } else {
            this.playAvatarAnim("triSpecial");
            this.playLightAnim(true);
        }

        let mf_fastspin_00: Animation = xNodeFOX.findComponent("mf_fastspin_00", anti, Animation);
        mf_fastspin_00.node.active = true;
        mf_fastspin_00.play();
        let mf_fastspin_00_opa: UIOpacity = xNodeFOX.findComponent("mf_fastspin_00", anti, UIOpacity);
        mf_fastspin_00_opa.opacity = 0;
        tween(mf_fastspin_00_opa).to(0.5, { opacity: 255 }).start();

        let mf_fastspin_01: Animation = xNodeFOX.findComponent("mf_fastspin_01", anti, Animation);
        mf_fastspin_01.node.active = true;
        mf_fastspin_01.play();
        let mf_fastspin_01_opa: UIOpacity = xNodeFOX.findComponent("mf_fastspin_01", anti, UIOpacity);
        mf_fastspin_01_opa.opacity = 0;
        tween(mf_fastspin_01_opa).to(0.5, { opacity: 255 }).start();
    }
    stopAntiAnim() {
        if (this._playAntiIndex >= 1) {
            FOXAudioMgr.Instance.stopLongEffect("games/fastspinStart");

            let GameLayer = xNodeFOX.find("Canvas/GameLayer");
            this.stopShakeNode(GameLayer, this._shakeNodeSPos);

            let SpriteSplashOpa: UIOpacity = xNodeFOX.findComponent("panel_special/SpriteSplash", this.node, UIOpacity);
            tween(SpriteSplashOpa).to(0.5, { opacity: 0 }).start()
            let x10_b: UIOpacity = xNodeFOX.findComponent("panel_special/x10_b", this.node, UIOpacity);
            x10_b.node.active = false;

            // this.stopAntiAnim(1)
            let anti = xNodeFOX.find("panel_special/anti" + this._playAntiIndex, this.node);
            let mf_fastspin_00_opa: UIOpacity = xNodeFOX.findComponent("mf_fastspin_00", anti, UIOpacity);
            tween(mf_fastspin_00_opa).to(0.5, { opacity: 0 }).start();
            let mf_fastspin_01_opa: UIOpacity = xNodeFOX.findComponent("mf_fastspin_01", anti, UIOpacity);
            tween(mf_fastspin_01_opa).to(0.5, { opacity: 0 }).start();


            let node_item_list = xNodeFOX.find("node_item_list", this.node);
            let pos = this.cellLayerCtrlList[this._playAntiIndex].node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
            this.cellLayerCtrlList[this._playAntiIndex].node.parent = node_item_list;
            this.cellLayerCtrlList[this._playAntiIndex].node.position = node_item_list.getComponent(UITransform).convertToNodeSpaceAR(pos);
            let layerNode = xNodeFOX.find("layerNode", anti);
            layerNode.active = false;
        }
    }


    playWinX10Anim(bPlay) {
        return new Promise<void>((resolve, reject) => {
            let x10_ani = xNodeFOX.find("x10_ani", this.node);
            x10_ani.active = bPlay;

            let mf_text_shine = xNodeFOX.find("mf_text_shine", x10_ani);
            let x10_b = xNodeFOX.find("x10_b", x10_ani);
            if (bPlay) {
                let mf_mtp_coin_00: Animation = xNodeFOX.findComponent("mf_mtp_coin_00", x10_ani, Animation);
                mf_mtp_coin_00.node.active = true;
                mf_mtp_coin_00.play();

                mf_text_shine.active = true;
                mf_text_shine.scale = new Vec3(0, 0);
                tween(mf_text_shine)
                    .to(0.5, { scale: new Vec3(1, 1) })
                    .delay(0.3)
                    .to(0.5, { scale: new Vec3(0, 0) })
                    .start();

                let x10_s = xNodeFOX.find("panel_special/x10_s", this.node);
                x10_b.scale = x10_s.scale;
                x10_b.position = x10_s.parent.getComponent(UITransform).convertToNodeSpaceAR(x10_s.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0)));
                let ePos = x10_b.parent.getComponent(UITransform).convertToNodeSpaceAR(this.layerCtrl.optCtrl.getWinBigPos());
                FOXAudioMgr.Instance.playSound("games/multiplierIn");
                tween(x10_b)
                    .to(0.5, { scale: new Vec3(1, 1), position: new Vec3(0, 0) })
                    .delay(0.3)
                    .call(() => { FOXAudioMgr.Instance.playSound("games/multiplierOut"); })
                    .to(0.5, { scale: new Vec3(0.2, 0.2), position: ePos })
                    .call(() => {
                        x10_ani.active = false;
                        this.layerCtrl.optCtrl.playBigAwardMult10Anim();
                        resolve()
                    })
                    .delay(0.5)
                    .start()
            } else {
                Tween.stopAllByTarget(mf_text_shine);
                Tween.stopAllByTarget(x10_b);
                resolve();
            }
        })

    }


    // 特殊游戏开始旋转光效动画
    playSpecialStartMoveAnim() {
        FOXAudioMgr.Instance.playSound("games/featureRespinReelStart");
        let mf_respin = xNodeFOX.find("panel_special/mf_respin", this.node);
        mf_respin.active = true;
        mf_respin.children.forEach((node) => {
            if (node.getComponent(Animation)) {
                node.getComponent(Animation).play();
            }
        })
    }


    // setAvatarNormalPos(bNormal) {
    //     let pos;
    //     if (bNormal) {
    //         pos = xNodeFOX.find("avatar_nor_pos", this.node).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
    //     } else {
    //         pos = xNodeFOX.find("avatar_spe_pos", this.node).getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 0, 0));
    //     }

    //     this._avatarSp.node.position = this._avatarSp.node.parent.getComponent(UITransform).convertToNodeSpaceAR(pos)
    // }

    playAvatarAnim(type) {
        Tween.stopAllByTarget(this._avatarSp);
        this._isAvaterPlayOther = true;
        let guangSp: sp.Skeleton = xNodeFOX.findComponent("guang", this._avatarSp.node, sp.Skeleton);
        if (type == "triSpecial") { // 触发特殊
            FOXAudioMgr.Instance.playSound("games/voxGoldIn");
            this._avatarSp.setAnimation(0, "rs_start", false);
            this._avatarSp.addAnimation(0, "rs_idle", true);
        } else if (type == "triSpecialSucc") {  // 触发特殊成功
            FOXAudioMgr.Instance.playSound("games/voxJump");
            this._avatarSp.setAnimation(0, "dup", false);
            this._avatarSp.addAnimation(0, "rs_idle", true);
        } else if (type == "triSpecialFail") { // 触发特殊失败
            FOXAudioMgr.Instance.playSound("games/voxGoldQuit");
            let entry = this._avatarSp.setAnimation(0, "rs_exit", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "endSpecial") {  // 特殊返回
            FOXAudioMgr.Instance.playSound("games/voxGoldQuit");
            let entry = this._avatarSp.setAnimation(0, "rs_exit", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        }
        if (type == "wildCollect") { // wild图标收集
            FOXAudioMgr.Instance.playSound("games/voxWild");

            let entry = this._avatarSp.setAnimation(0, "wild_collect", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })

            let animN = ""
            if (this._wildFlyCnt > 12) {
                animN = "fx_wild_collect3";
            } else if (this._wildFlyCnt > 5) {
                animN = "fx_wild_collect2";
            } else {
                animN = "fx_wild_collect";
            }

            guangSp.node.active = true;
            let g_entry = guangSp.setAnimation(0, animN, false);
            guangSp.setTrackCompleteListener(g_entry, () => {
                guangSp.setTrackCompleteListener(g_entry, null);
                guangSp.node.active = false;
            })

            let sweep_anim: Animation = xNodeFOX.findComponent("wc_ingot_sweep_00", this._avatarSp.node, Animation);
            let particle_anim: Animation = xNodeFOX.findComponent("wc_ingot_particle_00", this._avatarSp.node, Animation);
            sweep_anim.node.active = true;
            sweep_anim.play();
            particle_anim.node.active = true;
            particle_anim.play();
        } else if (type == "win") { // 普通赢1
            let entry = this._avatarSp.setAnimation(0, "win", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "win2") {  //  普通赢2
            let entry = this._avatarSp.setAnimation(0, "win2", false);
            this._avatarSp.setTrackCompleteListener(entry, () => {
                this._avatarSp.setTrackCompleteListener(entry, null);
                this.playAvatarIdleAnim();
            })
        } else if (type == "win_X10") { // 赢10倍
            this._avatarSp.setAnimation(0, "rs_win", false);
            this._avatarSp.addAnimation(0, "rsg_win_idle", true);
        }

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
                        FOXAudioMgr.Instance.playSound("games/voxIdle");

                        delayTime = 30 + Math.random() * 5;
                        // let animType = Math.floor(Math.random() * 3) + 2;
                        this._avatarSp.setAnimation(0, "idle2", false);
                        this._avatarSp.addAnimation(0, "idle", true);
                    })
            )
            .start()
    }

    roundEnd() {
        if (this.frame?.winAmount) this.playGoldFlyAni();
        FOXGameManager.restRound();
        this._canCLickMultPanel = true;
        this.layerCtrl.onPlayFinished();
    }

    playGoldFlyAni() {
        return
    

    }


    update(dt: number) {
        if (!this._startMove || !this.frame || !this._canStop || this._startLayerCnt !== FOXConstant.COL_COUNT) return;
        this._minIdleT -= dt;
        if (this._minIdleT > 0 && !FOXGameManager.getStop()) return;
        FOXGameManager.setRoundTime(FOXGameManager.getRoundTime() + dt);
        if (FOXGameManager.getCanStop().state !== 1) return;
        this._startMove = false;
        this.cellLayerCtrlList.forEach((reel, col) => {
            reel.setResultData(FOXGameManager.getResultData(col));
            reel.setDelayT(FOXGameManager.getNormalDelayT(col));
            reel.setStopMove(true);
        });
    }
}
