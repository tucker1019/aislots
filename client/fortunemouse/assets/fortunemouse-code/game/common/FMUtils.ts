import { exitGame } from '../net/FMGameUI';
import { assetManager, Button, isValid, js, Label, random, setDisplayStats, Size, sys, Vec3, view, View } from "cc"
import { FMAudioManager } from "../../fmframe/audio/FMAudioManager"

import Long from "../3rd/Long"
import FMLoadManager from "../load/FMLoadManager"
import { FMAudioMgr } from "../view/layer/FMAudioMgr"
import { FMGameConstants } from "../view/layer/FMGameConstants"
import { FMGlobal } from "../view/layer/FMGlobal"
import { FMGameManager } from "../mgr/FMGameManager"
import { FMSTATE } from "../FMConstant/FMConstant"
import { Language } from "../view/layer/FMConfigCtrl"
import { fm_l_id } from "../../language/fm_id"
import { DEV } from "cc/env"



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

// 获取适配的宽高度
export function getAdapterScale(): Vec3 {
    let our_designer_width = 750
    let our_designer_height = 1334
    let design_size: Size = null
    if (DEV) {
        design_size = view.getVisibleSize()
    } else
        design_size = View.instance.getDesignResolutionSize();
    // let design_size = new Size(1792, 828)

    console.log(design_size)
    // let frameSize = View.instance.getFrameSize()
    // let canvas_size = View.instance.getCanvasSize()

    // console.log("designer size", design_size.width, design_size.height)
    // console.log("frameSize size", frameSize.width, frameSize.height)
    // console.log("canvas_size size", canvas_size.width, canvas_size.height)

    let scalex = design_size.width / our_designer_width
    let scaley = design_size.height / our_designer_height
    console.log("适配分辨率", scalex, scaley)

    if (scalex < scaley) {
        return new Vec3(scalex, scalex, 1)
    } else {
        return new Vec3(scaley, scaley, 1)
    }

}



export const exitToPlatform = exitGame;
export const exitToLogin = exitGame;

export function recordTime() {
    return new Date().getTime()
}
export function longToNumber(value): number {
    if (typeof value === "number") return value;
    if (!value) return 0
    let newLong = new Long(value.low, value.high, value.unsigned);
    return newLong.toNumber();
}
export function showMoney(value: number, _grouped = true) {
    const whole = Math.trunc(value / 100);
    return (Object.is(whole, -0) ? 0 : whole).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}
export const numberToLong = (number: number) => {
    return Long.fromValue(number)
}
export function recovMoney(value: string) {
    return Number(value.replace(/\./g, '')) * FMGlobal.GameTax;
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
    let lang = FMGlobal.LANG;
    if (lang === "en") return key
    else if (lang === "id") {
        return fm_l_id[key] || key
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
    if (FMGlobal && FMGlobal.debugLog) {
        console.log(...args);
    }
}