
import { fmframe } from "../../fmframe/fmframe";
import type { OriginalSpin } from "../net/FMResultAdapter";
import { cloneArray, mergeObjectRecursion } from "../common/FMUtils";
import { FMConstant, FMSTATE, RandomCellType } from "../FMConstant/FMConstant";
import { FMGlobal } from "../view/layer/FMGlobal";

export interface IgetCanStop {
    state: number  // -1 已返回数据 ，等待转轮最小转动时间  0  等待返回中  1 成功返回 2 超时未返回
    tip?: string //提示
}
class M {
    lineCount = 5;
    betLevel = 10;
    visualStake?: number;
    specialSpin = false;

    private _state: FMSTATE = 0; //游戏状态
    private _multiples: number[] = [];
    private _allMultiples: number[] = [];
    private _totalBitList: number[] = [];

    private _Money: number = 0
    private _bitIndex: number = 0;
    private _bitMultIndex: number = 0;
    private _totalBitIndex: number = 0;
    private _mRotateData: OriginalSpin = null;
    private _mFeeData: OriginalSpin[] = null;

    private _everyMRotateData: OriginalSpin = null;
    private _everyIndexList: number[] = [];


    private _mFreeGameRotates: OriginalSpin[] = null;
    private _freeIndex: number = -1;
    private _everyMFreeGameRotates: OriginalSpin[] = null;
    private _everyFreeIndexList: number[][] = [];

    private _mBonusRotates: OriginalSpin[] = null;
    private _bonusMaxCnt: number = -1;  // 总次数
    private _bonusRemainCnt: number = -1;   // 剩余次数
    private _bonusIndex: number = -1;   // 当前轮次
    private _bonusIdxsLadtList: number[] = [];
    private _everyMBonusRotates: OriginalSpin[] = null;
    private _everyBonusIndexList: number[][] = [];

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

    InFreeGame() {
        return FMGameManager.isHaveFree() && FMGameManager.getFreeIndex() >= 0
    }

    getIsFreeEnd() {
        return FMGameManager.isHaveFree() && FMGameManager.getFreeIndex() >= FMGameManager.getFreeGameRotates()?.length
    }

    getIsBonusEnd() {
        return FMGameManager.isHaveBonus() && FMGameManager.getBonusIndex() >= FMGameManager.getBonusGameRotates()?.length
    }


    getSpecialList() {
        if (this._specialList.length > 0) {
            return this._specialList;
        }

        // let mIcons: number[] = null;
        // let isSpecial = false;
        // if (this.getState() == FMSTATE.RUNING || this.getState() == FMSTATE.READY) {
        // if (!this._mRotateData) return false;
        // mIcons = this._mRotateData.mIcons;
        // } else if (this.getState() == FMSTATE.BONUS) {
        //     mIcons = this.getBonusGameDataByIndex()?.mIcons;
        //     isSpecial = true;
        // } else if (this.getState() == FMSTATE.FREEING) {
        //     mIcons = this.getFreeGameDataByIndex()?.mIcons;
        //     isSpecial = true;
        // }
        // if (!mIcons) return false

        // // let maxScatterList = [1, 1, 1, 1, 1];   // 一列最多几个scatter
        // let triScatterCnt = 3; // 最少几个scatter触发 
        // let totalScatterCnt = 0;

        // // let maxBonusList = [3, 3, 3, 3, 3];   // 一列最多几个scatter
        // let triBonusCnt = 6; // 最少几个scatter触发
        // let totalBonusCnt = 0;

        // for (let i = 0; i < FMConstant.COL_COUNT; i++) {
        //     let playStop = false;
        //     let effScaName = "";
        //     let effBonName = "";
        //     let playAnti = !isSpecial && (totalScatterCnt >= triScatterCnt - 1 || totalBonusCnt >= triBonusCnt - 1);

        //     let colScaList = mIcons.filter((value, index) => (index % FMConstant.COL_COUNT === i && value == FMConstant.SCATTER_TYPE));

        //     let colBonList;
        //     if (this.getState() == FMSTATE.BONUS) {
        //         let lastIdxList = this.getBonusLastIdxsList();
        //         colBonList = mIcons.filter((value, index) => (index % FMConstant.COL_COUNT === i && FMConstant.BONUS_TYPE.indexOf(value) >= 0 && lastIdxList.indexOf(index) == -1));
        //     } else{
        //         colBonList = mIcons.filter((value, index) => (index % FMConstant.COL_COUNT === i && FMConstant.BONUS_TYPE.indexOf(value) >= 0));
        //     }
        //     if (colScaList.length > 0 && this.getState() != FMSTATE.BONUS) {
        //         // let remain = maxScatterList.slice(i + 1).reduce((acc, curr) => acc + curr, 0); --都播停止音效
        //         totalScatterCnt += colScaList.length;
        //         playStop = true;
        //         effScaName = "slot_scatter-" + (i + 1);
        //     }
        //     if (colBonList.length > 0) {

        //         // let remain = maxBonusList.slice(i + 1).reduce((acc, curr) => acc + curr, 0); --都播停止音效
        //         totalBonusCnt += this.getBonusCnt(colBonList);
        //         playStop = true;
        //         effScaName = "slot_item_cash";
        //     }
        //     this._specialList.push({ playStop: playStop, playAnti: playAnti, effScaName: effScaName, effBonName: effBonName })
        // }

        // return this._specialList;
    }


    // ExceedTwoBouns(index: number): boolean {
    //     let mIcons: number[] = null;
    //     if (this.getState() == FMSTATE.RUNING) {
    //         if (!this._mRotateData) return false;
    //         mIcons = this._mRotateData.mIcons;
    //     } else if(this.getState() == FMSTATE.BONUS){
    //         mIcons = this.getBonusGameDataByIndex()?.mIcons;
    //     } else {
    //         mIcons = this.getFreeGameDataByIndex()?.mIcons;
    //     }
    //     if (!mIcons) return false
    //     let exceedFreeNum: number = 0;
    //     let exceedBonusNum: number = 0;
    //     for (let i = 0; i < mIcons.length; i++) {
    //         if (i % 5 < index) {
    //             if (mIcons[i] == FMConstant.SCATTER_TYPE) {
    //                 exceedFreeNum++;
    //             } else if(Math.floor(mIcons[i] / 1200)>0) {
    //                 exceedBonusNum++;
    //             }
    //         }
    //     }
    //     let exceed = exceedFreeNum >= 2 || exceedBonusNum>=4;
    //     if (exceed && !this._Stop && !this._Fast) {
    //         for (let i = index; i < 5; i++) {
    //             this._supplusAllRounds[i] = i * 24;
    //         }
    //     } 
    //     return exceed
    // }

    getCanStop(): IgetCanStop {
        if (!this._mRotateData) return {state: 0};
        return {state: this.specialSpin && this._roundTime < 1 ? -1 : 1};
    }

    setRandomList(type?) {
        if (type) {
            this._randomList = [0, type, type, FMConstant.WILD_TYPE];
        } else {
            this._randomList = FMConstant.CELLTYPE_ALL;
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
        this._bonusIndex++;
        this._bonusRemainCnt--;
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
        this._everyIndexList = [];
        this._mFreeGameRotates = null;
        this._freeIndex = -1;
        this._everyMFreeGameRotates = null;
        this._everyFreeIndexList = [];
        this._mBonusRotates = null;
        this._bonusIndex = -1;
        this._bonusRemainCnt = -1;
        this._bonusMaxCnt = -1;
        this._bonusIdxsLadtList = [];
        this._everyMBonusRotates = null;
        this._everyBonusIndexList = [];
        this._winAllMoney = 0;
        this._winMoney = 0;
        this._roundTime = 0;// 一轮转动时间
        this._Stop = false;// 是否点击暂停
        // this._surplusRounds = [0, 0, 0, 0, 0]; //剩余转动轮数
        // this._supplusAllRounds = [3, 6, 9, 12, 15] //总剩余转动轮数
        // if (this._Fast) this.setSuperlusAllRounds([3, 3, 3, 3, 3]);
        this._haveStoped = 0;
        this._specialList = [];
        this.setState(FMSTATE.READY);
    }


    setEveryType(): void {
        if (!this._mRotateData) {
            fmframe.log.logError("setEveryType error")
            return
        }
        this._everyMRotateData = mergeObjectRecursion({}, this._mRotateData);
        // if (this._everyMRotateData.mFreeList && this._everyMRotateData.mFreeList.length > 0) {
        //     if (this._everyMRotateData.mFreeList[this._everyMRotateData.mFreeList.length - 1].mFreeIcons.indexOf(0) >= 0) {
        //         this._everyMRotateData.mFreeList.push(this._everyMRotateData.mFreeList[this._everyMRotateData.mFreeList.length - 1])
        //     }


        //     // for (let i = this._everyMRotateData.mFreeList.length - 1; i > 0; i--) {
        //     //     for (let j = 0; j < this._everyMRotateData.mFreeList[i].mFreeIcons.length; j++) {
        //     //         if (this._everyMRotateData.mFreeList[i].mFreeIcons[j] == 1 && this._everyMRotateData.mFreeList[i].mFreeIcons[j] == this._everyMRotateData.mFreeList[i-1].mFreeIcons[j]){
        //     //             this._everyMRotateData.mFreeList[i].mFreeIcons[j] = 0;
        //     //         }
        //     //     }

        //     // }
        // }


        // if (this.isHaveBonus()) {
        //     this._everyMBonusRotates = mergeObjectRecursion([], this._mBonusRotates)
        // }

        // if (this.isHaveFree()) {

        //     this._everyMFreeGameRotates = mergeObjectRecursion([], this._mFreeGameRotates)

        // }
    }
    canPlay(): boolean {
        let gold = FMGlobal.USER.gold;
        if (FMGlobal.MODE == "fun") gold = FMGlobal.USER.experienceGold
        if (gold >= this.getTotalBitNum()) {
            return true
        }
        return false
    }

    isHaveFree(): boolean {
        return this._mFreeGameRotates != null && this._mFreeGameRotates.length > 0
    }

    isStateFree(): boolean {
        return this._state == FMSTATE.FREEING
    }

    // isStateSpecial(): boolean {
    //     return this._state == FMSTATE.SPECIAL
    // }

    isHaveBonus(): boolean {
        return this._mBonusRotates != null && this._mBonusRotates.length > 0
    }
    isStateBonus(): boolean {
        return this._state == FMSTATE.BONUS
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
    setFreeGameRotates(mFreeGameRotates: OriginalSpin[]) {
        this._mFreeGameRotates = mFreeGameRotates;
    }
    getFreeGameDataByIndex(isEveryType: boolean = false): OriginalSpin {
        let index = this._freeIndex;
        if (index < 0) {
            fmframe.log.logError(index, "getFreeGameDataByIndex")
            return
        }
        if (isEveryType) return this._mFreeGameRotates[index];
        return this._everyMFreeGameRotates[index];
    }
    getFreeGameRotates(): OriginalSpin[] {
        return this._mFreeGameRotates
    }

    getBonusIndex(): number {
        return this._bonusIndex
    }
    setBonusIndex(bonusIndex: number) {
        this._bonusIndex = bonusIndex
    }
    getBonusLastIdxsList(): number[] {
        return this._bonusIdxsLadtList;
    }
    setBonusLastIdxsList(list: number[]) {
        this._bonusIdxsLadtList = list;
    }
    setEveryBonusIndexList(everyBonusIndexList: number[][]) {
        this._everyBonusIndexList = everyBonusIndexList;
    }
    getBonusRemainCnt(): number {
        return this._bonusRemainCnt;
    }
    setBonusRemainCnt(count: number) {
        this._bonusRemainCnt = count;
    }
    getBonusMaxCnt(): number {
        return this._bonusMaxCnt;
    }
    setBonusMaxCnt(count: number) {
        this._bonusMaxCnt = count;
    }
    setBonusGameRotates(mBonusRotates: OriginalSpin[]) {
        this._mBonusRotates = mBonusRotates;
    }
    getBonusGameDataByIndex(isEveryType: boolean = false): OriginalSpin {
        let index = this._bonusIndex;
        if (index < 0) {
            fmframe.log.logError(index, "getBonusDataByIndex")
            return
        }
        if (isEveryType) return this._mBonusRotates[index];
        return this._everyMBonusRotates[index];
    }
    getBonusGameRotates(): OriginalSpin[] {
        return this._mBonusRotates
    }

    setHaveStoped(haveStoped: number) {
        this._haveStoped = haveStoped;

    }
    getHaveStoped() {
        return this._haveStoped || 0;
    }

    getEveryIndexList(): number[] {
        if (this.isStateBonus())
            return this._everyBonusIndexList[this._bonusIndex]
        else if (this.isStateFree())
            return this._everyFreeIndexList[this._freeIndex]
        return this._everyIndexList
    }

    setEveryIndexList(list: number[]) {
        this._everyIndexList = list;
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
    //         fmframe.log.logError(this._surplusRounds, "index" + index + "getSurplusRoundsByIndex error")
    //         return
    //     }
    //     return this._surplusRounds[index]
    // }


    // getSurplusAllRoundsByIndex(index): number {
    //     if (index < 0) {
    //         fmframe.log.logError(this._supplusAllRounds, "index" + index + "getSurplusAllRoundsByIndex error")
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
        // if(this._state == FMSTATE.READY){
        //     if (!fast) this.setSuperlusAllRounds([3, 6, 9, 12, 15]);
        //     else this.setSuperlusAllRounds([3, 3, 3, 3, 3]);
        // }

    }

    getFast(): boolean {
        return this._Fast
    }

    getFastAndNoFree() {
        return this._Fast && !this.isSpecialGame()//&& !this.isStateFree() && !this.isStateBonus()
    }

    setState(state: FMSTATE) {
        this._state = state;
    }
    getState(): FMSTATE {
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
    setRotateData(mRotateData: OriginalSpin) {
        this._mRotateData = mRotateData;

    }

    getRotateData(isEveryType: boolean = false): OriginalSpin {
        if (this.getState() == FMSTATE.RUNING) {
            if (isEveryType) return this._mRotateData;
            return this._everyMRotateData;
        } else if (this.isStateBonus()) {
            return this.getBonusGameDataByIndex(isEveryType)
        } else if (this.isStateFree()) {
            return this.getFreeGameDataByIndex(isEveryType)
        }

    }

    setFeeData(mFeeData: OriginalSpin[]) {
        this._mFeeData = mFeeData;
    }
    getFeeData() {
        return this._mFeeData;
    }

    getResultData(index: number) {
        return this._mRotateData?.mIcons.filter((_, idx) => idx % FMConstant.COL_COUNT === index) ?? [];
    }
    // 每一列延迟停止的时间
    getNormalDelayT(index) {
        let rollT = this.getRollTime();
        let delayT = index * rollT * (FMConstant.ROW_COUNT + 1);
        if (FMGameManager.isSpecialGame()) {
            delayT += index * 0.1
        }
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
            for (const num2 of FMGameManager.getMultIndexs()) {
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
                for (const num2 of FMGameManager.getMultIndexs()) {
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

    // setTotalBitIndex(totalBitIndex: number) {
    //     this._totalBitIndex = totalBitIndex;

    //     //--修改了总额，单线和倍率也要做对应修改
    //     //--优先保持单线不变

    //     let totalNum = this._totalBitList[this._totalBitIndex];
    //     let multList = FMConstant.MULT_INDEXS;

    //     let multIndex = multList.indexOf(totalNum / this._multiples[this._bitIndex] / 5);
    //     if (multIndex >= 0) {
    //         this.setBitMultIndex(multIndex);
    //         return
    //     }

    //     let bitIndex = this._multiples.indexOf(totalNum / multList[this._bitMultIndex] / 5);
    //     if (bitIndex >= 0) {
    //         this.setBitIndex(bitIndex);
    //         return
    //     }

    //     for (let bitI = 0; bitI < this._multiples.length; bitI++) {
    //         for (let muliI = 0; muliI < multList.length; muliI++) {
    //             if (totalNum == this._multiples[bitI] * multList[muliI] * 5) {
    //                 this.setBitIndex(bitI)
    //                 this.setBitMultIndex(muliI);
    //                 return
    //             }
    //         }
    //     }
    // }

    // 根据总额获取单线和倍率
    getBetMultIndexByTotal(totalBitIndex = this._totalBitIndex) {
        let totalNum = this._totalBitList[totalBitIndex];
        let multList = FMGameManager.getMultIndexs();
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
        let multNum = FMGameManager.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * this.lineCount;

        let index = this._totalBitList.indexOf(totalNum);
        return index;
    }


    getBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._multiples[bitIndex]
        if (bitNum > 0) return bitNum
        fmframe.log.logError(this._multiples, "_multiples")
        fmframe.log.logError(bitIndex, "_bitIndex")
    }
    getAllBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._allMultiples[bitIndex]
        if (bitNum > 0) return bitNum
        fmframe.log.logError(this._allMultiples, "_allMultiples")
        fmframe.log.logError(bitIndex, "_bitIndex")
    }
    getTotalBitNum(bitIndex: number = this._bitIndex, multIndex: number = this._bitMultIndex) {
        let bitNum = this._multiples[bitIndex]
        let multNum = FMGameManager.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * this.lineCount;
        if (totalNum > 0) return totalNum
        fmframe.log.logError(this._allMultiples, "_allMultiples")
        fmframe.log.logError(bitIndex, "_bitIndex")
    }

    // getBonusCnt(list) {
    //     let bonusCnt = (list && list.length > 0) ? list.reduce((all, value) => all + (FMConstant.PRAFAB_LIST[value].cnt || 0), 0) : 0;
    //     return bonusCnt;
    // }
    // getBonusMultIdx(cnt) {
    //     let idx = FMConstant.BONUS_CNT.findIndex(val => cnt < val);
    //     return idx - 1;
    // }

    isSpecialGame() {
        return this.specialSpin;
    }

    setRollLayerCnt(val) {
        this._rollLayerCnt = val;
    }
    getRollLayerCnt() {
        return this._rollLayerCnt;
    }

    getRollTime() {
        if (this.getFastAndNoFree()) return 0.05
        else return 0.06
    }

    // FMGlobal.LEAVE=1/2/3为分房  分房MULT_INDEXS固定1， 不分1-10
    getMultIndexs() {
        return Array.from({length: this.betLevel}, (_, i) => i + 1);
    }

    // 其他无显示：0~49倍，
    // 大奖 (50~99倍)
    // 巨奖 (100~175倍)
    // 超级巨奖 (176倍以上)
    getBigWinType(award, bitNum) {
        let multiCount = award / bitNum * this.lineCount

        if (multiCount < 50) {
            return 0;
        } else if (multiCount < 100) {
            return 1;
        } else if (multiCount < 176) {
            return 2;
        } else {
            return 3;
        }
    }


    // getWinType(award, bitNum) {
    //     let multiCount = award / bitNum * this.lineCount
    //     if (multiCount < 15) {
    //         return 1;   // 红框
    //     } else if (multiCount < 25) {
    //         return 2;   // 绿框
    //     } else {
    //         return 3;   // 紫框
    //     }

    // }


}
export const FMGameManager = new M();