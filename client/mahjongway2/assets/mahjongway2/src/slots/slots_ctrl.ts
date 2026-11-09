import { _decorator, Component, Node, Label } from 'cc';
import { slots_base } from './slots_base';
const { ccclass, property } = _decorator;

@ccclass('slots_ctrl')
export class slots_ctrl extends Component {
    slots: slots_base = null;

    @property(Node)
    btn_spin: Node = null;
    @property(Node)
    btn_stop: Node = null;
    private autoStop: Node = null;
    private autoCount: Label = null;

    onLoad() {
        this.slots = this.node.parent.getChildByName('roll').getComponent(slots_base);
        this.refresh();
        this.node.on('open-history', this.openHistory, this);
        this.node.on('open-paytable', this.openPaytable, this);
        this.node.on('open-rules', this.openRules, this);
        this.slots.node.on('flow-changed', this.refresh, this);
    }

    // 按总流程状态同步按钮，不能在点击停止后直接宣布本次投注结束。
    private refresh() {
        if (!this.autoStop) {
            const find = (node: Node, name: string): Node =>
                node.name === name ? node : node.children.map(child => find(child, name)).find(Boolean);
            this.autoStop = find(this.node.parent, 'btn_autostop');
            this.autoCount = this.autoStop?.getChildByName('lab_autoNum')?.getComponent(Label);
            this.autoStop?.on(Node.EventType.TOUCH_END, this.stopAutoSpin, this);
        }
        const busy = this.slots.state !== 0;
        const automatic = this.slots.autoSpinRunning;
        this.btn_spin.active = !automatic && !busy;
        this.btn_stop.active = !automatic && busy;
        if (this.autoStop) this.autoStop.active = automatic;
        if (this.autoCount) this.autoCount.string = String(this.slots.autoSpinsRemaining);
    }
    private stopAutoSpin() { this.slots.stopAutoSpin(); }
    onClickSpin() {
        void this.slots.spin();
        this.refresh();
    }
    onClickStop() {
        this.slots.stop();
        this.refresh();
    }
    private openPaytable() { this.slots.openPaytable(); }
    private openRules() { this.slots.openRules(); }

    private openHistory() {
        this.slots.openHistory();
    }

    // 加减按钮只从服务端提供的投注列表中选档。
    start() {
        const find = (node: Node, name: string): Node =>
            node.name === name ? node : node.children.map((n) => find(n, name)).find(Boolean);
        const canvas = this.node.parent;
        find(canvas, 'btn_add')?.on(Node.EventType.TOUCH_END, this.addBet, this);
        find(canvas, 'turbo')?.on(Node.EventType.TOUCH_END, this.toggleFast, this);
        find(canvas, 'btn_sub')?.on(Node.EventType.TOUCH_END, this.subBet, this);
        find(canvas, 'info_panel-001')?.on(Node.EventType.TOUCH_END, this.openBetOptions, this);
        find(canvas, 'txt_auto')?.on(Node.EventType.TOUCH_END, this.openAutoSpin, this);
    }
    private toggleFast() {
        // 原生按钮预制体由 GameEffects 同步表现，避免重新点亮旧美术。
        this.slots.setFastMode(!this.slots.fast);
    }
    private addBet() {
        this.slots.changeBet(1);
    }
    private subBet() {
        this.slots.changeBet(-1);
    }
    private openBetOptions() {
        this.slots.openBetOptions();
    }
    private openAutoSpin() {
        this.slots.openAutoSpin();
    }
    onDestroy() {
        this.autoStop?.off(Node.EventType.TOUCH_END, this.stopAutoSpin, this);
        this.node.off('open-history', this.openHistory, this);
        this.node.off('open-paytable', this.openPaytable, this);
        this.node.off('open-rules', this.openRules, this);
        this.slots?.node.off('flow-changed', this.refresh, this);
    }
}
