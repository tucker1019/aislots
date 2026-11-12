import { Component, _decorator, sys } from "cc";
import { consoleLog, consoleLogError } from "../../xtools/WBSUtils";


const { ccclass } = _decorator;

@ccclass('WBSStorageManager')

export class WBSStorageManager extends Component {

    _id: string = "-1";
    _gameid: number = 0;
    /**
     * 设置用户标识
     * @param id 
     */
     setUserAndGameId(id: string, gameid: number) {
        this._id = id;
        this._gameid = gameid;
        consoleLog(`store set userid=${id} gameid=${gameid}`)
    }

    /**
     * 存储
     * @param key 存储key
     * @param value 存储值
     * @returns 
     */
    set(key: string, value: any) {
        if (null == key) {
            consoleLogError("存储的key不能为空");
            return;
        }
        key = `${this._id}_${this._gameid}_${key}`
        if (null == value) {
            consoleLogError("存储的值为空，则直接移除该存储");
            this.remove(key);
            return;
        }
        if (typeof value === 'function') {
            consoleLogError("储存的值不能为方法");
            return;
        }
        if (typeof value === 'object') {
            try {
                value = JSON.stringify(value);
            }
            catch (e) {
                consoleLogError(`解析失败，str = ${value}`);
                return;
            }
        }
        else if (typeof value === 'number') {
            value = value + "";
        }
        consoleLog(`写入缓存 key=${key} value=${value}`)
        sys.localStorage.setItem(key, value);
    }

    /**
     * 获取
     * @param key 获取的key
     * @param defaultValue 获取的默认值
     * @returns 
     */
    get(key: string, defaultValue?: any) {
        if (null == key) {
            consoleLogError("存储的key不能为空");
            return;
        }
        key = `${this._id}_${this._gameid}_${key}`
        let str: string | null = sys.localStorage.getItem(key);
        consoleLog(`获取缓存 key=${key} value=${str}`)
        if (null == defaultValue) {
            return str;
        }
        if (null === str) {
            return defaultValue;
        }
        if (typeof defaultValue === 'number') {
            return Number(str) || 0;
        }
        if (typeof defaultValue === 'boolean') {
            return "true" == str; // 不要使用Boolean("false");
        }
        if (typeof defaultValue === 'object') {
            try {
                return JSON.parse(str);
            }
            catch (e) {
                consoleLogError("解析数据失败,str=" + str);
                return defaultValue;
            }

        }

        return str;
    }

    /**
     * 移除某个值
     * @param key 需要移除的key 
     * @returns 
     */
    remove(key: string) {
        if (null == key) {
            consoleLogError("存储的key不能为空");
            return;
        }

        key = `${this._id}_${this._gameid}_${key}`;
        sys.localStorage.removeItem(key);
    }

    /**
     * 清空整个本地存储
     */
    clear() {
        sys.localStorage.clear();
    }
}