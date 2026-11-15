
import { frframe } from "../../frframe/frframe";
import { onceRotateInfo } from "../3rd/game_1018";
import { cloneArray, mergeObjectRecursion } from "../common/FRUtils";
import { FRConstant, FRSTATE, RandomCellType } from "../FRConstant/FRConstant";
import { FRGlobal } from "../view/layer/FRGlobal";

export interface IgetCanStop {
    state: number  // -1 已返回数据 ，等待转轮最小转动时间  0  等待返回中  1 成功返回 2 超时未返回
    tip?: string //提示
}
class M {

    lineCount = 10;
    betLevel = 10;
    visualStake: number | undefined;
    specialSpin = false;

    private _state: FRSTATE = 0; //游戏状态
    private _multiples: number[] = null;
    private _allMultiples: number[] = null;
    private _totalBitList: number[] = [];

    private _Money: number = 0
    private _bitIndex: number = 0;
    private _bitMultIndex: number = 0;
    private _totalBitIndex: number = 0;
    private _mRotateData: onceRotateInfo = null;
    private _mFeeData: onceRotateInfo[] = null;

    private _everyMRotateData: onceRotateInfo = null;
    private _everyIndexList: number[] = [];


    private _mFreeGameRotates: onceRotateInfo[] = null;
    private _freeIndex: number = -1;
    private _everyMFreeGameRotates: onceRotateInfo[] = null;
    private _everyFreeIndexList: number[][] = [];

    private _mBonusRotates: onceRotateInfo[] = null;
    private _bonusMaxCnt: number = -1;  // 总次数
    private _bonusRemainCnt: number = -1;   // 剩余次数
    private _bonusIndex: number = -1;   // 当前轮次
    private _bonusIdxsLadtList: number[] = [];
    private _everyMBonusRotates: onceRotateInfo[] = null;
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

    InFreeGame() {
        return FRGameManager.isHaveFree() && FRGameManager.getFreeIndex() >= 0
    }

    getIsFreeEnd() {
        return FRGameManager.isHaveFree() && FRGameManager.getFreeIndex() >= FRGameManager.getFreeGameRotates()?.length
    }

    getIsBonusEnd() {
        return FRGameManager.isHaveBonus() && FRGameManager.getBonusIndex() >= FRGameManager.getBonusGameRotates()?.length
    }


    getSpecialList() {
        if (this._specialList.length > 0) {
            return this._specialList;
        }

        // let mIcons: number[] = null;
        // let isSpecial = false;
        // if (this.getState() == FRSTATE.RUNING || this.getState() == FRSTATE.READY) {
        // if (!this._mRotateData) return false;
        // mIcons = this._mRotateData.mIcons;
        // } else if (this.getState() == FRSTATE.BONUS) {
        //     mIcons = this.getBonusGameDataByIndex()?.mIcons;
        //     isSpecial = true;
        // } else if (this.getState() == FRSTATE.FREEING) {
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

        // for (let i = 0; i < FRConstant.COL_COUNT; i++) {
        //     let playStop = false;
        //     let effScaName = "";
        //     let effBonName = "";
        //     let playAnti = !isSpecial && (totalScatterCnt >= triScatterCnt - 1 || totalBonusCnt >= triBonusCnt - 1);

        //     let colScaList = mIcons.filter((value, index) => (index % FRConstant.COL_COUNT === i && value == FRConstant.SCATTER_TYPE));

        //     let colBonList;
        //     if (this.getState() == FRSTATE.BONUS) {
        //         let lastIdxList = this.getBonusLastIdxsList();
        //         colBonList = mIcons.filter((value, index) => (index % FRConstant.COL_COUNT === i && FRConstant.BONUS_TYPE.indexOf(value) >= 0 && lastIdxList.indexOf(index) == -1));
        //     } else{
        //         colBonList = mIcons.filter((value, index) => (index % FRConstant.COL_COUNT === i && FRConstant.BONUS_TYPE.indexOf(value) >= 0));
        //     }
        //     if (colScaList.length > 0 && this.getState() != FRSTATE.BONUS) {
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
    //     if (this.getState() == FRSTATE.RUNING) {
    //         if (!this._mRotateData) return false;
    //         mIcons = this._mRotateData.mIcons;
    //     } else if(this.getState() == FRSTATE.BONUS){
    //         mIcons = this.getBonusGameDataByIndex()?.mIcons;
    //     } else {
    //         mIcons = this.getFreeGameDataByIndex()?.mIcons;
    //     }
    //     if (!mIcons) return false
    //     let exceedFreeNum: number = 0;
    //     let exceedBonusNum: number = 0;
    //     for (let i = 0; i < mIcons.length; i++) {
    //         if (i % 5 < index) {
    //             if (mIcons[i] == FRConstant.SCATTER_TYPE) {
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
        if (this.isSpecialGame()) {
            if (this._roundTime <= 1) {
                return { state: -1 }
            } else {
                return { state: 1 }
            }
        }
        else if (this.getState() == FRSTATE.RUNING) {
            if (this._roundTime <= 10) {
                if (this._mRotateData == null) return { state: 0 }
                else {
                    return { state: 1 }
                }
            }
            else if (this._roundTime > 10) {
                return { state: 2, tip: "无网络" }
            }
        }
    }

    setRandomList(type = RandomCellType.All) {
        if (type == RandomCellType.BONUS) {
            this._randomList = FRConstant.CELLTYPE_SPECIAL;
        } else if (type == RandomCellType.EMPTY) {
            this._randomList = [FRConstant.EMPTY_TYPE];
        } else {
            this._randomList = FRConstant.CELLTYPE_ALL;
        }
    }
    getRandomType() {
        if (this._randomList.length == 0) {
            this.setRandomList();
        }

        return this._randomList[Math.floor(Math.random() * this._randomList.length)];
    }
    getRandonBonusType() {
        let list = FRConstant.BONUS_TYPE;
        return list[Math.floor(Math.random() * list.length)];
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
        this.setState(FRSTATE.READY);
    }


    setEveryType(): void {
        if (!this._mRotateData) {
            frframe.log.logError("setEveryType error")
            return
        }
        this._everyMRotateData = mergeObjectRecursion({}, this._mRotateData);

        if (this._everyMRotateData && this._everyMRotateData.mIcons) {
            this._everyMRotateData.mIcons.push(FRGameManager.getRandomType())
            for (let i = 0; i < this._everyMRotateData.mIcons.length; i++) {
                if (this._everyMRotateData.mIcons[i] == 0) {
                    this._everyMRotateData.mIcons[i] = FRGameManager.getRandomType();
                }
            }
        }

        if (this._mFeeData && this._mFeeData.length > 0) {
            for (let i = 0; i < this._mFeeData.length; i++) {
                this._mFeeData[i].mIcons.push(FRConstant.EMPTY_TYPE)
            }
        }
    }
    canPlay(): boolean {
        let gold = FRGlobal.USER.gold;
        if (FRGlobal.MODE == "fun") gold = FRGlobal.USER.experienceGold
        if (gold >= this.getTotalBitNum()) {
            return true
        }
        return false
    }

    isHaveFree(): boolean {
        return this._mFreeGameRotates != null && this._mFreeGameRotates.length > 0
    }

    isStateFree(): boolean {
        return this._state == FRSTATE.FREEING
    }

    // isStateSpecial(): boolean {
    //     return this._state == FRSTATE.SPECIAL
    // }

    isHaveBonus(): boolean {
        return this._mBonusRotates != null && this._mBonusRotates.length > 0
    }
    isStateBonus(): boolean {
        return this._state == FRSTATE.BONUS
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
    setFreeGameRotates(mFreeGameRotates: onceRotateInfo[]) {
        this._mFreeGameRotates = mFreeGameRotates;
    }
    getFreeGameDataByIndex(isEveryType: boolean = false): onceRotateInfo {
        let index = this._freeIndex;
        if (index < 0) {
            frframe.log.logError(index, "getFreeGameDataByIndex")
            return
        }
        if (isEveryType) return this._mFreeGameRotates[index];
        return this._everyMFreeGameRotates[index];
    }
    getFreeGameRotates(): onceRotateInfo[] {
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
    setBonusGameRotates(mBonusRotates: onceRotateInfo[]) {
        this._mBonusRotates = mBonusRotates;
    }
    getBonusGameDataByIndex(isEveryType: boolean = false): onceRotateInfo {
        let index = this._bonusIndex;
        if (index < 0) {
            frframe.log.logError(index, "getBonusDataByIndex")
            return
        }
        if (isEveryType) return this._mBonusRotates[index];
        return this._everyMBonusRotates[index];
    }
    getBonusGameRotates(): onceRotateInfo[] {
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
    //         frframe.log.logError(this._surplusRounds, "index" + index + "getSurplusRoundsByIndex error")
    //         return
    //     }
    //     return this._surplusRounds[index]
    // }


    // getSurplusAllRoundsByIndex(index): number {
    //     if (index < 0) {
    //         frframe.log.logError(this._supplusAllRounds, "index" + index + "getSurplusAllRoundsByIndex error")
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
        // if(this._state == FRSTATE.READY){
        //     if (!fast) this.setSuperlusAllRounds([3, 6, 9, 12, 15]);
        //     else this.setSuperlusAllRounds([3, 3, 3, 3, 3]);
        // }

    }

    getFast(): boolean {
        return this._Fast
    }

    getFastAndNoFree() {
        return this._Fast && !this.specialSpin && !this.isStateFree() && !this.isStateBonus()
    }

    setState(state: FRSTATE) {
        this._state = state;
    }
    getState(): FRSTATE {
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

    setRotateData(mRotateData: onceRotateInfo) {
        this._mRotateData = mRotateData;

    }
    getRotateData(isEveryType: boolean = false): onceRotateInfo {
        if (this.getState() == FRSTATE.RUNING) {
            if (isEveryType) return this._mRotateData;
            return this._everyMRotateData;
        } else if (this.isStateBonus()) {
            return this.getBonusGameDataByIndex(isEveryType)
        } else if (this.isStateFree()) {
            return this.getFreeGameDataByIndex(isEveryType)
        }
    }

    setFeeData(mFeeData: onceRotateInfo[]) {
        this._mFeeData = mFeeData;
    }
    getFeeData() {
        return this._mFeeData;
    }

    // 每一列的值
    getResultData(index) {
        return this._mRotateData?.mIcons?.filter((_, idx) => idx % FRConstant.COL_COUNT === index) || [];
    }
    // // 特殊玩法每一列上一局的数据
    // getSpecialData(index, freeIndex) {
    //     let mIcons;
    //     // if (this.getRotateData().mFreeList) {
    //     //     mIcons = this.getRotateData().mFreeList[freeIndex]?.mFreeIcons
    //     // }
    //     if (mIcons) {
    //         let data = mIcons.filter((value, idx) => idx % FRConstant.COL_COUNT == index)
    //         return data;
    //     } else {
    //         return [];
    //     }
    // }
    // 每一列延迟停止的时间
    getNormalDelayT(index) {
        return index * 0.05 * 5
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

    // 最终押注表--单线*倍率*连线数
    setTotalBitList() {
        let list = [];
        for (const num1 of this._multiples) {
            for (const num2 of FRGameManager.getMultIndexs()) {
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
                for (const num2 of FRGameManager.getMultIndexs()) {
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
        this._totalBitIndex = totalBitIndex;

        // A UI refresh for the same total must keep the selected base and level.
        if (this.getTotalBitIndexBy() === totalBitIndex) return;
        let data = this.getBetMultIndexByTotal(totalBitIndex);
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
        let multList = FRGameManager.getMultIndexs();
        let lineNum = this.lineCount;

        for (let multIndex = 0; multIndex < multList.length; multIndex++) {
            const bitIndex = this._multiples.indexOf(totalNum / (multList[multIndex] * lineNum));
            if (bitIndex >= 0) return {bitIndex, multIndex};
        }
        return {bitIndex: 0, multIndex: 0};
    }

    // 根据单线和倍率获取总额
    getTotalBitIndexBy(bitIndex = this._bitIndex, multIndex = this._bitMultIndex) {
        let bitNum = this._multiples[bitIndex]
        let multNum = FRGameManager.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * this.lineCount;

        let index = this._totalBitList.indexOf(totalNum);
        return index;
    }


    getBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._multiples[bitIndex]
        if (bitNum > 0) return bitNum
        frframe.log.logError(this._multiples, "_multiples")
        frframe.log.logError(bitIndex, "_bitIndex")
    }
    getAllBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._allMultiples[bitIndex]
        if (bitNum > 0) return bitNum
        frframe.log.logError(this._allMultiples, "_allMultiples")
        frframe.log.logError(bitIndex, "_bitIndex")
    }
    getTotalBitNum(bitIndex: number = this._bitIndex, multIndex: number = this._bitMultIndex) {
        if (this.visualStake !== undefined) return this.visualStake;
        let bitNum = this._multiples[bitIndex]
        let multNum = FRGameManager.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * this.lineCount;
        if (totalNum > 0) return totalNum
        frframe.log.logError(this._allMultiples, "_allMultiples")
        frframe.log.logError(bitIndex, "_bitIndex")
    }

    // getBonusCnt(list) {
    //     let bonusCnt = (list && list.length > 0) ? list.reduce((all, value) => all + (FRConstant.PRAFAB_LIST[value].cnt || 0), 0) : 0;
    //     return bonusCnt;
    // }
    // getBonusMultIdx(cnt) {
    //     let idx = FRConstant.BONUS_CNT.findIndex(val => cnt < val);
    //     return idx - 1;
    // }

    isSpecialGame() {
        return this.specialSpin;
    }

    

    // FRGlobal.LEAVE=1/2/3为分房  分房MULT_INDEXS固定1， 不分1-10
    getMultIndexs(){
        return Array.from({length: this.betLevel}, (_, i) => i + 1);
    }

    // 单线倍数总和
    // 其他无显示：0~49倍，
    // 大奖 (50~149倍)
    // 巨奖 (150~349倍)
    // 超级巨奖 (350倍以上)
    getBigWinType(award, bitNum) {
        let multiCount = award / bitNum * this.lineCount

        if (multiCount < 50) {
            return 0;
        } else if (multiCount < 150) {
            return 1;
        } else if (multiCount < 350) {
            return 2;
        } else {
            return 3;
        }
    }


    getWinType(award, bitNum) {
        let multiCount = award / bitNum * this.lineCount
        if (multiCount < 10) {
            return 0;
        } else if (multiCount < 20) {
            return 1;
        } else if (multiCount < 50) {
            return 2;
        } else {
            return 3;
        }

    }


}
export const FRGameManager = new M();
