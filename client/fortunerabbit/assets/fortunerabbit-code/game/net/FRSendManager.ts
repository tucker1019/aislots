

import { DEV } from "cc/env";
import { frframe } from "../../frframe/frframe";
import { FRNetManager } from "../../frframe/network/FRNetManager";
import { getGameStateC2S, requestOpenAwardC2S } from "../3rd/game_1018";
import { heartBeatC2S, loginC2S, requestEnterGameC2S, requestLeaveGameC2S, requestRoomListC2S } from "../3rd/hall";
import {

} from "../common/FRUtils";
import { FRConstant } from "../FRConstant/FRConstant";
import { FRGlobal } from "../view/layer/FRGlobal";

import { FRNetConfig } from "./FRNetConfig";


export default class FRSendManager {

    private static _ins: FRSendManager = null;
    public static get ins() {
        if (this._ins == null) this._ins = new FRSendManager()
        return this._ins
    }
    public static rest() {
        this._ins = null
    }
    // 发送游戏开始消息
    sendGameReady(level?: number): void {
        let data: getGameStateC2S = {};
        if (level != null) data.roomLevel = level
        this.sendBuf(FRNetConfig.CMD.getGameStateC2S, data)
    }
    //登录
    sendLogin(uid: string, accessToken: string, mTimeStamp = FRConstant.GAMEID): void {
        let mType = 22;

 
        let data: loginC2S = {
            mType: mType,
            mAgentID: 1,
            mAccount: uid,
            mNickName: uid,
            mMac: uid,
            mIp: FRGlobal.CV ? FRGlobal.CV : "",
            mPassWord: accessToken,
            mTimeStamp: mTimeStamp,
        }
        this.sendBuf(FRNetConfig.CMD.loginC2S, data)
    }

    public sendEnterRoom(roomId: number = 0): void {
        let data: requestEnterGameC2S = { "mGameID":  FRConstant.GAMEID, "mGameType": FRGlobal.LEAVE, "mRoomID": 1, mDeskIndex: 1, mSeatIndex: 1, mRenew: 0 }
        this.sendBuf(FRNetConfig.CMD.requestEnterGameC2S, data)
    }

    public sendHeart(netdata: heartBeatC2S) {
        this.sendBuf(FRNetConfig.CMD.heartBeatC2S, netdata)
    }
    // 一局游戏 10503
    public sendGo(bitIndex: number, multIndex: number): void {
        let isFree: number = FRGlobal.MODE == "fun" ? 1 : 0
        let data: requestOpenAwardC2S = { mMultipleIdx: bitIndex + 1, isFree: isFree, moddsLevel: multIndex + 1 }
        this.sendBuf(FRNetConfig.CMD.requestOpenAwardC2S, data);
    }
    public sendRequestExitRoom() {
        let data: requestLeaveGameC2S = {}
        this.sendBuf(FRNetConfig.CMD.requestLeaveGameC2S, data);
    }

    public sendBuf(id: number, data) {
        let msgBuf: Uint8Array = FRNetConfig.encodeList[id](data)
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
            frframe.log.logNet("【send】" + id, JSON.stringify(data));
        FRNetManager.getInstance().send(buf);
    }

}
