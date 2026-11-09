import { _decorator, Component, Node, Tween, Vec3, tween } from 'cc';
const { ccclass, property } = _decorator;

type Position = { x: number; y: number; z: number };
interface Panel {
    active: boolean;
    position: Position;
    setPosition(x: number, y: number, z: number): void;
}
type Animate = (panel: Panel, destination: Position, seconds: number, done: () => void) => void;

/** 只负责两个面板的切换时序，不包含声音、退出、规则、历史等业务。 */
export class BottomPanelTransition {
    private readonly homes: Position[];
    private current: 1 | 2 = 1;
    private busy = false;
    private disposed = false;
    private revision = 0;
    get selected(): 1 | 2 { return this.current; }

    constructor(
        private panel1: Panel,
        private panel2: Panel,
        private animate: Animate,
    ) {
        this.homes = [panel1, panel2].map((panel) => ({
            x: panel.position.x,
            y: panel.position.y,
            z: panel.position.z,
        }));
        panel1.active = true;
        panel2.active = false;
    }

    show(target: 1 | 2) {
        if (this.disposed || this.busy || target === this.current) return;
        this.busy = true;
        const revision = ++this.revision;
        const panels = [this.panel1, this.panel2];
        const outgoing = panels[this.current - 1];
        const incoming = panels[target - 1];
        const outHome = this.homes[this.current - 1];
        const inHome = this.homes[target - 1];
        // 参考工程的可见y=-111、隐藏y=-320，相对下移209；保留当前场景配置的坐标。
        this.animate(outgoing, { ...outHome, y: outHome.y - 209 }, 0.08, () => {
            if (this.disposed || revision !== this.revision) return;
            outgoing.active = false;
            incoming.setPosition(inHome.x, inHome.y - 209, inHome.z);
            incoming.active = true;
            this.animate(incoming, inHome, 0.08, () => {
                if (this.disposed || revision !== this.revision) return;
                this.current = target;
                this.busy = false;
            });
        });
    }

    /** 回放借用操作区时直接落位，避免菜单切换动画与免费面板争用。 */
    showImmediately(target: 1 | 2) {
        if (this.disposed) return;
        this.revision++;
        this.busy = false;
        this.current = target;
        [this.panel1, this.panel2].forEach((panel, index) => {
            const home = this.homes[index];
            panel.setPosition(home.x, home.y, home.z);
            panel.active = index === target - 1;
        });
    }

    dispose() {
        this.disposed = true;
    }
}

@ccclass('BottomPanels')
export class BottomPanels extends Component {
    @property(Node)
    panel1: Node = null;
    @property(Node)
    panel2: Node = null;
    private menuButton: Node = null;
    private closeButton: Node = null;
    private historyButton: Node = null;
    private ruleButton: Node = null;
    private paytableButton: Node = null;
    private transition: BottomPanelTransition = null;

    onLoad() {
        this.panel1 = this.panel1 || this.node.getChildByName('panel1');
        this.panel2 = this.panel2 || this.node.getChildByName('panel2');
        if (!this.panel1 || !this.panel2) throw new Error('底部切换需要 panel1 和 panel2');
        this.transition = new BottomPanelTransition(
            this.panel1,
            this.panel2,
            (panel, to, seconds, done) => {
                tween(panel as Node)
                    .to(seconds, { position: new Vec3(to.x, to.y, to.z) })
                    .call(done)
                    .start();
            },
        );
        this.menuButton = this.panel1.getChildByName('btn_menu');
        this.closeButton = this.panel2.getChildByName('btn_close');
        this.menuButton?.on(Node.EventType.TOUCH_END, this.openMenu, this);
        this.closeButton?.on(Node.EventType.TOUCH_END, this.closeMenu, this);
        this.historyButton = this.panel2.getChildByName('btn_history');
        this.historyButton?.on(Node.EventType.TOUCH_END, this.openHistory, this);
        this.ruleButton = this.panel2.getChildByName('btn_rule');
        this.ruleButton?.on(Node.EventType.TOUCH_END, this.openRules, this);
        this.paytableButton = this.panel2.getChildByName('btn_paytable');
        this.paytableButton?.on(Node.EventType.TOUCH_END, this.openPaytable, this);
        // 其他按钮不绑定原工程业务。
    }

    /** 返回恢复函数，供回放退出时还原进入前的菜单状态。 */
    beginReplay(): () => void {
        const previous = this.transition.selected;
        this.setImmediately(1);
        return () => this.setImmediately(previous);
    }

    private setImmediately(target: 1 | 2) {
        Tween.stopAllByTarget(this.panel1);
        Tween.stopAllByTarget(this.panel2);
        this.transition.showImmediately(target);
    }

    openMenu() {
        this.transition?.show(2);
    }

    private openHistory() {
        this.node.parent.emit('open-history');
    }

    private openPaytable() { this.node.parent.emit('open-paytable'); }

    private openRules() { this.node.parent.emit('open-rules'); }

    closeMenu() {
        this.transition?.show(1);
    }

    onDestroy() {
        this.transition?.dispose();
        this.paytableButton?.off(Node.EventType.TOUCH_END, this.openPaytable, this);
        this.ruleButton?.off(Node.EventType.TOUCH_END, this.openRules, this);
        this.historyButton?.off(Node.EventType.TOUCH_END, this.openHistory, this);
        this.menuButton?.off(Node.EventType.TOUCH_END, this.openMenu, this);
        this.closeButton?.off(Node.EventType.TOUCH_END, this.closeMenu, this);
        if (this.panel1) Tween.stopAllByTarget(this.panel1);
        if (this.panel2) Tween.stopAllByTarget(this.panel2);
    }
}
