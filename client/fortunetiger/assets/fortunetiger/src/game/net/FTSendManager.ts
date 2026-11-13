

import { ftframe } from "../../ftframe/ftframe";
import { FTNetManager } from "../../ftframe/network/FTNetManager";
import { getGameStateC2S, requestOpenAwardC2S } from "../3rd/game_1017";
import { heartBeatC2S, loginC2S, requestEnterGameC2S, requestLeaveGameC2S, requestRoomListC2S } from "../3rd/hall";
import { isWeb } from "../common/FTUtils";
import { FTConstant } from "../FTConstant/FTConstant";
import { FTGlobal } from "../view/layer/FTGlobal";

import { FTNetConfig } from "./FTNetConfig";


export default class FTSendManager {

    private static _ins: FTSendManager = null;
    public static get ins() {
        if (this._ins == null) this._ins = new FTSendManager()
        return this._ins
    }
    public static rest() {
        this._ins = null
    }
    // 发送游戏开始消息
    sendGameReady(level?: number): void {
        let data: getGameStateC2S = {};
        if (level != null) data.roomLevel = level
        this.sendBuf(FTNetConfig.CMD.getGameStateC2S, data)
    }
    //登录
    sendLogin(uid: string, accessToken: string, mTimeStamp = FTConstant.GAMEID): void {
        let mType = 22;

       

        let data: loginC2S = {
            mType: mType,
            mAgentID: 1,
            mAccount: uid,
            mNickName: uid,
            mMac: uid,
            mIp: FTGlobal.CV ? FTGlobal.CV : "",
            mPassWord: accessToken,
            mTimeStamp: mTimeStamp,
            coinType: FTGlobal.coinType
        }
        this.sendBuf(FTNetConfig.CMD.loginC2S, data)
    }

    public sendEnterRoom(roomId: number = 0): void {
        let data: requestEnterGameC2S = { "mGameID":  FTConstant.GAMEID, "mGameType": FTGlobal.LEAVE, "mRoomID": 1, mDeskIndex: 1, mSeatIndex: 1, mRenew: 0 }
        this.sendBuf(FTNetConfig.CMD.requestEnterGameC2S, data)
    }

    public sendHeart(netdata: heartBeatC2S) {
        this.sendBuf(FTNetConfig.CMD.heartBeatC2S, netdata)
    }
    // 一局游戏 10503
    public sendGo(bitIndex: number, multIndex: number): void {
        let isFree: number = FTGlobal.MODE == "fun" ? 1 : 0
        let data: requestOpenAwardC2S = { mMultipleIdx: bitIndex + 1, isFree: isFree, moddsLevel: multIndex + 1 }
        this.sendBuf(FTNetConfig.CMD.requestOpenAwardC2S, data);
    }
    public sendRequestExitRoom() {
        let data: requestLeaveGameC2S = {}
        this.sendBuf(FTNetConfig.CMD.requestLeaveGameC2S, data);
    }

    public sendBuf(id: number, data) {
        let msgBuf: Uint8Array = FTNetConfig.encodeList[id](data)
        let preId: number = Math.floor(id / 256)
        let nextId: number = Math.floor(id % 256)
        let total_len: number = msgBuf.length + 2
        let buf: ArrayBuffer = new ArrayBuffer(total_len)
        let dataview: DataView = new DataView(buf);
        dataview.setUint8(0, preId);
        dataview.setUint8(1, nextId);
        let unit8Buf: Int8Array = new Int8Array(buf);
        unit8Buf.set(msgBuf, 2);
        if (id != 1)
            ftframe.log.logNet("【send】" + id, JSON.stringify(data));
        FTNetManager.getInstance().send(buf);
    }

}
