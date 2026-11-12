import { _decorator, Component, instantiate, Tween, tween, Vec3 } from 'cc';
import { WBSConstant } from '../constant/WBSConstant';
import { WBSRollLayer } from './WBSRollLayer';
import { WBSCellItem } from './WBSCellItem';
import { wbsgame } from '../wbsgame';
const { ccclass, property } = _decorator;

@ccclass('WBSCellLayer')
export class WBSCellLayer extends Component {
    _args: {
        intervalT: number,  // 每轴滚动间隔时间
        uniformUpT: number,     // 向上匀速运动时间
        uniformUpY: number,     // 向上匀速运动距离
        normalV: number,    // 匀速运动速度(px/s)--普通模式
        fastV: number,      // 匀速运动速度(px/s)--fast模式
        easDownT: number,   // 向下匀变速运动时间
        easDownY: number,   // 向下匀变速运动距离
    } = {
            intervalT: 0.2,
            uniformUpT: 0.2,
            uniformUpY: 30,
            normalV: 3000,
            fastV: 3600,
            easDownT: 0.2,
            easDownY: 30,
        };

    slotsCtrl: WBSRollLayer;
    indexLayer: number = 0;     // 第几列
    rowCnt: number = 0;
    antiTime: number = 0;

    _tag: number = 0;
    isstop: boolean = false;

    resultData = [];    // 一列最终的type

    _startMove: boolean = false;

    get topY() {
        return this.r_height * (this.rowCnt + 3 / 2);
    }
    get bottomY() {
        return -this.r_height / 2;
    }

    get r_height() {
        return WBSConstant.CELL_SIZE.height
    }

    init(index: number, slotsCtrl: WBSRollLayer,) {
        this.indexLayer = index;
        this.rowCnt = WBSConstant.COL_COUNT_LIST[index];
        this.slotsCtrl = slotsCtrl;
        this._tag = this.indexLayer * 10;
    }

    creatOne(datas: number[]) {
        this.node.removeAllChildren();
        for (let i = 0; i < this.rowCnt + 2; i++) {  // 上下都余一个
            let node = instantiate(wbsgame.gamelayer.CellPrefab);
            node.parent = this.node;
            node.setPosition(new Vec3(0, this.bottomY + i * this.r_height, 0));
            node.setSiblingIndex(0)
            if (i > 0 && i < this.rowCnt + 1) {
                node.active = true;
                node.getComponent(WBSCellItem).initTypeView(datas[i - 1]);
                node["type"] = datas[i - 1];
                node["sortIndex"] = WBSConstant.INDICES[this.indexLayer][i - 1];
                node["pos"] = i;
                node["fallNum"] = 0;
                if (datas[i - 1] == WBSConstant.SCATTER_TYPE || datas[i - 1] % 1000 == WBSConstant.WILD_TYPE) {
                    node.getComponent(WBSCellItem).playIdleAnim(node["type"] % 1000)
                    node.setSiblingIndex(1)
                }
            } else {
                node.active = false;
                node.getComponent(WBSCellItem).initTypeView(wbsgame.gameMgr.getRandomType());
                node["type"] = -1;
                node["sortIndex"] = -1;
                node["pos"] = -1;
                node["fallNum"] = 0;
            }
        }
    }

    setResultData(data: number[]) {
        if (data && data.length > 0) {
            this.resultData = data;
        }
        console.log("========this.resultData:", this.resultData)
    }

    resData() {
        this._startMove = false;
        this.resultData = [];
        this.antiTime = 0;
    }

    setStartMove() {
        if (!this._startMove) {
            this._startMove = true;
            this.isstop = false
            this.oneRoll();
        }
    }

    // 一列滚动
    oneRoll(bStop = false,) {
        let self = this;
        let v = wbsgame.gameMgr.getFastAndNoFree() ? this._args.fastV : this._args.normalV;// 匀速 转动 速度
        let cellHeight = this.r_height;
        let cellCount = this.rowCnt;

        Tween.stopAllByTag(this._tag);
        let dt = this.indexLayer * this._args.intervalT - ((this.indexLayer == 0) ? 0 : 0.05 * (this.indexLayer - 1));
        for (let i = 0; i < this.node.children.length; i++) {
            let node = this.node.children[i];
            let nodeCtrl: WBSCellItem = node.getComponent(WBSCellItem);
            let _startVy = node.position.y;
            let vt = 0;
            let uniformUpT = this._args.uniformUpT;
            let uniformUpY = this._args.uniformUpY;
            let bindTarget = { value: 0, index: i };

            let upAnim = tween(bindTarget).to(uniformUpT, { value: uniformUpY }, {
                onUpdate(target: { value: number, index: number }) {
                    node.setPosition(new Vec3(0, _startVy + target.value, 0))
                },
                onComplete(target: { value: number, index: number }) {
                    vt = target.value;
                }
            })
            let rollAnim = tween(bindTarget).to(Number.MAX_SAFE_INTEGER, { value: Number.MAX_SAFE_INTEGER }, {
                onStart(target: { value: number, index: number }) {
                    if (target.index == self.node.children.length - 1) {
                        wbsgame.gamelayer.centerRollCtrl.playStartRoll();
                    }
                    _startVy = node.position.y;// 拿到节点开始这段运动前的y坐标
                    node.active = true;
                },
                onUpdate(target: { value: number, index: number }) {
                    // 和上一帧时间间隔=target.value - vt；
                    // 路程 = 速度 * 时间 再加上 上一帧 y坐标
                    _startVy = -v * (target.value - vt) + _startVy;

                    if (_startVy <= self.bottomY) { // 节点y坐标  <= 临界坐标 移动到上方
                        _startVy = _startVy + cellHeight * (cellCount + 2); // 实际就是 当前y坐标 + cellHeight * (cellCount + 2) 就会把差值带上

                        node.setSiblingIndex(0)
                        let type = wbsgame.gameMgr.getRandomType();
                        nodeCtrl.setTypeView(type, true);
                    }

                    node.setPosition(new Vec3(0, _startVy, 0));
                    vt = target.value
                },
            })

            if (wbsgame.gameMgr.getFastAndNoFree()) {
                tween(bindTarget).tag(this._tag).then(rollAnim).start()
            } else {
                tween(bindTarget).tag(this._tag).delay(dt).sequence(upAnim, rollAnim).start()
            }
        }
    }

    onClickStop() {
        if (!this.isstop && this.resultData && this.resultData.length > 0) {
            this.stopRoll();
        }
    }

    stopRoll(antiCnt: number = 0) {
        if (this.isstop) return
        if (antiCnt > 0) {
            this.antiTime = antiCnt * 2;
        }
        Tween.stopAllByTag(this._tag);
        this.stopRollIdling()
    }

    stopRollIdling() {
        Tween.stopAllByTag(this._tag);
        let self = this;
        let v = wbsgame.gameMgr.getFastAndNoFree() ? this._args.fastV : this._args.normalV;// 匀速 转动 速度
        let intervalTime = (wbsgame.gameMgr.getFastAndNoFree() || wbsgame.gameMgr.getStop()) ? 0.01 : this._args.intervalT * this.indexLayer + this.antiTime;
        let cellHeight = this.r_height;
        let cellCount = this.rowCnt;
        for (let i = 0; i < this.node.children.length; i++) {
            let node = this.node.children[i];
            let _startVy = 0;
            let vt = 0;
            let bindTarget = { value: 0, index: i };
            tween(bindTarget)
                .tag(this._tag)
                .to(intervalTime, { value: intervalTime }, {
                    onStart() {
                        _startVy = node.position.y;
                    },
                    onUpdate(target: { value: number, index: number }) {
                        _startVy = -v * (target.value - vt) + _startVy;
                        if (_startVy <= self.bottomY) {
                            _startVy = _startVy + cellHeight * (cellCount + 2);
                            node.setSiblingIndex(0)
                        }
                        node.setPosition(new Vec3(0, _startVy, 0));
                        vt = target.value
                    },
                    onComplete(target: { value: number, index: number }) {
                        if (target.index == self.node.children.length - 1) {
                            self.stopRollReady();
                        }
                    }
                })
                .start()
        }
    }

    stopRollReady() {
        Tween.stopAllByTag(this._tag);
        let self = this;
        let v = wbsgame.gameMgr.getFastAndNoFree() ? this._args.fastV : this._args.normalV;// 匀速 转动 速度
        let cellHeight = this.r_height;
        let cellCount = this.rowCnt;

        let sortedArr = [...this.node.children].sort((a, b) => a.position.y - b.position.y)
        for (let i = 0; i < this.node.children.length; i++) {
            let node = this.node.children[i];
            let nodeCtrl: WBSCellItem = node.getComponent(WBSCellItem);
            let _startVy = node.position.y;
            let vt = 0;
            let endIndex = sortedArr.indexOf(node);
            let endy = this.bottomY + endIndex * this.r_height;
            let type = endIndex > 0 && self.resultData[endIndex - 1] ? self.resultData[endIndex - 1] : wbsgame.gameMgr.getRandomType();
            let siblingIndex = self.rowCnt + 1 - endIndex;
            let isExtra = (endIndex == 0 || endIndex == this.rowCnt + 1);
            node["pos"] = isExtra ? -1 : endIndex;
            node["type"] = type;
            node["sortIndex"] = isExtra ? -1 : WBSConstant.INDICES[this.indexLayer][endIndex - 1];
            if (!isExtra && (type % 1000 == WBSConstant.WILD_TYPE || type == WBSConstant.SCATTER_TYPE)) {
                siblingIndex += 1;
            }
            let bindTarget = { value: 0, index: i };
            if (wbsgame.gameMgr.getFastAndNoFree() || wbsgame.gameMgr.getStop()) {
                tween(bindTarget)
                    .tag(this._tag)
                    .to(0.01, { value: 0.01 }, {
                        onComplete(target: { value: number, index: number }) {
                            node.setPosition(new Vec3(0, endy, 0));
                            nodeCtrl.setTypeView(type, false);
                            node.setSiblingIndex(siblingIndex);
                            node.active = !isExtra;

                            if (target.index == self.rowCnt + 1) {
                                self.stopRollBack();
                            }
                        }
                    })
                    .start()
            } else {
                let dropT = (this.r_height * (cellCount + 2) + _startVy - endy) / v
                tween(bindTarget)
                    .tag(this._tag)
                    .to(dropT, { value: dropT }, {
                        onStart() {
                            _startVy = node.position.y;
                        },
                        onUpdate(target: { value: number, index: number }) {
                            _startVy = -v * (target.value - vt) + _startVy;
                            if (_startVy <= self.bottomY) {
                                _startVy = _startVy + cellHeight * (cellCount + 2);
                                nodeCtrl.setTypeView(type, false);
                                node.setSiblingIndex(siblingIndex);
                            }
                            node.setPosition(new Vec3(0, _startVy, 0));
                            vt = target.value
                        },
                        onComplete(target: { value: number, index: number }) {
                            node.active = !isExtra;
                            node.setPosition(new Vec3(0, endy, 0));
                            if (target.index == self.node.children.length - 1) {
                                self.stopRollBack();
                            }
                        }
                    })
                    .start();
            }
        }
    }

    stopRollBack() {
        let specialList = wbsgame.gameMgr.getSpecialList();
        if (specialList && specialList[this.indexLayer] && specialList[this.indexLayer].effName) {
            wbsgame.audioMgr.playSound(specialList[this.indexLayer].effName);
        } else {
            if (wbsgame.gameMgr.getFastAndNoFree() || wbsgame.gameMgr.getStop()) {
                if (this.indexLayer == WBSConstant.MAX_COUNT - 1) {
                    wbsgame.audioMgr.playSound("spinStopQuick");
                }
            } else {
                wbsgame.audioMgr.playSound("spinStop");
            }
        }
        if (!wbsgame.gameMgr.getFastAndNoFree() && !wbsgame.gameMgr.getStop() && specialList && specialList[this.indexLayer + 1] && specialList[this.indexLayer + 1].playAnti) {
            wbsgame.gamelayer.centerRollCtrl.playAntiAnim(this.indexLayer + 1);
        } else {
            wbsgame.gamelayer.centerRollCtrl.playAntiAnim(-1);
        }

        this.isstop = true;
        Tween.stopAllByTag(this._tag);
        let self = this;

        let sortedArr = [...this.node.children].sort((a, b) => a.position.y - b.position.y)
        for (let i = 0; i < this.node.children.length; i++) {
            let node = this.node.children[i];
            let nodeCtrl: WBSCellItem = node.getComponent(WBSCellItem);
            let endIndex = sortedArr.indexOf(node);
            let endy = this.bottomY + endIndex * this.r_height;
            let bindTarget = { value: 0, index: i };
            let isExtra = (endIndex == 0 || endIndex == this.rowCnt + 1)
            node["pos"] = isExtra ? -1 : endIndex;

            if (!isExtra && node["type"] == WBSConstant.SCATTER_TYPE) {
                nodeCtrl.playScaStopAnim(node["type"]);
            } else {
                nodeCtrl.playSpawnAnim(node["type"]);
            }

            if (bindTarget.index == this.rowCnt + 1) {
                self._startMove = false;
                self.slotsCtrl.playStopRoll(self.indexLayer);
            }
        }
    }

    /**设置下落的距离*/
    addFullSpace(pos) {
        if (pos || pos != null) {
            for (let node of this.node.children) {
                if (node["pos"] > pos) {
                    node["fallNum"] += 1;
                }
            }
        }

    }

    /** 现有图标下落 */
    cellFall(delayTime: number = 0) {
        let hasDrop = false;
        for (let node of this.node.children) {
            let fallNum = node["fallNum"];
            if (fallNum > 0) {
                hasDrop = true;
                let nodeTop = wbsgame.gamelayer.centerRollCtrl.getCellTopByIdx(node["sortIndex"] + 1);
                let new_pos = node["pos"] - fallNum;
                node["pos"] = new_pos;
                node["fallNum"] = 0;
                node["sortIndex"] = WBSConstant.INDICES[this.indexLayer][new_pos - 1];

                let dropT = wbsgame.gameMgr.getFastAndNoFree() ? 0.08 : 0.10;
                let dropY = this.r_height * fallNum;
                let endy = node.position.y;
                let hasTop = nodeTop && (node["type"] == WBSConstant.SCATTER_TYPE || node["type"] % 1000 == WBSConstant.WILD_TYPE)

                tween(node).delay(delayTime)
                    .to(dropT, { position: new Vec3(0, endy - dropY, 0) })
                    .by(0.05, { position: new Vec3(0, 30, 0) })
                    .by(0.05, { position: new Vec3(0, -30, 0) })
                    .start()
                if (hasTop) {
                    nodeTop.name = `cellWin_${node["sortIndex"] + 1}`;
                    let endTopx = nodeTop.position.x;
                    let endTopy = nodeTop.position.y;
                    tween(nodeTop).delay(delayTime)
                        .to(dropT, { position: new Vec3(endTopx, endTopy - dropY, 0) })
                        .by(0.05, { position: new Vec3(0, 30, 0) })
                        .by(0.05, { position: new Vec3(0, -30, 0) })
                        .start()
                }
            }
        }
        return hasDrop;
    }

    creatTopItem(datas: number[], delayTime: number, bPlayStopEff: boolean = false) {
        let hasDrop = false;
        let s_l = this.node.children.length;
        let max = this.rowCnt + 2;
        let dropT = wbsgame.gameMgr.getFastAndNoFree() ? 0.08 : 0.10;
        for (let i = s_l; i < max; i++) {
            hasDrop = true;
            let node = instantiate(wbsgame.gamelayer.CellPrefab);
            node.parent = this.node;
            node.active = true;
            node.setPosition(new Vec3(0, this.topY, 0));
            node.setSiblingIndex(0)
            // this.allCellList.push(node);
            let real_idx = i - 2;
            node.active = true;
            node.getComponent(WBSCellItem).initTypeView(datas[real_idx]);
            // this.resultCell[real_idx] = node;
            node["type"] = datas[real_idx];
            node["sortIndex"] = WBSConstant.INDICES[this.indexLayer][real_idx];
            node["pos"] = real_idx + 1;
            node["fallNum"] = 0;

            tween(node).delay(delayTime)
                .to(dropT, { position: new Vec3(0, this.bottomY + (real_idx + 1) * this.r_height, 0) })
                .by(0.05, { position: new Vec3(0, 30, 0) })
                .by(0.05, { position: new Vec3(0, -30, 0) })
                .call(() => {
                    if (bPlayStopEff) {
                        wbsgame.audioMgr.playSound("heartBeatSlowdrop")
                    }
                    if (node["type"] == WBSConstant.SCATTER_TYPE) {
                        node.getComponent(WBSCellItem).playScaStopAnim(node["type"]);
                    }
                })
                .start()
        }
        return hasDrop;
    }

    getCellByRow(row) {
        for (let i = 0; i < this.node.children.length; i++) {
            if (this.node.children[i]["pos"] == row + 1) {
                return this.node.children[i]
            }
        }

        return null;
    }

    protected update(dt: number): void {
    }
}

