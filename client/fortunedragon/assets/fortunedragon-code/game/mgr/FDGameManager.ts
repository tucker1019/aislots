
import { fdframe } from "../../fdframe/fdframe";
import type { Rotation } from "../net/FDResultAdapter";
import { cloneArray, mergeObjectRecursion } from "../common/FDUtils";
import { FDConstant, FDSTATE, RandomCellType } from "../FDConstant/FDConstant";
import { FDGlobal } from "../view/layer/FDGlobal";

export interface IgetCanStop {
    state: number  // -1 已返回数据 ，等待转轮最小转动时间  0  等待返回中  1 成功返回 2 超时未返回
    tip?: string //提示
}
class M {

    private _state: FDSTATE = 0; //游戏状态
    private _multiples: number[] = [];
    private _allMultiples: number[] = [];
    private _totalBitList: number[] = [];

    private _Money: number = 0
    private _bitIndex: number = 0;
    private _bitMultIndex: number = 0;
    private _totalBitIndex: number = 0;
    private _mRotateData: Rotation = null;



    private _winAllMoney: number = 0;
    private _winAllMoneyR: number = 0;  //-- 总赢钱，一局结束不清除

    private _winMoney: number = 0;

    private _roundTime: number = 0;// 一轮转动时间

    private _Stop: boolean = false;// 是否点击暂停
    private _Fast: boolean = false;//是否点击fast

    private _haveStoped: number = 0;
    private _audoNum: number = 0;

    private _specialList = [];

    private _randomList = [];   // 随机图标list

    private _isAnt: boolean = false;

    betLevel = 10;
    lineCount = 5;
    visualStake?: number;
    getCanStop(): IgetCanStop {
        return {state: this._mRotateData ? 1 : 0};
    }

    getRandomType() {
        this._randomList = FDConstant.CELLTYPE_ALL;
        return this._randomList[Math.floor(Math.random() * this._randomList.length)];
    }


    resOneRound() {
        this._roundTime = 0;
        this._haveStoped = 0;
        this._specialList = [];
        this._Stop = false;
    }

    restRound() {
        this._state = 0; //游戏状态
        this._Money = 0
        this._mRotateData = null;
        // this._winAllMoney = 0;
        this._winMoney = 0;
        this._roundTime = 0;// 一轮转动时间
        this._Stop = false;// 是否点击暂停
        this._haveStoped = 0;
        this._specialList = [];
        this.setState(FDSTATE.READY);
    }


    canPlay(): boolean {
        let gold = FDGlobal.USER.gold;
        if (gold >= this.getTotalBitNum()) {
            return true
        }
        return false
    }

    isStateFree(): boolean {
        return this._state == FDSTATE.FREEING
    }

    setAudoNum(audoNum: number) {
        this._audoNum = audoNum;
    }
    getAudoNum(): number {
        return this._audoNum
    }

    setHaveStoped(haveStoped: number) {
        this._haveStoped = haveStoped;

    }
    getHaveStoped() {
        return this._haveStoped || 0;
    }


    setStop(Stop: boolean) {
        this._Stop = Stop;
    }
    getStop(): boolean {
        return this._Stop
    }


    setFast(fast: boolean) {
        this._Fast = fast;
    }

    getFast(): boolean {
        return this._Fast
    }

    getFastAndNoFree() {
        return this._Fast && !this.isStateFree()
    }

    setState(state: FDSTATE) {
        this._state = state;
    }
    getState(): FDSTATE {
        return this._state
    }
    setRoundTime(roundTime: number) {
        this._roundTime = roundTime;
    }
    getRoundTime(): number {
        return this._roundTime
    }

    setWinAllMoney(winAllMoney: number) {
        this._winAllMoney = winAllMoney
    }
    getWinAllMoney(): number {
        return this._winAllMoney
    }

    setWinAllMoneyR(val) {
        this._winAllMoneyR = val;
    }
    getWinAllMoneyR() {
        return this._winAllMoneyR;
    }

    setWinMoney(winMoney: number) {
        this._winMoney = winMoney
    }
    getWinMoney(): number {
        return this._winMoney || 0;
    }
    setRotateData(mRotateData: Rotation) {
        this._mRotateData = mRotateData;
    }

    getRotateData(): Rotation {
        return this._mRotateData;
    }

    // 每一列的值
    getResultData(index) {
        let mIcons = this.getRotateData()?.mIcons;

        if (mIcons) {
            let data = mIcons.slice(0, 9).filter((value, idx) => idx % FDConstant.COL_COUNT == index)
            return data;
        } else {
            return [];
        }
    }

    getMultData() {
        return this.getRotateData()?.awardMul || []
    }

    // 每一列延迟停止的时间
    getNormalDelayT(index) {
        let rollT = this.getRollTime();
        let delayT = index * rollT * 2//(FDConstant.ROW_COUNT + 1);
        return delayT
    }
    setMultiples(multiples: number[]) {
        this._multiples = multiples;
    }
    getMultiples(): number[] {
        return this._multiples
    }
    setAllMultiples(multiples: number[]) {
        this._allMultiples = multiples;
    }
    getAllMultiples(): number[] {
        return this._allMultiples
    }

    // 最终押注表--单线*倍率*5
    setTotalBitList() {
        let list = [];
        for (const num1 of this._multiples) {
            for (const num2 of FDGameManager.getMultIndexs()) {
                list.push(num1 * num2 * this.lineCount)
            }
        }
        this._totalBitList = list.filter((value, index, self) => {
            return self.indexOf(value) === index;
        }).sort((a, b) => a - b);
    }
    getTotalBitList() {
        if (this._totalBitList.length == 0) {
            let list = [];
            for (const num1 of this._multiples) {
                for (const num2 of FDGameManager.getMultIndexs()) {
                    list.push(num1 * num2 * this.lineCount)
                }
            }
            this._totalBitList = list.filter((value, index, self) => {
                return self.indexOf(value) === index;
            }).sort((a, b) => a - b);
        }
        return this._totalBitList;
    }

    setMoney(money: number) {
        this._Money = money;
    }
    getMoney(): number {
        return this._Money;
    }

    // 押注倍率表index
    setBitMultIndex(multIndex: number) {
        this._bitMultIndex = multIndex;
    }
    getBitMultIndex() {
        return this._bitMultIndex || 0
    }

    // 押注单线表index
    setBitIndex(bitIndex: number) {
        this._bitIndex = bitIndex
    }
    getBitIndex() {
        return this._bitIndex || 0
    }

    // 押注总额表index
    setTotalBitIndex(totalBitIndex: number) {
        const data = this.getBetMultIndexByTotal(totalBitIndex);
        if (!data) return;
        this._totalBitIndex = totalBitIndex;
        if (data.bitIndex != this._bitIndex) {
            this.setBitIndex(data.bitIndex);
        }
        if (data.multIndex != this._bitMultIndex) {
            this.setBitMultIndex(data.multIndex);
        }
    }
    getTotalBitIndex() {
        return this._totalBitIndex || 0
    }

    // 根据总额获取单线和倍率
    getBetMultIndexByTotal(totalBitIndex = this._totalBitIndex) {
        let totalNum = this._totalBitList[totalBitIndex];
        let multList = FDGameManager.getMultIndexs();
        let lineNum = this.lineCount;

        let multIndex = multList.indexOf(totalNum / this._multiples[this._bitIndex] / lineNum);
        if (multIndex >= 0) {
            return { bitIndex: this._bitIndex, multIndex: multIndex }
        }

        let bitIndex = this._multiples.indexOf(totalNum / multList[this._bitMultIndex] / lineNum);
        if (bitIndex >= 0) {
            return { bitIndex: bitIndex, multIndex: this._bitMultIndex }
        }

        for (let bitI = 0; bitI < this._multiples.length; bitI++) {
            for (let muliI = 0; muliI < multList.length; muliI++) {
                if (totalNum == this._multiples[bitI] * multList[muliI] * lineNum) {
                    return { bitIndex: bitI, multIndex: muliI }
                }
            }
        }
    }

    // 根据单线和倍率获取总额
    getTotalBitIndexBy(bitIndex = this._bitIndex, multIndex = this._bitMultIndex) {
        let bitNum = this._multiples[bitIndex]
        let multNum = FDGameManager.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * this.lineCount;

        let index = this._totalBitList.indexOf(totalNum);
        return index;
    }


    getBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._multiples[bitIndex]
        if (bitNum > 0) return bitNum
        fdframe.log.logError(this._multiples, "_multiples")
        fdframe.log.logError(bitIndex, "_bitIndex")
    }
    getAllBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._allMultiples[bitIndex]
        if (bitNum > 0) return bitNum
        fdframe.log.logError(this._allMultiples, "_allMultiples")
        fdframe.log.logError(bitIndex, "_bitIndex")
    }
    getTotalBitNum(bitIndex: number = this._bitIndex, multIndex: number = this._bitMultIndex) {
        let bitNum = this._multiples[bitIndex]
        let multNum = FDGameManager.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * this.lineCount * this.getAntMult();
        if (totalNum > 0) return totalNum
        fdframe.log.logError(this._allMultiples, "_allMultiples")
        fdframe.log.logError(bitIndex, "_bitIndex")
    }

    setIsAnt(val) {
        this._isAnt = val;
    }
    getIsAnt() {
        return this._isAnt;
    }
    getAntMult() {
        return this._isAnt ? 5 : 1
    }


    getRollTime() {
        // if (this.getFastAndNoFree())
        //     return 0.05
        // else
        return 0.05
    }

    // FDGlobal.LEAVE=1/2/3为分房  分房MULT_INDEXS固定1， 不分1-10
    getMultIndexs() {
        return Array.from({length:this.betLevel}, (_, i) => i+1);
    }

    getMultRandom() {
        return [2, 5, 10][Math.floor(Math.random() * 3)]
    }


    getMulIndex(mul) {
        if (mul == 2) {
            return 0
        } else if (mul == 0) {
            return 3
        } else if (mul == 5) {
            return 1
        } else if (mul == 10) {
            return 2
        }
    }


    // 其他无显示：0~49倍，
    // 大奖 (50~99倍)
    // 巨奖 (100~175倍)
    // 超级巨奖 (176倍以上)
    getBigWinType(award, bitNum) {
        let multiCount = award / bitNum * 5;

        if (multiCount < 25) {
            return 0;
        } else if (multiCount < 150) {
            return 1;
        } else if (multiCount < 250) {
            return 2;
        } else {
            return 3;
        }
    }

    getWinType(award, bitNum) {
        let multiCount = award / bitNum * 5;

        if (multiCount < 15) {
            return 1;
        } else if (multiCount < 25) {
            return 2;
        } else {
            return 3;
        }
    }

}
export const FDGameManager = new M();