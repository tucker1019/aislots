import { columnIcons, type toOriginalSpin } from '../net/FOXResultAdapter';

import { foxframe } from "../../foxframe/foxframe";
import { cloneArray, mergeObjectRecursion } from "../common/FOXUtils";
import { FOXConstant, FOXSTATE, RandomCellType } from "../FOXConstant/FOXConstant";
import { FOXGlobal } from "../view/layer/FOXGlobal";
type Rotation = ReturnType<typeof toOriginalSpin>['rotate'];

export interface IgetCanStop {
    state: number  // -1 已返回数据 ，等待转轮最小转动时间  0  等待返回中  1 成功返回 2 超时未返回
    tip?: string //提示
}
class M {
    lineCount = 10;
    betLevel = 10;
    visualStake?: number;
    specialSpin = false;

    private _state: FOXSTATE = 0; //游戏状态
    private _multiples: number[] = [];
    private _allMultiples: number[] = [];
    private _totalBitList: number[] = [];

    private _Money: number = 0
    private _bitIndex: number = 0;
    private _bitMultIndex: number = 0;
    private _totalBitIndex: number = 0;
    private _mRotateData: Rotation = null;
    private _mFeeData: Rotation[] = null;

    private _everyMRotateData: Rotation = null;


    private _mFreeGameRotates: Rotation[] = null;
    private _freeIndex: number = 0;
    private _everyMFreeGameRotates: Rotation[] = null;
    private _everyFreeIndexList: number[][] = [];

    private _winAllMoney: number = 0;
    private _winAllMoneyR: number = 0;  //-- 总赢钱，一局结束不清除

    private _winMoney: number = 0;

    private _roundTime: number = 0;// 一轮转动时间

    private _Stop: boolean = false;// 是否点击暂停
    private _Fast: boolean = false;//是否点击fast

    // private _surplusRounds: number[] = [0, 0, 0, 0, 0]; //剩余转动轮数
    // private _supplusAllRounds: number[] = [3, 6, 9, 12, 15] //总剩余转动轮数
    private _haveStoped: number = 0;
    private _audoNum: number = 0;

    private _specialList = [];

    private _randomList = [];   // 随机图标list
    private _rollLayerCnt: number = 0;


    getSpecialList() {
        if (this._specialList.length > 0) {
            return this._specialList;
        }

        let mIcons: number[] = null;
        let bAnti = false;
        mIcons = this.getRotateData()?.mIcons;
        // if (this.isSpecialGame()) {
        //     mIcons = this.getFeeData()[this._freeIndex]?.mIcons;
        //     isSpecial = true;
        // } else if (this.getState() == FOXSTATE.RUNING || this.getState() == FOXSTATE.READY) {
        //     if (!this._mRotateData) return [];
        //     mIcons = this._mRotateData.mIcons;
        // }

        if (!mIcons) return []

        if (this.isSpecialGame()) {
            bAnti = mIcons.every((element, index, array) => index % FOXConstant.COL_COUNT == 1 || (element === array[0] || element === 0))
            this._specialList[1] = bAnti;
        } else {
            bAnti = mIcons.every((element, index, array) => index % FOXConstant.COL_COUNT == 2 || (element === array[0] || element === 0))
            this._specialList[2] = bAnti;
        }

        return this._specialList
    }

    getCanStop(): IgetCanStop {
        return {state: !this._mRotateData ? 0 : this.specialSpin && !this._Stop && this._roundTime < 0.35 ? -1 : 1};
    }

    setRandomList(type?) {
        if (type) {
            this._randomList = [0, type, type, FOXConstant.WILD_TYPE];
        } else {
            this._randomList = FOXConstant.CELLTYPE_ALL;
        }
    }
    getRandomType() {
        if (this._randomList.length == 0) {
            this.setRandomList();
        }

        return this._randomList[Math.floor(Math.random() * this._randomList.length)];
    }


    resOneRound() {
        this._roundTime = 0;
        // this._surplusRounds = [0, 0, 0, 0, 0];
        this._haveStoped = 0;
        // this._supplusAllRounds = [3, 6, 9, 12, 15]
        // if (this._Fast) this.setSuperlusAllRounds([3, 3, 3, 3, 3]);
        this._freeIndex++;
        this._specialList = [];
        this._Stop = false;
    }

    restRound() {
        this.specialSpin = false;
        this._state = 0; //游戏状态
        this._Money = 0
        this._mRotateData = null;
        this._mFeeData = null;
        this._everyMRotateData = null;
        this._mFreeGameRotates = null;
        this._freeIndex = 0;
        this._everyMFreeGameRotates = null;
        this._everyFreeIndexList = [];
        // this._winAllMoney = 0;
        this._winMoney = 0;
        this._roundTime = 0;// 一轮转动时间
        this._Stop = false;// 是否点击暂停
        // this._surplusRounds = [0, 0, 0, 0, 0]; //剩余转动轮数
        // this._supplusAllRounds = [3, 6, 9, 12, 15] //总剩余转动轮数
        // if (this._Fast) this.setSuperlusAllRounds([3, 3, 3, 3, 3]);
        this._haveStoped = 0;
        this._specialList = [];
        this.setState(FOXSTATE.READY);
    }


    setEveryType(): void {
        if (!this._mRotateData) {
            foxframe.log.logError("setEveryType error")
            return
        }
        this._everyMRotateData = mergeObjectRecursion({}, this._mRotateData);

        // if (this._everyMRotateData && this._everyMRotateData.mIcons) {
        //     this._everyMRotateData.mIcons.push(0)
        // }
        // if (this._mFeeData && this._mFeeData.length > 0) {
        //     for (let i = 0; i < this._mFeeData.length; i++) {
        //         this._mFeeData[i].mIcons.push(0)
        //     }
        // }
    }

    canPlay(): boolean {
        let gold = FOXGlobal.USER.gold;
        if (FOXGlobal.MODE == "fun") gold = FOXGlobal.USER.experienceGold
        if (gold >= this.getTotalBitNum()) {
            return true
        }
        return false
    }

    isHaveFree(): boolean {
        return this._mFreeGameRotates != null && this._mFreeGameRotates.length > 0
    }

    isStateFree(): boolean {
        return this._state == FOXSTATE.FREEING
    }

    setAudoNum(audoNum: number) {
        this._audoNum = audoNum;
    }
    getAudoNum(): number {
        return this._audoNum
    }

    getFreeIndex(): number {
        return this._freeIndex
    }
    setFreeIndex(freeIndex: number) {
        this._freeIndex = freeIndex
    }
    setEveryFreeIndexList(everyFreeIndexList: number[][]) {
        this._everyFreeIndexList = everyFreeIndexList;
    }
    setFreeGameRotates(mFreeGameRotates: Rotation[]) {
        this._mFreeGameRotates = mFreeGameRotates;
    }
    getFreeGameDataByIndex(isEveryType: boolean = false): Rotation {
        let index = this._freeIndex;
        if (index < 0) {
            foxframe.log.logError(index, "getFreeGameDataByIndex")
            return
        }
        if (isEveryType) return this._mFreeGameRotates[index];
        return this._everyMFreeGameRotates[index];
    }
    getFreeGameRotates(): Rotation[] {
        return this._mFreeGameRotates
    }

    setHaveStoped(haveStoped: number) {
        this._haveStoped = haveStoped;

    }
    getHaveStoped() {
        return this._haveStoped || 0;
    }


    setStop(Stop: boolean) {
        this._Stop = Stop;
        // let finishNum = 0;

        // for(let i = this._haveStoped; i < 5; i++){
        //     if(i == this._haveStoped){
        //         if(this._supplusAllRounds[i]-this._surplusRounds[i] > 4){
        //             this._supplusAllRounds[i] = this._surplusRounds[i] + 4;
        //         } else{
        //             // this._supplusAllRounds[i] = this._supplusAllRounds[i];
        //         }
        //     } else {
        //         this._supplusAllRounds[i] = this._surplusRounds[i] + 4;
        //     }
        //     // this._supplusAllRounds[i] = (i == this._haveStoped) ? this._supplusAllRounds[i]/*-this._surplusRounds[i]*/ : 
        //     //     this._surplusRounds[i] + 4;
        // }
    }
    getStop(): boolean {
        return this._Stop
    }
    // setSurplusRounds(surplusRounds: number[]) {
    //     this._surplusRounds = surplusRounds;
    //     // console.log(" this._surplusRounds", this._surplusRounds)
    // }

    // getSurplusRounds(): number[] {
    //     return this._surplusRounds
    // }
    // getSurplusRoundsByIndex(index): number {
    //     if (index < 0) {
    //         foxframe.log.logError(this._surplusRounds, "index" + index + "getSurplusRoundsByIndex error")
    //         return
    //     }
    //     return this._surplusRounds[index]
    // }


    // getSurplusAllRoundsByIndex(index): number {
    //     if (index < 0) {
    //         foxframe.log.logError(this._supplusAllRounds, "index" + index + "getSurplusAllRoundsByIndex error")
    //         return
    //     }
    //     return this._supplusAllRounds[index]
    // }

    // setSuperlusAllRounds(supplusAllRounds: number[]) {
    //     this._supplusAllRounds = supplusAllRounds
    // }
    // getSuperlusAllRounds() {
    //     return this._supplusAllRounds
    // }

    setFast(fast: boolean) {
        this._Fast = fast;
        // if(this._state == FOXSTATE.READY){
        //     if (!fast) this.setSuperlusAllRounds([3, 6, 9, 12, 15]);
        //     else this.setSuperlusAllRounds([3, 3, 3, 3, 3]);
        // }

    }

    getFast(): boolean {
        return this._Fast
    }

    getFastAndNoFree() {
        return this._Fast && !this.isSpecialGame()//&& !this.isStateFree() 
    }

    setState(state: FOXSTATE) {
        this._state = state;
    }
    getState(): FOXSTATE {
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

    setFeeData(mFeeData: Rotation[]) {
        this._mFeeData = mFeeData;
    }
    getFeeData() {
        return this._mFeeData;
    }

    getResultData(index: number) {
        return this._mRotateData ? columnIcons(this._mRotateData.mIcons, index) : [];
    }

    getNormalDelayT(index: number) {
        if (this.getStop() || this.getFastAndNoFree()) return 0;
        if (this.specialSpin) return index === 1 ? 0.45 : 0;
        return index * 0.17;
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
            for (const num2 of FOXGameManager.getMultIndexs()) {
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
                for (const num2 of FOXGameManager.getMultIndexs()) {
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
        let multList = FOXGameManager.getMultIndexs();
        let lineNum = this.lineCount;

        let multIndex = multList.indexOf(totalNum / this._multiples[this._bitIndex] / lineNum);
        if (multIndex >= 0) {
            // this.setBitMultIndex(multIndex);
            return { bitIndex: this._bitIndex, multIndex: multIndex }
        }

        let bitIndex = this._multiples.indexOf(totalNum / multList[this._bitMultIndex] / lineNum);
        if (bitIndex >= 0) {
            // this.setBitIndex(bitIndex);
            return { bitIndex: bitIndex, multIndex: this._bitMultIndex }
        }

        for (let bitI = 0; bitI < this._multiples.length; bitI++) {
            for (let muliI = 0; muliI < multList.length; muliI++) {
                if (totalNum == this._multiples[bitI] * multList[muliI] * lineNum) {
                    // this.setBitIndex(bitI)
                    // this.setBitMultIndex(muliI);
                    return { bitIndex: bitI, multIndex: muliI }
                }
            }
        }
    }

    // 根据单线和倍率获取总额
    getTotalBitIndexBy(bitIndex = this._bitIndex, multIndex = this._bitMultIndex) {
        let bitNum = this._multiples[bitIndex]
        let multNum = FOXGameManager.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * this.lineCount;

        let index = this._totalBitList.indexOf(totalNum);
        return index;
    }


    getBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._multiples[bitIndex]
        if (bitNum > 0) return bitNum
        foxframe.log.logError(this._multiples, "_multiples")
        foxframe.log.logError(bitIndex, "_bitIndex")
    }
    getAllBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._allMultiples[bitIndex]
        if (bitNum > 0) return bitNum
        foxframe.log.logError(this._allMultiples, "_allMultiples")
        foxframe.log.logError(bitIndex, "_bitIndex")
    }
    getTotalBitNum(bitIndex: number = this._bitIndex, multIndex: number = this._bitMultIndex) {
        let bitNum = this._multiples[bitIndex]
        let multNum = FOXGameManager.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * this.lineCount;
        if (totalNum > 0) return totalNum
        foxframe.log.logError(this._allMultiples, "_allMultiples")
        foxframe.log.logError(bitIndex, "_bitIndex")
    }


    isSpecialGame() {
        return this.specialSpin;
    }

    // setRollLayerCnt(val) {
    //     this._rollLayerCnt = val;
    // }
    // getRollLayerCnt() {
    //     return this._rollLayerCnt;
    // }

    getRollTime() {
        // if (this.getFastAndNoFree())
        //     return 0.05
        // else
        return 0.05
    }

    // FOXGlobal.LEAVE=1/2/3为分房  分房MULT_INDEXS固定1， 不分1-10
    getMultIndexs() {
        return Array.from({length: this.betLevel}, (_, i) => i + 1);
    }

    // 其他无显示：0~49倍，
    // 大奖 (50~99倍)
    // 巨奖 (100~175倍)
    // 超级巨奖 (176倍以上)
    getBigWinType(award, bitNum) {
        let multiCount = award / bitNum;

        if (multiCount < 9) {
            return 0;
        } else if (multiCount < 15) {
            return 1;
        } else if (multiCount < 35) {
            return 2;
        } else {
            return 3;
        }
    }

    getWinType(award, bitNum) {
        let multiCount = award / bitNum;

        if (multiCount < 3) {
            return 1;   // 绿框
        } else {
            return 2;   // 紫框
        }
    }

}
export const FOXGameManager = new M();