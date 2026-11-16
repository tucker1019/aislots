// cocos组件扩展帮助类

import { Button, Component, find, isValid, Label, Node, RichText, Sprite, SpriteFrame, Toggle, ToggleContainer, __private, tween } from "cc";
import { ftframe } from "../ftframe/ftframe";
import { showMoney } from "../game/common/FTUtils";


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
        ftframe.log.logError(`setActive xNodeFT is not find    path:${path}  referenceNode:${isValid(referenceNode) ? referenceNode : "null"} `)
        return false;
    }

    find(path: string, referenceNode?: Node): Node {
        let rootBool: boolean = (path == undefined || path == "" || path == "/" || path == "./");//根目录即为节点本身
        let validBool: boolean = isValid(referenceNode)
        if (rootBool) {
            if (validBool)
                return referenceNode
            else ftframe.log.logError(` xNodeFT is not find    path:${path}  referenceNode:${isValid(referenceNode) ? referenceNode : "null"} `)

        } else return find(path, referenceNode)
    }

    findComponent<T extends Component>(path: string, referenceNode: Node, component?): T {
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
        return false;
    }

    setLabelRollAni(label: Label, num: number, curNum: number = 0, time: number = 0.4, speed: number = 0.02) {
        label.string = showMoney(curNum);
        if (curNum != num) {
            let showaward: number = curNum;
            let count = time / speed;
            let index = 0;
            tween(label.node)
                .repeat(count,
                    tween(label.node).delay(speed).call(() => {
                        showaward += (num - curNum) / count;
                
                        if (showaward >= num) {
                            showaward = num
                        }
                        index++;
                        if (index == count) {
                            showaward = num
                        }
                        let gold = showMoney(showaward);
                        label.string = gold;
                    })
                )
                .call(() => {
                    let gold = showMoney(num);
                    label.string = gold;
                })
                .start()

        }
    }

    setBtnInteractable(path: string, referenceNode: Node, val: boolean) {
        let btn: Button = this.findComponent(path, referenceNode, Button)
        if (isValid(btn)) {
            btn.interactable = val;
            let sprites: Sprite[] = btn.getComponentsInChildren(Sprite)
            sprites.forEach((item) => {
                if (isValid(item)) {
                    item.grayscale = !val;
                }
            })
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
                ftframe.log.logError(`missing Sprite: ${referenceNode && referenceNode.name}/${path}`)
            }
        }
        return false;
    }
    getProperty<T extends Component>(path: string, referenceNode: Node, component: __private._types_globals__Constructor<T>, prototypeName: string, defalutVal: any) {
        let node = this.find(path, referenceNode);
        if (node && isValid(node)) {
            let property = node.getComponent(component);
            if (property && property[prototypeName]) {
                return property[prototypeName]
            }
        }
        return defalutVal
    }

    setProperty<T extends Component>(path: string, referenceNode: Node, component: __private._types_globals__Constructor<T>, prototypeName: string, val: any) {
        let node = this.find(path, referenceNode);
        if (node && isValid(node)) {
            let property = node.getComponent(component);
            if (property) {
                property[prototypeName] = val;
            }
            return true
        }
        ftframe.log.logError("setProperty error path = " + path)
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
            ftframe.log.logError(`missing offClick: ${referenceNode && referenceNode.name}/${path}`)
            return false
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
                ftframe.log.logError(`missing Toggle: ${referenceNode && referenceNode.name}/${path}`)
            }
        } else {
            ftframe.log.logError(`missing node: ${referenceNode && referenceNode.name}/${path}`)
        }
        return false;
    }

    schedule(tar: Component, f: string | Function, time?: number, isDelay?: boolean): void {
        ftframe.log.logError("【xNode】schedule" + tar.name + " " + f);
        let func: Function = typeof (f) == "string" ? tar[f] : f;
        if (!func) {
            ftframe.log.logError(`Missing function ${f} of ${tar.name}`);
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
        ftframe.log.table(f, "【xNode】scheduleOnce " + tar.name);
        let func: Function = typeof (f) == "string" ? tar[f] : f;
        if (!func) {
            ftframe.log.logError(`Missing function ${f} of ${tar.name}`);
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
        ftframe.log.table("【xNode】unschedule " + tar.name, funcName);
        let func = tar[funcName];
        if (!func) {
            ftframe.log.logError(`Missing function ${funcName} of ${tar.name}`);
            return;
        }
        let tempname = "__" + funcName;
        let bindFunc = tar[tempname];
        if (bindFunc) {
            tar.unschedule(bindFunc);
        }
    }

    unscheduleAll(tar: Component) {
        ftframe.log.table("【xNode】unscheduleAll", tar.name);
        tar.unscheduleAllCallbacks();
    }

}
/**
 * cocos组件扩展帮助类
 */
export const xNodeFT = new M();