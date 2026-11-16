
import { CCObject } from "cc";
import { ftframe } from "../ftframe";


/**
 * 全局事件监听方法
 * @param event      事件名
 * @param args       事件参数
 */
export type ListenerFunc = (event: string, args: any) => void

class EventData {
    public event!: string;
    public listener!: ListenerFunc;
    public target: CCObject;
}


export class FTEventManager {

    private static instance: FTEventManager = null;

    static get Instance() {
        if (this.instance == null)
            this.instance = new FTEventManager()
        return this.instance
    }

    private events: { [key: string]: Array<EventData> } = {};

    /**
     * 注册全局事件
     * @param event      事件名
     * @param listener   处理事件的侦听器函数
     * @param object     侦听函数绑定的作用域对象
     */
    on(event: string, listener: ListenerFunc, target: CCObject) {
        if (!event || !listener) {
            ftframe.log.logError(`注册【${event}】事件的侦听器函数为空`);
            return;
        }

        let list: Array<EventData> = this.events[event];
        if (list == null) {
            list = [];
            this.events[event] = list;
        }

        let length = list.length;
        for (let i = 0; i < length; i++) {
            let bin = list[i];
            if (bin.listener == listener && bin.target == target) {
                ftframe.log.logError(`名为【${event}】的事件重复注册侦听器`);
            }
        }

        let data: EventData = new EventData();
        data.event = event;
        data.listener = listener;
        data.target = target;
        list.push(data);
    }

    /**
     * 监听一次事件，事件响应后，该监听自动移除
     * @param event     事件名
     * @param listener  事件触发回调方法
     * @param object    侦听函数绑定的作用域对象
     */
    once(event: string, listener: ListenerFunc, target: CCObject) {
        let _listener: any = ($event: string, $args: any) => {
            this.off(event, _listener, target);
            _listener = null;
            listener.call(target, $event, $args);
        }
        this.on(event, _listener, target);
    }

    /**
     * 移除全局事件
     * @param event     事件名
     * @param listener  处理事件的侦听器函数
     * @param target    侦听函数绑定的作用域对象
     */
    off(event: string, listener: Function, target: CCObject) {
        let list: Array<EventData> = this.events[event];

        if (!list) {
            ftframe.log.logError(`名为【${event}】的事件不存在`);
            return;
        }

        let length = list.length;
        for (let i = length - 1; i >= 0; i--) {
            let bin: EventData = list[i];
            if (bin.listener == listener && bin.target == target) {
                list.splice(i, 1);
                break;
            }
        }

        if (list.length == 0) {
            delete this.events[event];
        }
    }
    /**
        * 根据target 移除全局事件
        * @param target     事件名
      
        */
    offByTarger(target: CCObject) {

        for (const eventName in this.events) {
            if (Object.prototype.hasOwnProperty.call(this.events, eventName)) {
                const eventDatas = this.events[eventName];
                let length = eventDatas.length;
                for (let i = length - 1; i >= 0; i--) {
                    let eventData: EventData = eventDatas[i];
                    if (eventData.target === target) {
                        eventDatas.splice(i, 1);
                        break;
                    }
                }
                if (eventDatas.length == 0) {
                    delete this.events[eventName];
                }
            }
        }
    }
    /** 
     * 触发全局事件 
     * @param event(string)      事件名
     * @param args(any)          事件参数
     */
    dispatchEvent(event: string, args: any = null) {
        let list: Array<EventData> = this.events[event];

        if (list != null) {
            let temp: Array<EventData> = list.concat();
            let length = temp.length;
            for (let i = 0; i < length; i++) {
                let eventBin = temp[i];
                eventBin.listener.call(eventBin.target, event, args);
            }
        }
    }
}