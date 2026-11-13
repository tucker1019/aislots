
/*
*   网络相关接口定义
*   
*/


import { heartBeatC2S } from "../../game/3rd/hall";
import { ftframe } from "../ftframe";


export type NetData = (string | ArrayBufferLike | Blob | ArrayBufferView);

export type NetCallFunc = (cmd: number, data: any) => void;

// 回调对象
export interface CallbackObject {
    target: any,                // 回调对象，不为null时调用target.callback(xxx)
    callback: NetCallFunc,      // 回调函数
}

// 请求对象
export interface RequestObject {
    buffer: NetData,            // 请求的Buffer
    rspCmd: number,             // 等待响应指令
    rspObject: CallbackObject,  // 等待响应的回调对象
}

// 协议辅助接口
export interface IProtocolHelper {
    // getHeadlen(): number;                   // 返回包头长度
    getHearbeat(): heartBeatC2S;                 // 返回一个心跳包
    // getPackageLen(msg: NetData): number;    // 返回整个包的长度
    // checkPackage(msg: NetData): boolean;    // 检查包数据是否合法
    getPackage(msg: NetData): { cmd: number, msgBuf: Uint8Array };     // 返回包的id或协议类型
}

//默认arraybuffer协议对象
export class DefArrayBufferProtocol implements IProtocolHelper {

    getHearbeat(): heartBeatC2S {
        let data: heartBeatC2S = { sign: 1 };
        return data
    }

    getPackage(msg: ArrayBuffer): { cmd: number, msgBuf: Uint8Array } {
        let dataView = new DataView(msg)
        let preId: number = dataView.getUint8(0)
        let nextId: number = dataView.getUint8(1)
        let cmd: number = preId * 256 + nextId;
        if (cmd != 2)
            ftframe.log.logNet("【onmessage】 " + cmd)
        var uint8Buf: Uint8Array = new Uint8Array(msg);
        let msgBuf: Uint8Array = uint8Buf.subarray(2)
        return { cmd, msgBuf };
    }
}



// Socket接口
export interface ISocket {
    onConnected: (event) => void;           // 连接回调
    onMessage: (msg: NetData) => void;      // 消息回调
    onError: (event) => void;               // 错误回调
    onClosed: (event) => void;              // 关闭回调

    connect(options: any);                  // 连接接口
    send(buffer: NetData);                  // 数据发送接口
    close(code?: number, reason?: string);  // 关闭接口
}

// 网络提示接口
export interface INetworkTips {
    connectTips(isShow: boolean): void;
    reconnectTips(isShow: boolean): void;
    requestTips(isShow: boolean): void;
}
