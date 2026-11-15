import { _decorator, Component, instantiate, Node, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { FOXConstant, RandomCellType } from '../../FOXConstant/FOXConstant';
import { IgetCanStop, FOXGameManager } from '../../mgr/FOXGameManager';
import FOXLoadManager from '../../load/FOXLoadManager';
import { FOXCellItem } from './FOXCellItem';
import FOXCenterRollCtrl from './FOXCenterRollCtrl';
import { foxframe } from '../../../foxframe/foxframe';
import { FOXAudioMgr } from './FOXAudioMgr';
import { xNodeFOX } from '../../../xtools/xNodeFOX';
const { ccclass, property } = _decorator;

@ccclass('FOXCellLayer')
export class FOXCellLayer extends Component {

    slotsCtrl: FOXCenterRollCtrl;
    _index = 0; // 第几列，0开始
    set index(index) {
        this._index = index;
    }
    get index() {
        return this._index;
    }

    allCellList = [];   // 一列所有的cell
    resultData = [];    // 一列最终的type
    _tempResultData = [];  // 复制resultData，用于给每个cell传值
    resultCell = [];    // 停止后牌面上的cell，从下往上，只包含卷轴显示的cell

    _startMove: boolean = false;
    _canStop: boolean = false;
    _remailT: number = -1;
    _bPlayAnti: boolean = false;
    _stopMove = false;
    private starting = false;

    get topY() {
        return FOXConstant.CELL_SIZE.height * (FOXConstant.ROW_COUNT + 3 / 2);
    }
    get bottomY() {
        return -FOXConstant.CELL_SIZE.height / 2;
    }
    getTopYWorldPos() {
        return this.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, this.topY, 0));
    }
    getBottomYWorldPos() {
        return this.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, this.bottomY, 0));
    }

    init(index: number, slotsCtrl: FOXCenterRollCtrl) {
        this.index = index;
        this.slotsCtrl = slotsCtrl;
    }

    creatOne() {
        this.node.removeAllChildren();
        for (let i = 0; i < FOXConstant.ROW_COUNT + 2; i++) {  // 上下都余一个
            let type = FOXGameManager.getRandomType();
            let prefab = FOXLoadManager.ins.getPrefab(FOXConstant.PRAFAB_CELL);
            let node = instantiate(prefab);
            node.parent = this.node;
            node.setPosition(new Vec3(0, this.bottomY + i * FOXConstant.CELL_SIZE.height, 0));
            node.getComponent(FOXCellItem).initTypeView(type, this.slotsCtrl);
            this.allCellList.push(node);
            node.active = i > 0;
            if (i > 0) {
                this.resultCell[i - 1] = node;
            }
        }
    }

    showStoredSymbols(symbols: number[]) {
        this.resData();
        this.allCellList.forEach((node, i) => {
            Tween.stopAllByTarget(node);
            node.setPosition(new Vec3(0, this.bottomY + i * FOXConstant.CELL_SIZE.height, 0));
            const cell = node.getComponent(FOXCellItem);
            cell.setTypeView(i > 0 && i <= symbols.length ? symbols[i - 1] : FOXGameManager.getRandomType());
            cell.index = (i - 1) * FOXConstant.COL_COUNT + this.index;
            node.active = i > 0;
            if (i > 0) this.resultCell.push(node);
        });
    }

    setResultData(data: number[]) {
        this.resultData = Array.from({length:FOXConstant.ROW_COUNT + 1}, (_,i) => data[i] ?? FOXGameManager.getRandomType());
        this._tempResultData = this.resultData.slice();
    }

    // 恢复普通节点
    resumeSpecial() {
        this._tempResultData = this.resultData.slice(0);
        let nodelist = this.allCellList.slice(0);
        for (let i = 0; i < nodelist.length; i++) {
            Tween.stopAllByTarget(nodelist[i]);
            nodelist[i].setPosition(new Vec3(0, this.bottomY + i * FOXConstant.CELL_SIZE.height, 0));

            let type = i > 0 ? this._tempResultData.shift() : FOXGameManager.getRandomType();
            nodelist[i].getComponent(FOXCellItem).setTypeView(type);

            if (i > 0) {
                nodelist[i].getComponent(FOXCellItem).index = (i - 1) * FOXConstant.COL_COUNT + this.index;
                this.resultCell[i - 1] = nodelist[i];
            }
        }
    }

    resData() {
        this._startMove = false;
        this.starting = false;
        this._canStop = false;
        this._remailT = -1;
        this.resultData = [];
        this.resultCell = [];
        this._tempResultData = [];
        this._stopMove = false;

    }

    setStartMove() {
        if (!this._startMove) {
            this._startMove = true;
            this.startRoll();
        }
    }

    setRemainT(time) {
        this._remailT = time;
    }

    // 开始前有回弹
    startRoll() {
        this.starting = true;
        // if (FOXGameManager.getFastAndNoFree() || FOXGameManager.isSpecialGame()) {
        this.allCellList.forEach((node) => { node.active = true });
        //     this.oneRoll();
        //     this.slotsCtrl.playStartRoll(this.index);
        // } else {
        let num1 = 35;
        let rollCnt1 = 0;
        let rollCnt2 = 0;
        for (let i = 0; i < this.node.children.length; i++) {
            let node = this.node.children[i];
            let delayT = FOXGameManager.getFastAndNoFree() ? 0 : 0.1 * this.index;
            tween(node)
                .delay(delayT)
                .call(() => {
                    // this.allCellList.forEach((node) => { node.active = true });
                    rollCnt1 += 1;
                    if (rollCnt1 == this.node.children.length) {
                        this.slotsCtrl.playStartRoll(this.index);
                    }
                })
                .by(0.1, { position: new Vec3(0, num1, 0) }, { easing: "quadOut" })
                .by(0.05, { position: new Vec3(0, -num1, 0) })
                .call(() => {
                    rollCnt2 += 1;
                    if (rollCnt2 == this.node.children.length) {
                        this.starting = false;
                        this.oneRoll();
                    }
                })
                .start();
        }
        // }
    }

    // 一列滚动
    oneRoll(bStop = false, time = FOXGameManager.getRollTime()) {
        // let isFree = FOXGameManager.isStateFree();
        let runIndex = 0;
        for (let i = 0; i < this.node.children.length; i++) {
            let node = this.node.children[i];
            if (node.position.y <= this.bottomY) {
                node.setPosition(new Vec3(0, this.topY, 0));

                if (bStop) {
                    let type = this._tempResultData.length > 0 ? this._tempResultData.shift() : FOXGameManager.getRandomType();
                    node.getComponent(FOXCellItem).setTypeView(type);
                    node.getComponent(FOXCellItem).index = (this.resultData.length - this._tempResultData.length - 1) * FOXConstant.COL_COUNT + this.index;
                    this.resultCell.push(node);
                } else {
                    let type = FOXGameManager.getRandomType();
                    node.getComponent(FOXCellItem).setTypeView(type, true);
                }
            }

            tween(node)
                .by(time, { position: new Vec3(0, -FOXConstant.CELL_SIZE.height, 0) })
                .call(() => {
                    if (runIndex == this.node.children.length - 1) {
                        if (bStop && this._tempResultData.length == 0) {
                            this.backRoll();
                        } else {
                            if (this._canStop) {
                                if (FOXGameManager.getStop()) {    // 手动stop，不再下落，所有cell显示最终的type
                                    this.stopRollClick();
                                }
                                else if (FOXGameManager.getFastAndNoFree()) {
                                    this.oneRoll(true)
                                }
                                else {
                                    if (this._tempResultData.length == this.resultData.length) {
                                        this.slotsCtrl.playReadyToStop(this.index);
                                    }
                                    let delay2 = (this.resultData.length - this._tempResultData.length) * 0.01// * 2;
                                    // if (FOXGameManager.isSpecialGame() && this.index == 2) {
                                    //     delay2 += 0.04
                                    // }
                                    this.oneRoll(true, FOXGameManager.getRollTime() + delay2)
                                }
                            } else {
                                this.oneRoll()
                            }
                        }
                    }
                    runIndex++;
                })
                .start();
        }
    }

    // 滚动回弹
    backRoll() {
        foxframe.log.logView("overSpringBack");

        let num1 = 30;
        let delay2 = FOXGameManager.getRollTime() + (this.resultData.length - this._tempResultData.length) * 0.01 * 2 + 0.01;
        if (FOXGameManager.isSpecialGame() && this.index == 2) {
            delay2 += 0.03
        }
        let time2 = num1 / (FOXConstant.CELL_SIZE.height / delay2);
        let backAni = tween().by(time2, { position: new Vec3(0, -num1, 0) }).by(0.25, { position: new Vec3(0, num1, 0) });

        this.slotsCtrl.playBackRoll(this.index);

        let isPlaySpecialEff = false;

        // if (FOXGameManager.isSpecialGame()) {
        //     let _tempResultData = this.getTempResultData().slice(0, 3);
        //     if (_tempResultData.findIndex(value => value > 0) >= 0) {
        //         isPlaySpecialEff = true;
        //         FOXAudioMgr.Instance.playSound("games/wild");
        //     }
        // }

        if (FOXGameManager.getStop() || FOXGameManager.getFastAndNoFree()) {
            if (this.index == FOXConstant.COL_COUNT - 1) {
                FOXAudioMgr.Instance.playSound("games/spinStopQuick");
            }
        } else {
            FOXAudioMgr.Instance.playSound("games/spinStop");
        }


        if (FOXGameManager.getFastAndNoFree()) {
            this.stopRoll();
            return;
        }
        // Tween callbacks on clipped/inactive symbols are not reliable on Web Mobile.
        for (const node of this.resultCell.slice(0, FOXConstant.ROW_REAL_COUNT[this.index])) {
            backAni.clone(node).start();
        }
        this.scheduleOnce(() => this.stopRoll(), time2 + 0.25);
    }

    // 停止转动
    stopRoll() {
        if (!FOXGameManager.isSpecialGame()) {
            for (let i = 0; i < FOXConstant.ROW_REAL_COUNT[this.index]; i++) {
                if (FOXConstant.PRAFAB_LIST[this.resultCell[i].getComponent(FOXCellItem).type].stop_anim) {
                    let cellTop = this.slotsCtrl.copyCellToTop(this.resultCell[i]);
                    cellTop.getComponent(FOXCellItem).playStopAnim();
                    // this.resultCell[i].active = false;
                }
            }
        }


        this._startMove = false;
        this.slotsCtrl.playStopRoll(this.index);
    }

    // 手动停止
    stopRollClick() {
        // this._tempResultData = this.getTempResultData();
        this._tempResultData = this.resultData.slice(0);

        let nodelist = this.allCellList.slice(0);
        nodelist.sort((a, b) => {
            return a.position.y - b.position.y
        })

        this.resultCell = [];
        for (let i = 0; i < nodelist.length; i++) {
            Tween.stopAllByTarget(nodelist[i]);
            nodelist[i].setPosition(new Vec3(0, this.bottomY + i * FOXConstant.CELL_SIZE.height, 0));

            let type = i > 0 ? this._tempResultData.shift() : FOXGameManager.getRandomType();
            nodelist[i].getComponent(FOXCellItem).setTypeView(type);

            if (i > 0) {
                nodelist[i].getComponent(FOXCellItem).index = (i - 1) * FOXConstant.COL_COUNT + this.index;
                this.resultCell[i - 1] = nodelist[i];
            }
        }
        this.backRoll();
    }

    setStopMove(bVal) {
        this._stopMove = bVal;
    }

    setDelayT(delayT) {
        this._remailT = delayT;
    }
    addDelayT(delayT) {
        this._remailT += delayT;
        this.resultCell = [];
        this._tempResultData = this.resultData.slice(0);
        this._canStop = false;
    }

    protected update(dt: number): void {
        if (this._startMove && !this.starting) {
            if (this._stopMove && !this._canStop) {
                if (FOXGameManager.getStop()) {
                    this._canStop = true;
                    this.stopRollClick();
                }
                else if (FOXGameManager.getFastAndNoFree()) {
                    this._canStop = true;
                    this.stopRollClick();

                }
                else {
                    this._remailT -= dt;
                    if (this._remailT <= 0) {
                        this._canStop = true;
                    }
                }
            }

        }
    }
}

