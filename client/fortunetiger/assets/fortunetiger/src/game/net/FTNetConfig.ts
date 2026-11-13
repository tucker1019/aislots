
import { decodegetGameStateS2C, decoderequestOpenAwardS2C, encodegetGameStateC2S, encoderequestOpenAwardC2S } from "../3rd/game_1017"
import { decodeheartBeatC2S, decodeheartBeatS2C, decodeloginS2C, decodeplayerMoneyChangeS2C, decoderequestEnterGameS2C, decoderequestLeaveGameS2C, decoderequestRoomListS2C, decodeserverKickPlayerToHallS2C, encodeheartBeatC2S, encodeloginC2S, encoderequestEnterGameC2S, encoderequestLeaveGameC2S, encoderequestRoomListC2S } from "../3rd/hall"
export class FTNetConfig {
    static CMD = {
        heartBeatC2S: 1,
        heartBeatS2C: 2,
        loginC2S: 101,
        loginS2C: 102,

        playerMoneyChangeS2C: 131,

        requestRoomListC2S: 137,
        requestRoomListS2C: 138,

        requestEnterGameC2S: 143,
        requestEnterGameS2C: 144,

        requestLeaveGameC2S: 145,
        requestLeaveGameS2C: 146,
        serverKickPlayerToHallS2C: 179,
        getGameStateC2S: 10171,
        getGameStateS2C: 10172,
        requestOpenAwardC2S: 10173,
        requestOpenAwardS2C: 10174,
    }

    static decodeList: { [key: number]: Function } = {
        2: decodeheartBeatS2C,
        102: decodeloginS2C,
        131: decodeplayerMoneyChangeS2C,
        138: decoderequestRoomListS2C,
        144: decoderequestEnterGameS2C,
        146: decoderequestLeaveGameS2C,
        10172: decodegetGameStateS2C,
        10174: decoderequestOpenAwardS2C,
        179: decodeserverKickPlayerToHallS2C
    }
    static encodeList: { [key: number]: Function } = {
        1: encodeheartBeatC2S,
        101: encodeloginC2S,
        137: encoderequestRoomListC2S,
        143: encoderequestEnterGameC2S,
        145: encoderequestLeaveGameC2S,
        10171: encodegetGameStateC2S,
        10173: encoderequestOpenAwardC2S
    }
}
