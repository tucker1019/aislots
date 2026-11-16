import { exitGame } from '../net/FDGameUI';
import { Button, js, Label, random, setDisplayStats, Size, sys, Vec3, view, View } from "cc"
import { FDAudioManager } from "../../fdframe/audio/FDAudioManager"

import FDLoadManager from "../load/FDLoadManager"
import { FDAudioMgr } from "../view/layer/FDAudioMgr"
import { FDGlobal } from "../view/layer/FDGlobal"
import { FDGameManager } from "../mgr/FDGameManager"
import { FDSTATE } from "../FDConstant/FDConstant"



// 格式化字符串
// example: formatStr("a: %s, b: %s", "1", "2")
export function formatStr(content, ...args) {
    return js.formatStr(content, ...args)
}



export function add_btn_listener(btn: Button, callback, target) {
    btn.node.on(Button.EventType.CLICK, () => {
        callback && callback.call(target)
    }, target)
}




// 返回到大厅
export function exitToPlatform() {
    reset_all()
    exitGame()
}
export function exitToLogin() {
    reset_all()
    exitGame()
}

// 重置全部
export function reset_all() {
    FDGameManager.setState(FDSTATE.READY);

    if (FDAudioMgr.Instance) FDAudioMgr.Instance.removeAudioRootNode()
    FDLoadManager.rest();
    FDLoadManager.ins = null;
    FDAudioMgr.Instance = null;
    FDAudioManager.instance = null;

}

export function recordTime() {
    return new Date().getTime()
}
export function showMoney(value: number, _grouped = true) {
    const whole = Math.trunc(value / 100);
    return (Object.is(whole, -0) ? 0 : whole).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}
export function recovMoney(value: string) {
    return Number(value.replace(/\./g, '')) * FDGlobal.GameTax;
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
    if (FDGlobal && FDGlobal.debugLog) {
        console.log(...args);
    }
}