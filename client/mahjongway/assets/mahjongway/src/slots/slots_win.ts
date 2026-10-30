import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

// 完整中奖演出的预留组件；当前基础消除由 slots_r.award 执行。
@ccclass('slots_win')
export class slots_win extends Component {
    start() {}

    update(deltaTime: number) {}
}
