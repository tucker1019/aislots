import { formatMinor } from '../network/display';
import { Node, Tween, Vec3, bezier, js, sys, tween } from "cc";
import { WBSConfig } from "../wbsgame/cfg/WBSConfig";


export const consoleLog = (...args) => WBSConfig.debugLog && (sys.isNative ? args.forEach(arg => console.log(JSON.stringify(arg))) : console.log(...args))

export const consoleLogError = (...args) => sys.isNative ? args.forEach(arg => console.error(JSON.stringify(arg))) : console.error(...args)

export const formatStr = (content, ...args) => js.formatStr(content, ...args)

export const recordTime = () => new Date().getTime();

/**
 * 深拷贝
 * @param list 
 * @returns 
 */
export const cloneArray = (list: Array<any>): Array<any> => {
    let cloneList: Array<any> = [];
    list.forEach((value, index) => {
        cloneList[index] = value
    })
    return cloneList

}

export const randomInt = (endInt: number, startInt: number = 0): number => Math.floor(Math.random() * (endInt - startInt)) + startInt;

export function showMoney(value:number,group=true){return formatMinor(value,group);}

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



export const playFruitsTween = (startPos: Vec3, node: Node, time: number, endPos: Vec3): Tween<Vec3> => {

    let fruitTween = tween(startPos);
    const mixY = 100;
    const maxY = 100;
    const mixX = 100;
    const maxX = 100;
    let startAngle = node.eulerAngles;
    let progressX = (start, end, current, t) => {
        current = bezier(start, mixX, maxX, end, t);
        return current
    }
    let progressY = (start, end, current, t) => {
        current = bezier(start, mixY, maxY, end, t);
        return current
    }
    fruitTween.parallel(
        tween().to(time, { x: endPos.x }, {
            progress: progressX, easing: "smooth", onUpdate: () => {
                node.setPosition(startPos)
            }
        }),
        tween().to(time, { y: endPos.y }, {
            progress: progressY, easing: "smooth", onUpdate: () => {
                node.setPosition(startPos)
            }
        })
    )
    return fruitTween

}

export const shakeNode = (node: Node, param?: { times?: number, duration?: number, amp?: number, srcPos?: Vec3 }) => {
    if (!param) {
        param = { times: 5, duration: 0.05, amp: 5 };
    }
    let times = param.times || 6;
    let duration = param.duration || 0.2;
    let amp = param.amp || 5;
    let srcPos = param.srcPos || node.position;
    let destPos = new Vec3;
    let arr: Tween<Node>[] = [];

    let pcnt = Math.floor(times / duration);
    for (let i = 0; i < pcnt; ++i) {
        if (i == pcnt - 1) {
            destPos.x = srcPos.x;
            destPos.y = srcPos.y;
        } else {
            let angle = Math.random() * Math.PI * 2;
            destPos.x = Math.cos(angle) * amp + srcPos.x;
            destPos.y = Math.sin(angle) * amp + srcPos.y;
        }
        arr.push(tween().to(duration, { position: new Vec3(destPos.x, destPos.y) }));
    }
    tween(node).sequence(...arr).start()
}

export const findValueIn2DArray = (matrix: number[][], value: number): { col: number, row: number } | null => {
    for (let col = 0; col < matrix.length; col++) {
        for (let row = 0; row < matrix[col].length; row++) {
            if (matrix[col][row] === value) {
                return { col, row };
            }
        }
    }
    return null; // 如果没有找到值，返回null
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
    if (WBSConfig && WBSConfig.debugLog) {
        console.log(...args);
    }
}