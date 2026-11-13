
import { ftframe } from "../../ftframe/ftframe";
import { onceRotateInfo } from "../3rd/game_1017";
import { cloneArray, mergeObjectRecursion } from "../common/FTUtils";
import { FTConstant, FTSTATE, RandomCellType } from "../FTConstant/FTConstant";
import { FTGlobal } from "../view/layer/FTGlobal";

export interface IgetCanStop {
    state: number  // -1 已返回数据 ，等待转轮最小转动时间  0  等待返回中  1 成功返回 2 超时未返回
    tip?: string //提示
}
class M {

    private _state: FTSTATE = 0; //游戏状态
    private _multiples: number[] = null;
    private _allMultiples: number[] = null;
    private _totalBitList: number[] = null;

    private _Money: number = 0
    private _bitIndex: number = 0;
    private _bitMultIndex: number = 0;
    private _totalBitIndex: number = 0;
    private _mRotateData: onceRotateInfo = null;

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
        return FTGameManager.isHaveFree() && FTGameManager.getFreeIndex() >= 0
    }

    getIsFreeEnd() {
        return FTGameManager.isHaveFree() && FTGameManager.getFreeIndex() >= FTGameManager.getFreeGameRotates()?.length
    }

    getIsBonusEnd() {
        return FTGameManager.isHaveBonus() && FTGameManager.getBonusIndex() >= FTGameManager.getBonusGameRotates()?.length
    }


    getSpecialList() {
        if (this._specialList.length > 0) {
            return this._specialList;
        }

        // let mIcons: number[] = null;
        // let isSpecial = false;
        // if (this.getState() == FTSTATE.RUNING || this.getState() == FTSTATE.READY) {
        // if (!this._mRotateData) return false;
        // mIcons = this._mRotateData.mIcons;
        // } else if (this.getState() == FTSTATE.BONUS) {
        //     mIcons = this.getBonusGameDataByIndex()?.mIcons;
        //     isSpecial = true;
        // } else if (this.getState() == FTSTATE.FREEING) {
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

        // for (let i = 0; i < FTConstant.COL_COUNT; i++) {
        //     let playStop = false;
        //     let effScaName = "";
        //     let effBonName = "";
        //     let playAnti = !isSpecial && (totalScatterCnt >= triScatterCnt - 1 || totalBonusCnt >= triBonusCnt - 1);

        //     let colScaList = mIcons.filter((value, index) => (index % FTConstant.COL_COUNT === i && value == FTConstant.SCATTER_TYPE));

        //     let colBonList;
        //     if (this.getState() == FTSTATE.BONUS) {
        //         let lastIdxList = this.getBonusLastIdxsList();
        //         colBonList = mIcons.filter((value, index) => (index % FTConstant.COL_COUNT === i && FTConstant.BONUS_TYPE.indexOf(value) >= 0 && lastIdxList.indexOf(index) == -1));
        //     } else{
        //         colBonList = mIcons.filter((value, index) => (index % FTConstant.COL_COUNT === i && FTConstant.BONUS_TYPE.indexOf(value) >= 0));
        //     }
        //     if (colScaList.length > 0 && this.getState() != FTSTATE.BONUS) {
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
    //     if (this.getState() == FTSTATE.RUNING) {
    //         if (!this._mRotateData) return false;
    //         mIcons = this._mRotateData.mIcons;
    //     } else if(this.getState() == FTSTATE.BONUS){
    //         mIcons = this.getBonusGameDataByIndex()?.mIcons;
    //     } else {
    //         mIcons = this.getFreeGameDataByIndex()?.mIcons;
    //     }
    //     if (!mIcons) return false
    //     let exceedFreeNum: number = 0;
    //     let exceedBonusNum: number = 0;
    //     for (let i = 0; i < mIcons.length; i++) {
    //         if (i % 5 < index) {
    //             if (mIcons[i] == FTConstant.SCATTER_TYPE) {
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
        else if (this.getState() == FTSTATE.RUNING) {
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

    setRandomList(type?) {
        if (type) {
            this._randomList = [0, type, type, FTConstant.WILD_TYPE];
        } else {
            this._randomList = FTConstant.CELLTYPE_ALL;
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
        this._state = 0; //游戏状态
        this._Money = 0
        this._mRotateData = null;
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
       
        this._winMoney = 0;
        this._roundTime = 0;// 一轮转动时间
        this._Stop = false;// 是否点击暂停
        // this._surplusRounds = [0, 0, 0, 0, 0]; //剩余转动轮数
        // this._supplusAllRounds = [3, 6, 9, 12, 15] //总剩余转动轮数
        // if (this._Fast) this.setSuperlusAllRounds([3, 3, 3, 3, 3]);
        this._haveStoped = 0;
        this._specialList = [];
        this.setState(FTSTATE.READY);
    }


    setEveryType(): void {
        if (!this._mRotateData) {
            ftframe.log.logError("setEveryType error")
            return
        }
        this._everyMRotateData = mergeObjectRecursion({}, this._mRotateData);
        if (this._everyMRotateData.mFreeList && this._everyMRotateData.mFreeList.length > 0) {
            if (this._everyMRotateData.mFreeList[this._everyMRotateData.mFreeList.length - 1].mFreeIcons.indexOf(0) >= 0) {
                this._everyMRotateData.mFreeList.push(this._everyMRotateData.mFreeList[this._everyMRotateData.mFreeList.length - 1])
            }


            // for (let i = this._everyMRotateData.mFreeList.length - 1; i > 0; i--) {
            //     for (let j = 0; j < this._everyMRotateData.mFreeList[i].mFreeIcons.length; j++) {
            //         if (this._everyMRotateData.mFreeList[i].mFreeIcons[j] == 1 && this._everyMRotateData.mFreeList[i].mFreeIcons[j] == this._everyMRotateData.mFreeList[i-1].mFreeIcons[j]){
            //             this._everyMRotateData.mFreeList[i].mFreeIcons[j] = 0;
            //         }
            //     }

            // }
        }


        // if (this.isHaveBonus()) {
        //     this._everyMBonusRotates = mergeObjectRecursion([], this._mBonusRotates)
        // }

        // if (this.isHaveFree()) {

        //     this._everyMFreeGameRotates = mergeObjectRecursion([], this._mFreeGameRotates)

        // }
    }
    canPlay(): boolean {
        let gold = FTGlobal.USER.gold;
        if (FTGlobal.MODE == "fun") gold = FTGlobal.USER.experienceGold
        if (gold >= this.getTotalBitNum()) {
            return true
        }
        return false
    }

    isHaveFree(): boolean {
        return this._mFreeGameRotates != null && this._mFreeGameRotates.length > 0
    }

    isStateFree(): boolean {
        return this._state == FTSTATE.FREEING
    }

    // isStateSpecial(): boolean {
    //     return this._state == FTSTATE.SPECIAL
    // }

    isHaveBonus(): boolean {
        return this._mBonusRotates != null && this._mBonusRotates.length > 0
    }
    isStateBonus(): boolean {
        return this._state == FTSTATE.BONUS
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
            ftframe.log.logError(index, "getFreeGameDataByIndex")
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
            ftframe.log.logError(index, "getBonusDataByIndex")
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
    //         ftframe.log.logError(this._surplusRounds, "index" + index + "getSurplusRoundsByIndex error")
    //         return
    //     }
    //     return this._surplusRounds[index]
    // }


    // getSurplusAllRoundsByIndex(index): number {
    //     if (index < 0) {
    //         ftframe.log.logError(this._supplusAllRounds, "index" + index + "getSurplusAllRoundsByIndex error")
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
        // if(this._state == FTSTATE.READY){
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

    setState(state: FTSTATE) {
        this._state = state;
    }
    getState(): FTSTATE {
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
        if (this.getState() == FTSTATE.RUNING) {
            if (isEveryType) return this._mRotateData;
            return this._everyMRotateData;
        } else if (this.isStateBonus()) {
            return this.getBonusGameDataByIndex(isEveryType)
        } else if (this.isStateFree()) {
            return this.getFreeGameDataByIndex(isEveryType)
        }

    }
    // 每一列的值
    getResultData(index) {
        let mIcons;
        if (this.getRotateData()?.mFreeList) {
            mIcons = this.getRotateData().mFreeList[this._freeIndex + 1]?.mFreeIcons
        } else {
            mIcons = this.getRotateData()?.mIcons;
        }
        if (mIcons) {
            let data = mIcons.filter((value, idx) => idx % FTConstant.COL_COUNT == index)
            return data;
        } else {
            return [];
        }
    }
    // 特殊玩法每一列上一局的数据
    getSpecialData(index, freeIndex) {
        let mIcons;
        if (this.getRotateData().mFreeList) {
            mIcons = this.getRotateData().mFreeList[freeIndex]?.mFreeIcons
        }
        if (mIcons) {
            let data = mIcons.filter((value, idx) => idx % FTConstant.COL_COUNT == index)
            return data;
        } else {
            return [];
        }
    }
    // 每一列延迟停止的时间
    getNormalDelayT(index) {
        let rollT = this.getRollTime();
        return index * rollT * (FTConstant.ROW_COUNT + 1)
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
            for (const num2 of FTGameManager.getMultIndexs()) {
                list.push(num1 * num2 * FTConstant.ALL_LINE)
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
                for (const num2 of FTGameManager.getMultIndexs()) {
                    list.push(num1 * num2 * FTConstant.ALL_LINE)
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

    // setTotalBitIndex(totalBitIndex: number) {
    //     this._totalBitIndex = totalBitIndex;

    //     //--修改了总额，单线和倍率也要做对应修改
    //     //--优先保持单线不变

    //     let totalNum = this._totalBitList[this._totalBitIndex];
    //     let multList = FTConstant.MULT_INDEXS;

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
        let multList = FTGameManager.getMultIndexs();

        let multIndex = multList.indexOf(totalNum / this._multiples[this._bitIndex] / 5);
        if (multIndex >= 0) {
            // this.setBitMultIndex(multIndex);
            return { bitIndex: this._bitIndex, multIndex: multIndex }
        }

        let bitIndex = this._multiples.indexOf(totalNum / multList[this._bitMultIndex] / 5);
        if (bitIndex >= 0) {
            // this.setBitIndex(bitIndex);
            return { bitIndex: bitIndex, multIndex: this._bitMultIndex }
        }

        for (let bitI = 0; bitI < this._multiples.length; bitI++) {
            for (let muliI = 0; muliI < multList.length; muliI++) {
                if (totalNum == this._multiples[bitI] * multList[muliI] * 5) {
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
        let multNum = FTGameManager.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * 5;

        let index = this._totalBitList.indexOf(totalNum);
        return index;
    }


    getBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._multiples[bitIndex]
        if (bitNum > 0) return bitNum
        ftframe.log.logError(this._multiples, "_multiples")
        ftframe.log.logError(bitIndex, "_bitIndex")
    }
    getAllBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._allMultiples[bitIndex]
        if (bitNum > 0) return bitNum
        ftframe.log.logError(this._allMultiples, "_allMultiples")
        ftframe.log.logError(bitIndex, "_bitIndex")
    }
    getTotalBitNum(bitIndex: number = this._bitIndex, multIndex: number = this._bitMultIndex) {
        let bitNum = this._multiples[bitIndex]
        let multNum = FTGameManager.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * 5;
        if (totalNum > 0) return totalNum
        ftframe.log.logError(this._allMultiples, "_allMultiples")
        ftframe.log.logError(bitIndex, "_bitIndex")
    }

    // getBonusCnt(list) {
    //     let bonusCnt = (list && list.length > 0) ? list.reduce((all, value) => all + (FTConstant.PRAFAB_LIST[value].cnt || 0), 0) : 0;
    //     return bonusCnt;
    // }
    // getBonusMultIdx(cnt) {
    //     let idx = FTConstant.BONUS_CNT.findIndex(val => cnt < val);
    //     return idx - 1;
    // }

    isSpecialGame() {
        return FTGameManager.getRotateData()?.mFreeList && FTGameManager.getRotateData()?.mFreeList.length > 0;
    }

    getRollTime() {
        if (this._Fast) return 0.05
        else return 0.06
    }

    // FTGlobal.LEAVE=1/2/3为分房  分房MULT_INDEXS固定1， 不分1-10
    private goBetLevels: number[];
    setGoBetLevels(max: number) { this.goBetLevels = Array.from({ length: max }, (_, i) => i + 1); }
    getMultIndexs() {
        if (this.goBetLevels) return this.goBetLevels;
        if (FTGlobal.LEAVE == 1 || FTGlobal.LEAVE == 2 || FTGlobal.LEAVE == 3) {
            return FTConstant.MULT_INDEXS;
        } else {
            return FTConstant.MULT_INDEXS_M;
        }
    }

    // 其他无显示：0~10倍，
    // 大奖 (25~149倍)
    // 巨奖 (150~249倍)
    // 超级巨奖 (250倍以上)
    getBigWinType(award, bitNum) {
        let multiCount = award / bitNum * 5

        if (multiCount < 25) {
            return 0;
        } else if (multiCount < 150) {
            return 1;   //[0, bitNum * 10, award]
        } else if (multiCount < 250) {
            return 2;   //[0, bitNum * 10, bitNum * 30, award]
        } else {
            return 3;   //[0, bitNum * 10, bitNum * 30, bitNum * 50, award]
        }
    }


    getWinType(award, bitNum) {
        let multiCount = award / bitNum * 5
        if (multiCount < 15) {
            return 1;   // 红框
        } else if (multiCount < 25) {
            return 2;   // 绿框
        } else {
            return 3;   // 紫框
        }

    }


}
export const FTGameManager = new M();