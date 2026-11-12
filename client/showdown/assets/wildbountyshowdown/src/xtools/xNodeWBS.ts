// cocos组件扩展帮助类

import { isValid, Node, find, Component, Constructor, Label, Button, Sprite, Toggle, RichText, SpriteFrame, Color, NodeEventType, Vec3, tween, UIOpacity } from "cc";
import { consoleLog, showMoney } from "./WBSUtils";


// 友情提示 alt+k+0折叠 / alt+k+j展开
class M {

    setParent(path: string, referenceNode: Node, parentNode: Node): boolean {
        let node: Node = this.find(path, referenceNode);
        if (isValid(node) && isValid(parentNode)) {
            node.parent = parentNode;
            return true;
        }
    }

    show(path: string, referenceNode: Node): boolean {
        return this.setActive(path, referenceNode, true);
    }

    hide(path: string, referenceNode: Node): boolean {
        return this.setActive(path, referenceNode, false);
    }

    setActive(path: string, referenceNode: Node, val: boolean): boolean {
        let node: Node = this.find(path, referenceNode);
        if (isValid(node)) {
            node.active = val;
            return true;
        }
        consoleLog(`setActive xNodeWBS is not find    path:${path}  referenceNode:${isValid(referenceNode) ? referenceNode : "null"} `)
        return false;
    }

    find(path: string, referenceNode?: Node): Node {
        let rootBool: boolean = (path == undefined || path == "" || path == "/" || path == "./");//根目录即为节点本身
        let validBool: boolean = isValid(referenceNode)
        if (rootBool) {
            if (validBool)
                return referenceNode
            else consoleLog(` xNodeWBS is not find    path:${path}  referenceNode:${isValid(referenceNode) ? referenceNode : "null"} `)

        } else return find(path, referenceNode)
    }

    findComponent<T extends Component>(path: string, referenceNode: Node, component: Constructor<T>): T {
        let node = this.find(path, referenceNode);
        if (isValid(node)) return node.getComponent(component);
        else return null;

    }

    setLabel(path: string, referenceNode: Node, val: string): boolean {
        if (val == undefined) val = "";
        let label: Label = this.findComponent(path, referenceNode, Label)
        if (isValid(label)) {
            label.string = val;
            return true;
        }
        else consoleLog(` xNodeWBS is not find    path:${path}  referenceNode:${isValid(referenceNode) ? referenceNode : "null"} `)
        return false;
    }

    setLabelRollAni(label: Label, num: number, curNum: number = 0, time: number = 0.4, speed: number = 0.02, endFunc = null) {
        label.string = showMoney(curNum);
        if (curNum != num) {
            let showaward: number = curNum;
            let count = time / speed;
            let index = 0;
            tween(label.node)
                .repeat(count,
                    tween(label.node).delay(speed).call(() => {
                        index++;
                        showaward += (num - curNum) / count;
                    
                        if (showaward >= num) {
                            showaward = num
                        }
                        if (index >= count) showaward = num
                        let gold = showMoney(showaward);
                        label.string = gold;
                    })
                )
                .call(() => {
                    let gold = showMoney(num);
                    label.string = gold;
                    if (endFunc) {
                        endFunc();
                    }
                })
                .start()

        }
    }

    setBtnInteractable(path: string, referenceNode: Node, val: boolean, changeSpr: boolean = true, changeOpa: boolean = false) {
        let btn: Button = this.findComponent(path, referenceNode, Button)
        if (isValid(btn)) {
            btn.interactable = val;
            let sprites: Sprite[] = btn.getComponentsInChildren(Sprite)
            sprites.forEach((item) => {
                if (isValid(item)) {
                    item.grayscale = !val && changeSpr;
                }
            })
            let uiopa = btn.getComponent(UIOpacity);
            if (uiopa && changeOpa) {
                uiopa.opacity = val ? 255 : 50;
            }
            return true;
        }
        return false;
    }

    setToggleInteractable(path: string, referenceNode: Node, val: boolean) {
        let toogle: Toggle = this.findComponent(path, referenceNode, Toggle)
        if (isValid(toogle)) {
            toogle.interactable = val;
            let sprites: Sprite[] = toogle.getComponentsInChildren(Sprite);
            sprites.forEach((item) => {
                if (isValid(item)) {
                    item.grayscale = !val;
                }
            })

            return true;
        }
        return false;
    }

    setRichText(path: string, referenceNode: Node, val: string): boolean {
        if (val == undefined) val = "";
        let RichTexts: RichText = this.findComponent(path, referenceNode, RichText)
        if (isValid(RichTexts)) {
            RichTexts.string = val;
            return true;
        }
        return false;
    }

    setSpriteFrame(path: string, referenceNode: Node, spriteFrame: SpriteFrame): boolean {
        let node = this.find(path, referenceNode);
        if (node && isValid(node)) {
            let sprite = node.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = spriteFrame;
                return true;
            } else {
                consoleLog(`missing Sprite: ${referenceNode && referenceNode.name}/${path}`)
            }
        }
        return false;
    }
    getProperty<T extends Component>(path: string, referenceNode: Node, component: Constructor<T>, prototypeName: string, defalutVal: any) {
        let node = this.find(path, referenceNode);
        if (node && isValid(node)) {
            let property = node.getComponent(component);
            if (property && property[prototypeName]) {
                return property[prototypeName]
            }
        }
        return defalutVal
    }

    setProperty<T extends Component>(path: string, referenceNode: Node, component: Constructor<T>, prototypeName: string, val: any) {
        let node = this.find(path, referenceNode);
        if (node && isValid(node)) {
            let property = node.getComponent(component);
            if (property) {
                property[prototypeName] = val;
            }
            return true
        }
        consoleLog("setProperty error path = " + path)
        return false;
    }


    addClick(path: string, referenceNode: Node, func: Function): boolean {
        let node = this.find(path, referenceNode);
        if (node && isValid(node)) {
            if (node.getComponent(Button)) {
                node.on("click", func);
                return true;
            } else {
                let button = node.addComponent(Button);
                button.transition = Button.Transition.SCALE;
                button.zoomScale = .9;
                button.duration = .2;
                node.on("click", func);
                return true;
            }
        }
        return false;
    }

    offClick(path: string, referenceNode: Node, func: Function): boolean {
        let node = this.find(path, referenceNode);
        if (node && isValid(node)) {
            if (node.getComponent(Button)) {
                node.off("click", func);
                return true;
            }
            consoleLog(`missing offClick: ${referenceNode && referenceNode.name}/${path}`)
            return false
        }
        return false;
    }


    /**
     *  sing要求 变更bet touch-start就响应
     * @param path 
     * @param referenceNode 
     * @param func 
     * @returns 
     */
    addTouchStartClick(path: string, referenceNode: Node, func: Function): boolean {
        let node = this.find(path, referenceNode);
        if (node && isValid(node)) {
            if (node.getComponent(Button)) {
                node.on(NodeEventType.TOUCH_START, func);
                return true;
            } else {
                let button = node.addComponent(Button);
                button.transition = Button.Transition.SCALE;
                button.zoomScale = .9;
                button.duration = .2;
                node.on(NodeEventType.TOUCH_START, func);
                return true;
            }
        }
        return false;
    }
    addTouchCanelAndEndClick(path: string, referenceNode: Node, func: Function): boolean {
        let node = this.find(path, referenceNode);
        if (node && isValid(node)) {
            if (node.getComponent(Button)) {
                node.on(NodeEventType.TOUCH_END, func);
                node.on(NodeEventType.TOUCH_CANCEL, func);
                return true;
            } else {
                let button = node.addComponent(Button);
                button.transition = Button.Transition.SCALE;
                button.zoomScale = .9;
                button.duration = .2;
                node.on(NodeEventType.TOUCH_START, func);
                return true;
            }
        }
        return false;
    }

    addToggle(path: string, referenceNode: Node, func: Function): boolean {
        let node = this.find(path, referenceNode);
        if (node && isValid(node)) {
            if (node.getComponent(Toggle)) {
                node.on("toggle", func);
                return true;
            } else {
                consoleLog(`missing Toggle: ${referenceNode && referenceNode.name}/${path}`)
            }
        } else {
            consoleLog(`missing node: ${referenceNode && referenceNode.name}/${path}`)
        }
        return false;
    }

    schedule(tar: Component, f: string | Function, time?: number, isDelay?: boolean): void {
        consoleLog("【xNode】schedule" + tar.name + " " + f);
        let func: Function = typeof (f) == "string" ? tar[f] : f;
        if (!func) {
            consoleLog(`Missing function ${f} of ${tar.name}`);
            return;
        }
        let fname = typeof (f) == "string" ? f : f.name;
        if (fname == null || fname == "") fname = (Math.random() * Date.now()).toString();
        let tempname = "__" + fname;
        let bindFunc = tar[tempname];
        if (!bindFunc) {
            bindFunc = func.bind(tar);
            tar[tempname] = bindFunc;
        }
        tar.unschedule(bindFunc);
        if (time == undefined) time = 0;
        tar.scheduleOnce(bindFunc, time);

    }

    scheduleOnce(tar: Component, f: string | Function, time?: number): string {
        consoleLog(f, "【xNode】scheduleOnce " + tar.name);
        let func: Function = typeof (f) == "string" ? tar[f] : f;
        if (!func) {
            consoleLog(`Missing function ${f} of ${tar.name}`);
            return;
        }
        let fname = typeof (f) == "string" ? f : f.name;
        if (fname == null || fname == "") fname = (Math.random() * Date.now()).toString();
        let tempname = "__" + fname;
        let bindFunc = tar[tempname];
        if (!bindFunc) {
            bindFunc = func.bind(tar);
            tar[tempname] = bindFunc;
        }
        tar.unschedule(bindFunc);
        if (time == undefined) time = 0;
        tar.scheduleOnce(bindFunc, time);
        return fname;
    }

    unschedule(tar: Component, funcName: string) {
        consoleLog("【xNode】unschedule " + tar.name, funcName);
        let func = tar[funcName];
        if (!func) {
            consoleLog(`Missing function ${funcName} of ${tar.name}`);
            return;
        }
        let tempname = "__" + funcName;
        let bindFunc = tar[tempname];
        if (bindFunc) {
            tar.unschedule(bindFunc);
        }
    }

    unscheduleAll(tar: Component) {
        consoleLog("【xNode】unscheduleAll", tar.name);
        tar.unscheduleAllCallbacks();
    }

    setPopOpenAni(node: Node) {
        let _scale = node.getScale()
        node.scale = new Vec3(_scale.x * .6, _scale.y * .6, 1)
        tween(node)
            .to(.2, { scale: new Vec3(_scale.x * 1.15, _scale.x * 1.15, 1) })
            .to(0.1, { scale: new Vec3(_scale.x, _scale.x, 1) })
            .start()
    }

    setPopCloseAni(node: Node, closeCallback?: Function) {
        let _scale = node.getScale()
        tween(node)
            .to(.1, { scale: new Vec3(1.1 * _scale.x, 1.1 * _scale.y, 1) })
            .to(0.2, { scale: new Vec3(.6 * _scale.x, .6 * _scale.y, 1) })
            .call(() => { closeCallback && closeCallback() })
            .start()
    }
}
/**
 * cocos组件扩展帮助类
 */
export const xNodeWBS = new M();