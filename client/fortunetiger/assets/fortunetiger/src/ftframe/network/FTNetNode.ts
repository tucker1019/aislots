import { CCObject, isValid } from "cc";
import FTLoadManager from "../../game/load/FTLoadManager";
import { FTNetConfig } from "../../game/net/FTNetConfig";
import FTSendManager from "../../game/net/FTSendManager";
import { ftframe } from "../ftframe";




import { ISocket, INetworkTips, IProtocolHelper, RequestObject, CallbackObject, NetData, NetCallFunc } from "./FTNetInterface";
import { FTNetManager } from "./FTNetManager";
import { FTEventName } from "../event/FTEventName";
import { FTConstant } from "../../game/FTConstant/FTConstant";
import { FTPlatformMgr } from "../../game/3rd/FTPlatformMgr";

/*
*   CocosCreator网络节点基类，以及网络相关接口定义
*   1. 网络连接、断开、请求发送、数据接收等基础功能
*   2. 心跳机制
*   3. 断线重连 + 请求重发
*   4. 调用网络屏蔽层
*
*/

type ExecuterFunc = (callback: CallbackObject, buffer: NetData) => void;
type CheckFunc = (checkedFunc: VoidFunc) => void;
type VoidFunc = () => void;
type BoolFunc = () => boolean;

export enum NetTipsType {
    Connecting,
    ReConnecting,
    Requesting,
}

export enum NetNodeState {
    Closed,                     // 已关闭
    Connecting,                 // 连接中
    Checking,                   // 验证中
    Working,                    // 可传输数据
}

export interface NetConnectOptions {
    host?: string,              // 地址
    port?: number,              // 端口
    url?: string,               // url，与地址+端口二选一
    autoReconnect?: number,     // -1 永久重连，0不自动重连，其他正整数为自动重试次数
}

export class FTNetNode {




    protected _connectOptions: NetConnectOptions = null;
    protected _autoReconnect: number = 0;
    protected _isSocketInit: boolean = false;                               // Socket是否初始化过
    protected _isSocketOpen: boolean = false;                               // Socket是否连接成功过
    protected _state: NetNodeState = NetNodeState.Closed;                   // 节点当前状态
    protected _socket: ISocket = null;                                      // Socket对象（可能是原生socket、websocket、wx.socket...)
    protected _protocolHelper: IProtocolHelper = null;                      // 包解析对象
    protected _connectedCallback: CheckFunc = null;                         // 连接完成回调
    protected _disconnectCallback: BoolFunc = null;                         // 断线回调
    protected _callbackExecuter: ExecuterFunc = null;                       // 回调执行
    protected _keepAliveTimer: any = null;                                  // 心跳定时器
    protected _receiveMsgTimer: any = null;                                 // 接收数据定时器
    protected _reconnectTimer: any = null;                                  // 重连定时器
    protected _heartTime: number = 2000;                                   // 心跳间隔
    protected _receiveTime: number = 4000;                               // 多久没收到数据断开
    protected _reconnetTimeOut: number = 2000;                           // 重连间隔

    protected _listener: { [key: number]: CallbackObject[] } = {}           // 监听者列表
    private _noHeartNum: number = 0;

    /********************** 网络相关处理 *********************/
    public init(socket: ISocket, protocol: IProtocolHelper, connectedCallback: CheckFunc, networkTips: any = null, execFunc: ExecuterFunc = null) {
        console.log(`CLNetNode init socket`);
        this._socket = socket;
        this._protocolHelper = protocol;
        this._connectedCallback = connectedCallback
        this._callbackExecuter = execFunc ? execFunc : (callback: CallbackObject, buffer: NetData) => {
            callback.callback.call(callback.target, 0, buffer);
        }
    }

    public connect(options: NetConnectOptions): boolean {
        console.log(options, "connect")
        if (this._socket && this._state == NetNodeState.Closed) {
            if (!this._isSocketInit) {
                this.initSocket();
            }
            this._state = NetNodeState.Connecting;
            if (!this._socket.connect(options)) {
                return false;
            }

            if (this._connectOptions == null) {
                this._autoReconnect = options.autoReconnect;
            }
            this._connectOptions = options;
            return true;
        }
        return false;
    }

    protected initSocket() {
        console.log("initSocket")
        this._socket.onConnected = (event) => { this.onConnected(event) };
        this._socket.onMessage = (msg) => { this.onMessage(msg) };
        this._socket.onError = (event) => { this.onError(event) };
        this._socket.onClosed = (event) => { this.onClosed(event) };
        this._isSocketInit = true;
    }



    // 网络连接成功
    protected onConnected(event) {
        console.log("CLNetNode onConnected!")
        this._isSocketOpen = true;
        this._state = NetNodeState.Working;
        this._connectedCallback(() => { });
        this.clearTimer()
        this.resetHearbeatTimer();
        console.log("CLNetNode onConnected! state =" + this._state);
    }


    // 接收到一个完整的消息包
    protected onMessage(msg: NetData): void {


        // 触发消息执行
        let data = this._protocolHelper.getPackage(msg);
        let rspCmd = data.cmd;
        let msgBuf = data.msgBuf;
        if (rspCmd == 2) {
            this.resetReceiveMsgTimer();
        }
        let listeners = this._listener[rspCmd];
        if (null != listeners) {
            for (const rsp of listeners) {
                console.log(`CLNetNode execute listener cmd ${rspCmd}`);
                if (isValid(rsp.target))
                    this._callbackExecuter(rsp, FTNetConfig.decodeList[rspCmd](msgBuf));
            }
        }
    }

    protected onError(event) {
        console.log("onError")
    }

    protected onClosed(event?) {
        console.log("onClose", event)
        FTLoadManager.ins.showLoading()
        this.clearTimer();
        // 执行断线回调，返回false表示不进行重连
        if (this._disconnectCallback && !this._disconnectCallback()) {
            console.log(`disconnect return!`)
            return;
        }

        if (this.isAutoReconnect()) {
            this._reconnectTimer = setTimeout(() => {
                console.log("发起重连")
                this._state = NetNodeState.Closed;
                this.connect(this._connectOptions);
                if (this._autoReconnect > 0) {
                    this._autoReconnect -= 1;
                }
            }, this._reconnetTimeOut);
        } else {
            this._state = NetNodeState.Closed;
        }
    }


    public close(code?: number, reason?: string) {
        console.error("close", code, reason)
        this.clearTimer();
        this._listener = {};

        if (this._socket) {
            this._socket.close(code, reason);
        } else {
            this._state = NetNodeState.Closed;
        }
    }

    // 只是关闭Socket套接字（仍然重用缓存与当前状态）
    public closeSocket(code?: number, reason?: string) {
        console.error("closeSocket", code, reason)
        if (this._socket) {
            this._socket.close(code, reason);
        }
    }
    public destroySocket() {
        console.log("destroySocket")
        this.rejectReconnect();
        if (this._socket) {
            this._socket.close();
        }
    }
    // 发起请求，如果当前处于重连中，进入缓存列表等待重连完成后发送
    public send(buf: NetData, force: boolean = false): boolean {
        if (this._state == NetNodeState.Working || force) {
            return this._socket.send(buf);
        }
        else {
            this.onClosed()
            console.error("CLNetNode request error! current state is " + this._state);
            return false;
        }
    }



    /********************** 回调相关处理 *********************/
    public setResponeHandler(cmd: number, callback: NetCallFunc, target: CCObject): boolean {
        if (callback == null) {
            console.error(`CLNetNode setResponeHandler error ${cmd}`);
            return false;
        }
        this._listener[cmd] = [{ target, callback }];
        return true;
    }

    public addResponeHandler(cmd: number, callback: NetCallFunc, target: CCObject): boolean {
        if (callback == null) {
            console.error(`CLNetNode addResponeHandler error ${cmd}`);
            return false;
        }
        let rspObject = { target, callback };
        if (null == this._listener[cmd]) {
            this._listener[cmd] = [rspObject];
        } else {
            let index = this.getNetListenersIndex(cmd, rspObject);
            if (-1 == index) {
                this._listener[cmd].push(rspObject);
            }
        }
        return true;
    }

    public removeResponeHandler(cmd: number, callback: NetCallFunc, target?: any) {
        if (null != this._listener[cmd] && callback != null) {
            let index = this.getNetListenersIndex(cmd, { target, callback });
            if (-1 != index) {
                this._listener[cmd].splice(index, 1);
            }
        }
    }

    public removeResponeHandlerByTarget(target: any): boolean {

        if (!target) return false;
        for (const key in this._listener) {
            if (Object.prototype.hasOwnProperty.call(this._listener, key)) {
                for (let index = this._listener[key].length - 1; index >= 0; index--) {
                    if (this._listener[key][index].target === target) {
                        this._listener[key].splice(index, 1);
                    }
                }
                if (this._listener[key].length == 0) {
                    delete this._listener[key];
                }
            }
        }
        return true
    }

    public cleanListeners(cmd: number = -1) {
        if (cmd == -1) {
            this._listener = {}
        } else {
            this._listener[cmd] = null;
        }
    }

    protected getNetListenersIndex(cmd: number, rspObject: CallbackObject): number {
        let index = -1;
        for (let i = 0; i < this._listener[cmd].length; i++) {
            let iterator = this._listener[cmd][i];
            if (iterator.callback == rspObject.callback
                && iterator.target == rspObject.target) {
                index = i;
                break;
            }
        }
        return index;
    }

    /********************** 心跳、超时相关处理 *********************/
    protected resetReceiveMsgTimer() {

        if (this._receiveMsgTimer !== null) {
            clearTimeout(this._receiveMsgTimer);
            this._noHeartNum = 0;
        }

    }

    protected resetHearbeatTimer() {

        this._keepAliveTimer = setTimeout(() => {
            console.log("CLNetNode keepAliveTimer send Hearbeat")
            FTSendManager.ins.sendHeart(this._protocolHelper.getHearbeat())
            this.resetHearbeatTimer();
        }, this._heartTime);

        this._receiveMsgTimer = setTimeout(() => {
            this._noHeartNum++;
            console.log(this._noHeartNum + "次未收到心跳")
            if (this._noHeartNum >= 2) {
                this.onClosed()
                this._noHeartNum = 0;

                FTLoadManager.ins.showLoading()
            }
        }, this._receiveTime)

    }

    protected clearTimer() {
        if (this._receiveMsgTimer !== null) {
            clearTimeout(this._receiveMsgTimer);
        }
        if (this._keepAliveTimer !== null) {
            clearTimeout(this._keepAliveTimer);
        }
        if (this._reconnectTimer !== null) {
            clearTimeout(this._reconnectTimer);
        }
    }

    public isAutoReconnect() {
        return this._autoReconnect != 0;
    }

    public rejectReconnect() {
        this._autoReconnect = 0;
        this.clearTimer();
    }
}