import { Button, js, Label, random, setDisplayStats, Size, sys, Vec3, view, View } from "cc"
import { FTAudioManager } from "../../ftframe/audio/FTAudioManager"

import { FTPlatformMgr } from "../3rd/FTPlatformMgr"
import Long from "../3rd/Long"
import FTLoadManager from "../load/FTLoadManager"
import FTNetController from "../net/FTNetController"
import FTSendManager from "../net/FTSendManager"
import { FTAudioMgr } from "../view/layer/FTAudioMgr"
import { FTGameConstants } from "../view/layer/FTGameConstants"
import { FTGlobal } from "../view/layer/FTGlobal"
import { FTGameManager } from "../mgr/FTGameManager"
import { FTSTATE } from "../FTConstant/FTConstant"



// 格式化字符串
// example: formatStr("a: %s, b: %s", "1", "2")
export function formatStr(content, ...args) {
    return js.formatStr(content, ...args)
}

// 是否是网页端
export function isWeb() {
    return !sys.isNative
}

// 是否本地端
export function isNative() {
    return sys.isNative
}

export function add_btn_listener(btn: Button, callback, target) {
    btn.node.on(Button.EventType.CLICK, () => {
        callback && callback.call(target)
    }, target)
}

// 获取适配的宽高度
export function getAdapterScale(): Vec3 {
    let our_designer_width = 750
    let our_designer_height = 1334
    if (isWeb()) {

        return new Vec3(1, 1, 1)
    }
    let design_size = View.instance.getDesignResolutionSize();
    // let design_size = new Size(1792, 828)

    console.log(design_size)
    // let frameSize = View.instance.getFrameSize()
    // let canvas_size = View.instance.getCanvasSize()

    // console.log("designer size", design_size.width, design_size.height)
    // console.log("frameSize size", frameSize.width, frameSize.height)
    // console.log("canvas_size size", canvas_size.width, canvas_size.height)

    let scalex = design_size.width / our_designer_width
    let scaley = design_size.height / our_designer_height
    console.log("适配分辨率", scalex, scaley, design_size.width, design_size.height)

    if (scalex < scaley) {
        return new Vec3(scalex, scalex, scalex)
    } else {
        return new Vec3(scaley, scaley, scaley)
    }

}





// 返回到大厅
export function exitToPlatform() {
    reset_all()
    FTPlatformMgr.exitToPlatform()
}
export function exitToLogin() {
    reset_all()
    FTPlatformMgr.exitToLogin()
}

// 重置全部
export function reset_all() {
    FTGameManager.setState(FTSTATE.READY);
    FTGlobal.MODE = "real";
    FTGlobal.USER.experienceGold = 10000000;
    if (FTAudioMgr.Instance) FTAudioMgr.Instance.removeAudioRootNode()
    FTLoadManager.rest();
    FTLoadManager.ins = null;
    FTNetController.closeNet();
    FTSendManager.rest()
    FTAudioMgr.Instance = null;
    FTAudioManager.instance = null;

}

export function recordTime() {
    return new Date().getTime()
}
export function longToNumber(value): number {
    if (!value) return 0
    let newLong = new Long(value.low, value.high, value.unsigned);
    return newLong.toNumber();
}
export function showMoney(value: number, is: boolean = true) {
    value = Math.floor(value)
    let s = String(value);
    while (s.length < 3) {
        s = s.slice(0, 0) + "0" + s.slice(0);
    }
    let str: string;
    if (FTGlobal.isPoint == 1) {
        // 分转元，固定两位小数：100 -> 1.00, 1050 -> 10.50, 5 -> 0.05
        str = s.slice(0, s.length - 2) + "." + s.slice(s.length - 2);
        if (str[0] == ".") {
            str = str.slice(0, 0) + "0" + str.slice(0);
        }
    } else {
        // 只显示整元，字符串丢掉后两位：100 -> 1, 1050 -> 10, 5 -> 0
        str = s.slice(0, s.length - 2);
        while (str.length > 1 && str[0] == "0") {
            str = str.slice(1);
        }
        if (str.length == 0) {
            str = "0";
        }
    }
    if (is)
        return (str).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    else return str + ""
}
export function recovMoney(value: string) {
    return Number(value.replace(/,/g, '')) * 100;
}

export function cloneArray(list: Array<any>): Array<any> {
    let cloneList: Array<any> = [];
    list.forEach((value, index) => {
        cloneList[index] = value
    })
    return cloneList
}

export function mergeObjectRecursion(target, source) {
    if (!target) return;
    for (let key in source) {
        const src = source[key];
        if (source.hasOwnProperty(key) && src !== undefined) {

            if (Object.prototype.toString.call(src) == '[object Object]') {
                target[key] = target[key] || {};
                mergeObjectRecursion(target[key], src);
            } else if (Object.prototype.toString.call(src) == '[object Array]') {
                target[key] = target[key] || [];
                mergeObjectRecursion(target[key], src);
            }
            else {
                target[key] = src;
            }
        }
    }
    return target;
}



export function cloneObject(source) {
    let newObj: any = {};
    if (source) {
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                const element = source[key];
                newObj[key] = element;
            }
        }
    }
    return newObj;
}

/**
 * 获取 URL 参数
 * @param name 参数名，如果不传则返回所有参数对象
 * @returns 参数值或参数对象
 */
export function getUrlParam(name?: string): string | { [key: string]: string } | null {
    if (typeof window === 'undefined') {
        return name ? null : {};
    }
    
    const search = window.location.search;
    if (!search) {
        return name ? null : {};
    }
    
    // 移除开头的 '?'
    const queryString = search.substring(1);
    const params: { [key: string]: string } = {};
    
    // 解析参数
    queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key) {
            params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
        }
    });
    
    // 如果指定了参数名，返回对应的值
    if (name) {
        return params[name] || null;
    }
    
    // 否则返回所有参数对象
    return params;
}

/**
 * 受 MWTGlobal.debugLog 控制的日志输出
 * 替代直接使用 console.log，可以通过 MWTGlobal.debugLog 统一控制
 */
export function debugLog(...args: any[]): void {
    if (FTGlobal && FTGlobal.debugLog) {
        console.log(...args);
    }
}