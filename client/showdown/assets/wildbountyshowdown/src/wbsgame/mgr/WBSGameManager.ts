import { AutoBudget } from '../../network/round_controller';
import { _decorator, Component } from "cc";
import { Frame, RotateView } from "../../network/game_types";
import { adaptFrame } from "../../network/frame_adapter";
import { consoleLog, consoleLogError, mergeObjectRecursion } from "../../xtools/WBSUtils";
import { WBSConstant, WBSSTATE } from "../constant/WBSConstant";
import { WBSConfig } from "../cfg/WBSConfig";
import { wbsgame } from "../wbsgame";

export type IUser = {
    uid?: number,
    accessToken?: string,
    coin?: number,
    localBetLevelIndex?: number,
    localBetMultIndex?: number,
    musicSwitch?: boolean,
    soundSwitch?: boolean,
    spinType?: number, //0 普通 1 quick 
}

export interface IgetCanStop {
    state: number  // -1 已返回数据 ，等待转轮最小转动时间  0  等待返回中  1 成功返回 2 超时未返回
    tip?: string //提示
}

const { ccclass } = _decorator;
@ccclass('WBSGameManager')
export class WBSGameManager extends Component {

    private _user: IUser = {};

    private _money: number = 0;
    private _enterTime: number = 0;
    private _multiples: number[] = [];
    private _allMultiples: number[] = null;
    private _totalBitList: number[] = [];
    private _bitIndex: number = 0;
    private _bitMultIndex: number = 0;
    private _totalBitIndex: number = 0;

    private _state: WBSSTATE = WBSSTATE.READY; //游戏状态
    private _mRotateData: RotateView = null;
    frame: Frame = null;
    betLevelLimit = 10;
    private _roundCount: number = 0;
    private _freeNum: number = 0;
    private _freeIndex: number = 0
    private _allData = null
    private _winAllMoney: number = 0;
    private _winMoney: number = 0;
    private _specialList = [];

    private readonly autoBudget = new AutoBudget();
    private _autoRatio: number = -1;
    private _autoMinBalance: number = -1;
    private _autoMaxBalance: number = -1;
    private _autoAllWin: number = 0;

    private _isFast: boolean = false;
    private _isDouble: boolean = false;

    private _myGold: number = 0;

    private _roundTime: number = 0;// 一轮转动时间
    private _Stop: boolean = false;// 是否点击暂停

    private _coinValue: number = 1
    private _betNum: number = 1

    public set coinValue(v: number) {
        this._coinValue = v;
    }
    public get coinValue() {
        return this._coinValue;
    }

    public set betNum(v: number) {
        this._betNum = v;
    }
    public get betNum() {
        return this._betNum;
    }

    getEnterTime() {
        return this._enterTime;
    }
    setEnterTime(time: number) {
        this._enterTime = time
    }


    setUserData(userInfo: IUser) {
        mergeObjectRecursion(this._user, userInfo);
        consoleLog(`setUserData`, JSON.stringify(this._user))
        if (userInfo.localBetLevelIndex != null)
            wbsgame.storageMgr.set(`${WBSConfig.roomLevel}_localBetLevel`, userInfo.localBetLevelIndex);
        if (userInfo.localBetMultIndex != null)
            wbsgame.storageMgr.set(`${WBSConfig.roomLevel}_localBetMult`, userInfo.localBetMultIndex);
        if (userInfo.spinType != null)
            wbsgame.storageMgr.set(`spinType`, userInfo.spinType);
        if (userInfo.soundSwitch != null)
            wbsgame.storageMgr.set(`soundSwitch`, String(userInfo.soundSwitch));
        if (userInfo.musicSwitch != null)
            wbsgame.storageMgr.set(`musicSwitch`, String(userInfo.musicSwitch));
    }
    getUserData(): IUser {
        return this._user
    }

    initData() {
        this._isFast = false;
        this.autoBudget.set(0);
        this._autoRatio = -1;
        this._autoMinBalance = -1;
        this._autoMaxBalance = -1;
        this._autoAllWin = 0;
        this._winMoney = 0;
        this._winAllMoney = 0;
        this._mRotateData = null;
        this.frame = null;
        this._roundCount = 0;
        this._freeNum = 0;
        this._freeIndex = 0;
        this._state = WBSSTATE.READY;
        this._bitIndex = 0
        this._isDouble = false;
        this._roundTime = 0;
        this._specialList = [];
    }

    /**
     * 
     * @returns 玩家时候够金币开始游戏
     */
    canPlay(): boolean {
        let gold = wbsgame.gameMgr.getUserData().coin;
        let bet = this.getTotalBitNum();
        return gold >= bet
    }
    reset() {
        this._state = WBSSTATE.READY; //游戏状态
        this._mRotateData = null;
        this.frame = null;
        this._roundCount = 0;
        this._freeNum = 0;
        this._freeIndex = 0;
        this._winAllMoney = 0;
        this._winMoney = 0;
        this._roundTime = 0
        this._specialList = [];
    }

    freeReset() {
        this._specialList = [];
    }

    getMoney() {
        return this._money
    }
    setMoney(money: number) {
        this._money = money
    }

    setAudoNum(num: number) {
        this.autoBudget.set(num);
    }
    getAudoNum() {
        return this.autoBudget.remaining
    }
    consumeAutoSpin() { return this.autoBudget.take(); }
    getIsAuto(): boolean { return this.autoBudget.remaining > 0 }

    getAutoContinue(): boolean {
        let bitNum = this.getTotalBitNum();
        let isAuto = this.getIsAuto();
        let noRatio = this._autoRatio < 0 || (this._autoAllWin < bitNum * this._autoRatio);
        let noMinBalance = this._autoMinBalance < 0 || (this.getMoney() / 100 > this._autoMinBalance);
        let noMaxBalance = this._autoMaxBalance < 0 || (this.getMoney() / 100 < this._autoMaxBalance);
        return isAuto && noRatio && noMinBalance && noMaxBalance;
    }

    restAutoCfg() {
        this._autoAllWin = 0;
        this._autoRatio = -1;
        this._autoMinBalance = -1;
        this._autoMaxBalance = -1;
    }
    setAutoAllWin(num: number) {
        this._autoAllWin = num;
    }
    getAutoAllWin() {
        return this._autoAllWin;
    }
    setAutoRatio(num: number) {
        this._autoRatio = num;
    }
    getAutoRatio() {
        return this._autoRatio
    }
    setAutoMinBalance(num: number) {
        this._autoMinBalance = num;
    }
    getAutoMinBalance() {
        return this._autoMinBalance
    }
    setAutoMaxBalance(num: number) {
        this._autoMaxBalance = num;
    }
    getAutoMaxBalance() {
        return this._autoMaxBalance;
    }

    setState(state: WBSSTATE) {
        this._state = state;
    }
    getState(): WBSSTATE {
        return this._state
    }

    setWinAllMoney(winAllMoney: number) {
        this._winAllMoney = winAllMoney
    }
    getWinAllMoney(): number {
        return this._winAllMoney
    }

    setWinMoney(winMoney: number) {
        this._winMoney = winMoney
    }
    getWinMoney(): number {
        return this._winMoney;
    }

    applyFrame(frame: Frame) {
        const view = adaptFrame(frame);
        this.frame = frame;
        this._specialList = [];
        this._roundCount = 0;
        this._mRotateData = {mIconsList:[{mIcons:view.icons}],mAwardList:view.awards,
            freeMax:frame.freeRemaining,mFreeGameCount:frame.freeRemaining,isFree:frame.awardedFreeSpins || 0};
        this._freeNum = frame.freeRemaining;
        this._winAllMoney = frame.totalWinAmount;
        this._user.coin = frame.balance;
        this._money = frame.balance;
    }
    getBottomSymbol(column: number): number {
        const symbols=this.frame?.bottomSymbols;
        if (!symbols) return this.getRandomType();
        const value=symbols[column], id=value%1000;
        if(symbols.length!==6 || !Number.isSafeInteger(value) || id<1 || id>8 || value>=2000)
            throw Error('服务端底部格子无效');
        return value;
    }
    getFactor() { return this.frame ? adaptFrame(this.frame).factor : (this._state === WBSSTATE.FREEING ? 8 : 1); }

    getAllData() {
        return this._allData;
    }

    setRotateData(mRotateData: RotateView) {
        this._mRotateData = mRotateData;
    }
    getRotateData(): RotateView {
        return this._mRotateData
    }

    getRollResult(): number[] {
        let mIconsList = this.getRotateData().mIconsList
        return mIconsList[this._roundCount].mIcons || []
    }

    setFreeNum(addnum, num?: number) {
        if (num)
            this._freeNum = num;
        else this._freeNum += addnum;
    }

    getFreeNum() {
        return this._freeNum
    }

    startFreeGame() { this._freeIndex++; }
    getFreeIndex() { return this._freeIndex; }
    checkFinish() { return this.frame?.nextAction !== 'continue'; }

    setRoundCount(num: number) {
        this._roundCount = num;
    }
    /**返回第几轮 */
    getRoundCount() {
        return this._roundCount;
    }

    // 每一列的值
    getResultData(mIcons, col) {
        let result = [];
        WBSConstant.INDICES[col].forEach(idx => {
            result.push(mIcons[idx]);
        })
        return result;
    }

    // setResultData() {

    //     let resultIconsList = [];
    //     if (this._mRotateData && this._mRotateData.mIconsList) {
    //         for (let i = 0; i < this._mRotateData.mIconsList.length; i++) {
    //             let mIcons = this._mRotateData.mIconsList[i].mIcons;

    //             resultIconsList[i] = [];
    //             for (let col = 0; col < WBSConstant.COL_COUNT; col++) {
    //                 let result = []
    //                 WBSConstant.INDICES[col].forEach(idx => {
    //                     result.push(mIcons[idx]);
    //                 })
    //                 resultIconsList[i].push(result);
    //             }
    //         }

    //         if(this._mRotateData.mAwardList){

    //         }
    //     }

    // }


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

    // WBSConfig.LEAVE=1/2/3为分房  分房MULT_INDEXS固定1， 不分1-10
    getMultIndexs() { return Array.from({length:this.betLevelLimit}, (_, i) => i + 1); }

    // 最终押注表--单线*倍率*总中奖连线数
    setTotalBitList() {
        let list = [];
        for (const num1 of this._multiples) {
            for (const num2 of this.getMultIndexs()) {
                list.push(num1 * num2 * WBSConstant.ALL_LINE)
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
                for (const num2 of this.getMultIndexs()) {
                    list.push(num1 * num2 * WBSConstant.ALL_LINE)
                }
            }
            this._totalBitList = list.filter((value, index, self) => {
                return self.indexOf(value) === index;
            }).sort((a, b) => a - b);
        }
        return this._totalBitList;
    }

    // 押注倍率表index
    setBitMultIndex(multIndex: number) {
        this._bitMultIndex = multIndex;
    }
    getBitMultIndex() {
        return this._bitMultIndex || 0
    }

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

    // 根据总额获取单线和倍率
    getBetMultIndexByTotal(totalBitIndex = this._totalBitIndex) {
        let totalNum = this._totalBitList[totalBitIndex];
        let multList = this.getMultIndexs();

        let multIndex = multList.indexOf(totalNum / this._multiples[this._bitIndex] / WBSConstant.ALL_LINE);
        if (multIndex >= 0) {
            // this.setBitMultIndex(multIndex);
            return { bitIndex: this._bitIndex, multIndex: multIndex }
        }

        let bitIndex = this._multiples.indexOf(totalNum / multList[this._bitMultIndex] / WBSConstant.ALL_LINE);
        if (bitIndex >= 0) {
            // this.setBitIndex(bitIndex);
            return { bitIndex: bitIndex, multIndex: this._bitMultIndex }
        }

        for (let bitI = 0; bitI < this._multiples.length; bitI++) {
            for (let muliI = 0; muliI < multList.length; muliI++) {
                if (totalNum == this._multiples[bitI] * multList[muliI] * WBSConstant.ALL_LINE) {
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
        let multNum = this.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * WBSConstant.ALL_LINE;

        let index = this._totalBitList.indexOf(totalNum);
        return index;
    }


    getBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._multiples[bitIndex]
        if (bitNum > 0) return bitNum
        consoleLogError(this._multiples, "_multiples")
        consoleLogError(bitIndex, "_bitIndex")
    }
    getAllBitNum(bitIndex: number = this._bitIndex) {
        let bitNum = this._allMultiples[bitIndex]
        if (bitNum > 0) return bitNum
        consoleLogError(this._allMultiples, "_allMultiples")
        consoleLogError(bitIndex, "_bitIndex")
    }
    getTotalBitNum(bitIndex: number = this._bitIndex, multIndex: number = this._bitMultIndex) {
        let bitNum = this._multiples[bitIndex]
        let multNum = this.getMultIndexs()[multIndex]
        let totalNum = bitNum * multNum * WBSConstant.ALL_LINE;
        if (totalNum > 0) return totalNum
        consoleLogError(this._allMultiples, "_allMultiples")
        consoleLogError(bitIndex, "_bitIndex")
    }


    setFast(isfast: boolean) {
        this._isFast = isfast
    }

    getFast(): boolean {
        return this._isFast;
    }

    getFastAndNoFree(): boolean {
        return this._isFast && this.getState() != WBSSTATE.FREEING;
    }

    getIsDouble() {
        return this._isDouble;
    }

    setIsDouble(isDouble: boolean) {
        this._isDouble = isDouble
    }

    setNowGold(num) {
        this._myGold = this.getMoney() + num;
    }

    getNowGold() {
        return this._myGold;
    }

    getRandomType() {
        let list = WBSConstant.RANDOM_NOR

        return list[Math.floor(Math.random() * list.length)];
    }

    getSpecialList() {
        if (this._specialList.length > 0) {
            return this._specialList;
        }

        let mIcons: number[] = null;
        let bAnti = false;
        mIcons = this.getRotateData()?.mIconsList[0]?.mIcons;
        if (!mIcons) return []

        let indices = WBSConstant.INDICES;
        let totalCnt = 0;
        let startIdx = -1;
        for (let col = 0; col < indices.length; col++) {
            let playStop = false;
            let playAnti = totalCnt >= 2;
            let effName = "";
            for (let row = 0; row < indices[col].length; row++) {
                if (mIcons[indices[col][row]] == WBSConstant.SCATTER_TYPE) {
                    totalCnt++;
                    playStop = true;
                    effName = "symScatter";
                }
            }
            if (startIdx == -1 && totalCnt >= 2) {
                startIdx = col;
            }
            let antiCnt = startIdx > 0 ? col - startIdx : 0;

            this._specialList.push({ playStop: playStop, playAnti: playAnti, effName: effName, antiCnt: antiCnt })
        }

        return this._specialList
    }

    getCanStop(): IgetCanStop {
        return {state:this._mRotateData ? 1 : 0};
    }

    setRoundTime(roundTime: number) {
        this._roundTime = roundTime;
    }
    getRoundTime(): number {
        return this._roundTime
    }

    setStop(Stop: boolean) {
        this._Stop = Stop;
    }

    getStop(): boolean {
        return this._Stop
    }
}