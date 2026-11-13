
import { FTPlatformMgr } from "../../game/3rd/FTPlatformMgr";
import { ftframe } from "../ftframe";
import { ISocket, NetData } from "./FTNetInterface";

/*
*   WebSocket封装
*   1. 连接/断开相关接口
*   2. 网络异常回调
*   3. 数据发送与接收
*   

*/

export class FTWebSock implements ISocket {

    private _ws: WebSocket = null;              // websocket对象

    onConnected: (event) => void = null;
    onMessage: (msg) => void = null;
    onError: (event) => void = null;
    onClosed: (event) => void = null;

    connect(options: any) {
        if (this._ws) {
            // if (this._ws.readyState === WebSocket.CONNECTING) {
            // console.log("websocket connecting, wait for a moment...")
            this._ws.onmessage = null
            this._ws.onopen = null
            this._ws.onerror = null
            this._ws.onclose = null
            this._ws.close()
            // return false;
            // }
        }
        let url = null;
        if (options.url) {
            url = options.url;
        } else {
            let ip = options.ip;
            let port = options.port;
            let protocol = options.protocol;
            url = `${protocol}://${ip}:${port}`;
        }
        let pemUrl = "";
        // @ts-ignore
        this._ws = new WebSocket(url, [], pemUrl);
        this._ws.binaryType = "arraybuffer";
        this._ws.onmessage = (event) => {
            this.onMessage(event.data);
        };
        this._ws.onopen = this.onConnected;
        this._ws.onerror = this.onError;
        this._ws.onclose = this.onClosed;
        return true;
    }

    send(buffer: NetData) {
        if (this._ws.readyState == WebSocket.OPEN) {
            this._ws.send(buffer);
            return true;
        }
        return false;
    }

    close(code?: number, reason?: string) {
        console.log("close netnode")
        this._ws.close(code, reason);
    }
}