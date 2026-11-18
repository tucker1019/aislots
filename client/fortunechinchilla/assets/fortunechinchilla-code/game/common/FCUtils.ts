import { Button, isValid, js, Label, random, setDisplayStats, Size, sys, Vec3, view, View } from "cc"
import { FCAudioManager } from "../../fcframe/audio/FCAudioManager"

import { FCPlatformMgr } from "../3rd/FCPlatformMgr"
import Long from "../3rd/Long"
import FCLoadManager from "../load/FCLoadManager"
import { FCAudioMgr } from "../view/layer/FCAudioMgr"
import { FCGameConstants } from "../view/layer/FCGameConstants"
import { FCGlobal } from "../view/layer/FCGlobal"
import { FCGameManager } from "../mgr/FCGameManager"
import { FCSTATE } from "../FCConstant/FCConstant"
import { Language } from "../view/layer/FCConfigCtrl"
import { fc_l_id } from "../language/fc_id"
import { DEV } from "cc/env"
import { fc_l_es } from "../language/fc_es"



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
    FCPlatformMgr.exitToPlatform()
}
export function exitToLogin() {
    reset_all()
    FCPlatformMgr.exitToLogin()
}

// 重置全部
export function reset_all() {
    FCGameManager.setState(FCSTATE.READY);
    FCGlobal.MODE = "real";
    FCGlobal.USER.experienceGold = 10000000;
    if (FCAudioMgr.Instance) FCAudioMgr.Instance.removeAudioRootNode()
    FCLoadManager.rest();
    FCLoadManager.ins = null;
    FCAudioMgr.Instance = null;
    FCAudioManager.instance = null;

}

export function recordTime() {
    return new Date().getTime()
}
export function longToNumber(value): number {
    if (!value) return 0
    let newLong = new Long(value.low, value.high, value.unsigned);
    return newLong.toNumber();
}
export const numberToLong = (number: number) => {
    return Long.fromValue(number)
}
export function showMoney(value: number, _grouped = true) {
    const whole = Math.trunc(value / 100);
    return (Object.is(whole, -0) ? 0 : whole).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}
export function recovMoney(value: string) {
    return Number(value.replace(/\./g, '')) * 100;
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

export function __(key: string): string {
    let lang = FCPlatformMgr.getLanguage();
    if (lang == Language.EN) return key
    else if (lang == "id") {
        return fc_l_id[key] || key
    } else if (lang == "es") {
        return fc_l_es[key] || key
    }
    return key
}
export function translateAll(node) {
    if (!node) { return; }
    translateChildren(node);
    if (node.children) {
        node.children.forEach(child => {
            translateAll(child.node);
        });
    }
}
export function translateChildren(node) {
    let arr = node.getComponentsInChildren(Label);
    arr.forEach(label => {
        if (isValid(label))
            label.string = __(label.string);
    });
    // let richTexts = node.getComponentsInChildren(RichText);
    // richTexts.forEach(label => {
    //     if (CONFIG.lang != "en") {
    //         richTexts.font = null;
    //         richTexts.useSystemFont = true;
    //     }
    //     label.string = __(label.string);
    // });
    // let boxes = node.getComponentsInChildren(ditBox);
    // boxes.forEach(edit => {
    //     edit.placeholder = __(edit.placeholder);
    // });
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
    if (FCGlobal && FCGlobal.debugLog) {
        console.log(...args);
    }
}
export function isWeb() { return sys.isBrowser; }
export function isNative() { return sys.isNative; }
