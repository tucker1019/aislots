import { _decorator, Component, instantiate, Node, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { FCConstant, RandomCellType } from '../../FCConstant/FCConstant';
import { IgetCanStop, FCGameManager } from '../../mgr/FCGameManager';
import FCLoadManager from '../../load/FCLoadManager';
import { FCCellItem } from './FCCellItem';
import FCCenterRollCtrl from './FCCenterRollCtrl';
// import { FCCellBigWild } from './FCCellBigWild';
import { fcframe } from '../../../fcframe/fcframe';
import { FCAudioMgr } from './FCAudioMgr';
import { xNodeFC } from '../../../xtools/xNodeFC';
const { ccclass, property } = _decorator;

@ccclass('FCCellLayer')
export class FCCellLayer extends Component {

    slotsCtrl: FCCenterRollCtrl;
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

    get topY() {
        return FCConstant.CELL_SIZE.height * (FCConstant.ROW_COUNT + 3 / 2);
    }
    get bottomY() {
        return -FCConstant.CELL_SIZE.height / 2;
    }
    getTopYWorldPos() {
        return this.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, this.topY, 0));
    }
    getBottomYWorldPos() {
        return this.node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, this.bottomY, 0));
    }

    init(index: number, slotsCtrl: FCCenterRollCtrl) {
        this.index = index;
        this.slotsCtrl = slotsCtrl;
    }

    creatOne() {
        this.node.removeAllChildren();
        for (let i = 0; i < FCConstant.ROW_COUNT + 2; i++) {  // 上下都余一个
            let type = FCGameManager.getRandomType();
            let prefab = FCLoadManager.ins.getPrefab(FCConstant.PRAFAB_CELL);
            let node = instantiate(prefab);
            node.parent = this.node;
            node.setPosition(new Vec3(0, this.bottomY + i * FCConstant.CELL_SIZE.height, 0));
            node.getComponent(FCCellItem).initTypeView(type, this.slotsCtrl);
            this.allCellList.push(node);
            node.active = i > 0;
            if (i > 0) {
                this.resultCell[i - 1] = node;
            }
        }
    }

    setResultData(data: number[]) {
        this.resultData = [...data, FCGameManager.getRandomType()];
        this._tempResultData = this.resultData.slice();
    }

    // getTempResultData() {
    //     let _tempResultData = this.resultData.slice(0);
    //     if (FCGameManager.isSpecialGame()) {
    //         let index = FCGameManager.getFreeIndex();
    //         index += 1; // 从-1开始的
    //         if (index > 0) {
    //             // 已经存在的就设为空
    //             let lastData = FCGameManager.getSpecialData(this.index, index - 1);
    //             for (let i = 0; i < lastData.length; i++) {
    //                 if (_tempResultData[i] != 0 && _tempResultData[i] == lastData[i]) {
    //                     _tempResultData[i] = 0;
    //                 }
    //             }
    //         }
    //     }
    //     return _tempResultData;
    // }

    // 恢复普通节点
    resumeSpecial() {
        this._tempResultData = this.resultData.slice(0);
        let nodelist = this.allCellList.slice(0);
        for (let i = 0; i < nodelist.length; i++) {
            Tween.stopAllByTarget(nodelist[i]);
            nodelist[i].setPosition(new Vec3(0, this.bottomY + i * FCConstant.CELL_SIZE.height, 0));

            let type = i > 0 ? this._tempResultData.shift() : FCGameManager.getRandomType();
            nodelist[i].getComponent(FCCellItem).setTypeView(type);

            if (i > 0) {
                nodelist[i].getComponent(FCCellItem).index = (i - 1) * FCConstant.COL_COUNT + this.index;
                this.resultCell[i - 1] = nodelist[i];
            }
        }
    }

    resData() {
        this._startMove = false;
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
        if (FCGameManager.getFastAndNoFree() || FCGameManager.isSpecialGame()) {
            this.allCellList.forEach((node) => { node.active = true });
            this.oneRoll();
            this.slotsCtrl.playStartRoll(this.index);
        } else {
            let num1 = 35;
            let rollCnt1 = 0;
            let rollCnt2 = 0;
            for (let i = 0; i < this.node.children.length; i++) {
                let node = this.node.children[i];
                tween(node)
                    .delay(0.08 * this.index)
                    .call(() => {
                        this.allCellList.forEach((node) => { node.active = true });
                        rollCnt1 += 1;
                        if (rollCnt1 == this.node.children.length) {
                            this.slotsCtrl.playStartRoll(this.index);
                        }
                    })
                    .by(0.1, { position: new Vec3(0, num1, 0) }, { easing: "quadOut" })
                    .by(0.1, { position: new Vec3(0, -num1, 0) })
                    .call(() => {
                        rollCnt2 += 1;
                        if (rollCnt2 == this.node.children.length) {
                            this.oneRoll();
                        }
                    })
                    .start();
            }
        }
    }

    // 一列滚动
    oneRoll(bStop = false, time = FCGameManager.getRollTime()) {
        // let isFree = FCGameManager.isStateFree();
        let runIndex = 0;
        for (let i = 0; i < this.node.children.length; i++) {
            let node = this.node.children[i];
            if (node.position.y <= this.bottomY) {
                node.setPosition(new Vec3(0, this.topY, 0));
                if (bStop) {
                    let type = this._tempResultData.length > 0 ? this._tempResultData.shift() : FCGameManager.getRandomType();
                    node.getComponent(FCCellItem).setTypeView(type);
                    node.getComponent(FCCellItem).index = (this.resultData.length - this._tempResultData.length - 1) * FCConstant.COL_COUNT + this.index;

                    this.resultCell.push(node);
                } else {
                    let type = FCGameManager.getRandomType();
                    // console.log(type);
                    node.getComponent(FCCellItem).setTypeView(type, true);
                }
            }

            tween(node)
                .by(time, { position: new Vec3(0, -FCConstant.CELL_SIZE.height, 0) })
                .call(() => {
                    if (runIndex == this.node.children.length - 1) {
                        if (bStop && this._tempResultData.length == 0) {
                            this.backRoll();
                        } else {
                            if (this._canStop) {
                                if (FCGameManager.getStop()) {    // 手动stop，不再下落，所有cell显示最终的type
                                    this.stopRollClick();
                                }
                                else if (FCGameManager.getFastAndNoFree()) {
                                    this.oneRoll(true)
                                }
                                else {
                                    if (this._tempResultData.length == this.resultData.length) {
                                        this.slotsCtrl.playReadyToStop(this.index);
                                    }
                                    this.oneRoll(true)
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
        fcframe.log.logView("overSpringBack");
        let num1 = -30;
        let backAni = tween().by(0.06, { position: new Vec3(0, num1, 0) }).by(0.35, { position: new Vec3(0, -num1, 0) });

        this.slotsCtrl.playBackRoll(this.index);

        let isPlaySpecialEff = false;

        // if (FCGameManager.isSpecialGame()) {
        //     let _tempResultData = this.getTempResultData().slice(0, 3);
        //     if (_tempResultData.findIndex(value => value > 0) >= 0) {
        //         isPlaySpecialEff = true;
        //         FCAudioMgr.Instance.playSound("games/wild");
        //     }
        // }

        if (FCGameManager.getStop() || FCGameManager.getFastAndNoFree()) {
            if (this.index == FCConstant.COL_COUNT - 1) {
                FCAudioMgr.Instance.playSound("games/Stop2");
            }
        } else {
            FCAudioMgr.Instance.playSound("games/Stop1");
        }

        const nodes = [...this.node.children];
        let stopCnt = 0;
        const complete = () => {
            if (++stopCnt !== nodes.length) return;
            // Cocos pauses actions on deactivated nodes. Keep the buffer active until
            // its bounce callback has run, then hide it with the original mask.
            for (const node of nodes) if (node.position.y < 0) node.active = false;
            this.stopRoll();
        };
        const fast = FCGameManager.getFastAndNoFree();
        for (const node of nodes) {
            if (fast) complete();
            else backAni.clone(node).call(complete).start();
        }
    }

    // 停止转动
    stopRoll() {
        if (!FCGameManager.isSpecialGame()) {
            for (let i = 0; i < FCConstant.ROW_REAL_COUNT[this.index]; i++) {
                let cellTop = this.slotsCtrl.copyCellToTop(this.resultCell[i]);
                cellTop.getComponent(FCCellItem).playStopAnim();
                this.resultCell[i].active = false
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
            nodelist[i].setPosition(new Vec3(0, this.bottomY + i * FCConstant.CELL_SIZE.height, 0));

            let type = i > 0 ? this._tempResultData.shift() : FCGameManager.getRandomType();
            nodelist[i].getComponent(FCCellItem).setTypeView(type);

            if (i > 0) {
                nodelist[i].getComponent(FCCellItem).index = (i - 1) * FCConstant.COL_COUNT + this.index;
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
        if (this._startMove) {
            if (this._stopMove && !this._canStop) {
                if (FCGameManager.getStop()) {
                    this._canStop = true;
                    this.stopRollClick();
                }
                else if (FCGameManager.getFastAndNoFree()) {
                    this._canStop = true;
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
showStoredSymbols(symbols: number[]) {
        this.resData();
        this.allCellList.forEach((node, i) => {
            Tween.stopAllByTarget(node);
            node.setPosition(new Vec3(0, this.bottomY + i * FCConstant.CELL_SIZE.height, 0));
            const cell = node.getComponent(FCCellItem);
            cell.setTypeView(i > 0 && i <= symbols.length ? symbols[i - 1] : FCGameManager.getRandomType());
            cell.index = (i - 1) * FCConstant.COL_COUNT + this.index;
            node.active = i > 0;
            if (i > 0) this.resultCell.push(node);
        });
    }

}

