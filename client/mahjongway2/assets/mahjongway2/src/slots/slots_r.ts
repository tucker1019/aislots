import { COLUMN_HEIGHTS } from './server_board';
import { sortAwardLayer } from '../effects/award_layer';
import { _decorator, Component, Node } from 'cc';
import { slots_base } from './slots_base';
import { slots_cell } from './slots_cell';
import { createSpinCellPicker, SpinCellPicker } from './slot_widget';
const { ccclass, property } = _decorator;

export const CELL_HEIGHT = 138;
const BOUNCE_OVERSHOOT = 5;
const BOUNCE_DOWN_DURATION = 0.08;
const BOUNCE_UP_DURATION = 0.05;
const UP_LIFT_DURATION = 0.15;
// 补落采用匀加速：同列共用速度，起步较慢，随后加速。
const DROP_INITIAL_SPEED = 600;
const DROP_ACCELERATION = 9000;

@ccclass('slots_r')
export class slots_r extends Component {
    index: number = 0;
    speed: number = 3500;
    up_speed: number = 500;
    up_time: number = UP_LIFT_DURATION;
    slots: slots_base = null;
    offset: number = 0;
    delay_start_time: number = 0;
    delay_end_time: number = 0;
    state: number = 0; // 0 idle 1 lift 2 spin 3 settle 4 bounce
    private pickSpinCell: SpinCellPicker = null;
    private bounceElapsed: number = 0;
    private bounceGoingUp: boolean = true;
    private cellNodes: Node[] = [];
    private initialY: number[] = [];
    private get cellCount() { return this.cellNodes.length; }
    private get wrapY() { return this.initialY[this.cellCount - 1] - CELL_HEIGHT; }
    private get wrapOffset() { return CELL_HEIGHT * this.cellCount; }
    private cellComponents: slots_cell[] = [];
    private result: number[] = [];
    private landed: boolean[] = [];
    private stopInitY: number[] = [];
    private settleAnchor: number = -1;
    private stopPending: boolean = false;
    private stopDelayDone: boolean = false;
    private scrollSpeed: number = 0;
    private rolledSeconds = 0;
    private decelActive: boolean = false;
    private decelRemainingDist: number = 0;
    private decelAccel: number = 0;
    private zOrderScratch: number[] = [];

    protected onLoad(): void {
        this.slots = this.node.parent.getComponent(slots_base);
    }
    start() {
        this.resetDelays();
    }

    private resetDelays() {
        // Turbo mode starts and stops every reel together.
        this.delay_start_time = this.slots?.fast ? 0 : this.index * 0.08;
        this.delay_end_time = this.slots?.fast ? 0 : this.index * 0.06;
    }

    // 保存固定逻辑索引；后续 setSiblingIndex 只改绘制层级，不改变逻辑编号。
    bindPicker() {
        this.pickSpinCell = createSpinCellPicker(this.index, () => this.slots.isFreeSpin);
        const children = this.node.children;
        const len = children.length;
        this.cellNodes = new Array(len);
        this.cellComponents = new Array(len);
        for (let i = 0; i < len; i++) {
            const cell = children[i];
            this.cellNodes[i] = cell;
            this.cellComponents[i] = cell.getComponent(slots_cell);
        }
        this.initialY = this.cellNodes.map(cell => cell.position.y);
        this.refreshCellZOrder();
    }

    /** y 越高画越后（压低），y 越低画越前；只改 sibling，逻辑仍用 cellNodes[i] */
    private refreshCellZOrder() {
        const cellNodes = this.cellNodes;
        const n = cellNodes.length;
        if (n === 0) {
            return;
        }
        if (this.zOrderScratch.length !== n) {
            this.zOrderScratch = new Array(n);
        }
        const order = this.zOrderScratch;
        for (let i = 0; i < n; i++) {
            order[i] = i;
        }
        order.sort((a, b) => cellNodes[b].position.y - cellNodes[a].position.y);
        for (let siblingIdx = 0; siblingIdx < n; siblingIdx++) {
            cellNodes[order[siblingIdx]].setSiblingIndex(siblingIdx);
        }
    }

    startRoll() {
        this.rolledSeconds = 0;
        this.pickSpinCell.refill();
        this.resetDelays();
        this.up_time = UP_LIFT_DURATION;
        this.stopPending = false;
        this.stopDelayDone = false;
        this.stopInitY = [];
        this.settleAnchor = -1;
        this.resetScrollSpeed();
        this.state = 1;
    }

    stopRoll(result: number[]) {
        this.result = result;
        this.landed = new Array(this.cellNodes.length).fill(false);
        this.stopInitY = [];
        this.settleAnchor = -1;
        // 普通模式保留逐列停轴层次，但缩短等待，避免整局转轴拖得过久。
        this.delay_end_time = this.slots?.fast ? 0.3 : 0.8 + this.index * 0.12;
        this.stopPending = true;
        this.stopDelayDone = false;
        this.resetScrollSpeed();
    }

    /** 重连快照直接落位，不经过起转、停轴或落地动画。 */
    cancelPresentation() {
        this.cellComponents.forEach(cell => cell.cancelAward());
        this.state = 0;
    }

    showBoard(result: number[]) {
        this.result = result;
        this.stop();
    }

    /** 只报告当前列是否已滚满0.1秒，由总流程按最后一列统一停轴。 */
    get canManualStop(): boolean {
        return this.state !== 1 && this.state !== 5 && this.rolledSeconds >= 0.1 - 1e-8;
    }

    /** 直接落位供恢复、异常处理和满足最短滚动时间后的停止使用。 */
    stop() {
        const wasRolling = this.state !== 0 && this.state !== 5;
        this.dropDelay = 0;
        const board = this.result.length ? this.result : this.slots.boards[this.index];
        this.stopPending = false;
        this.stopDelayDone = false;
        this.stopInitY = [];
        this.settleAnchor = -1;
        this.resetScrollSpeed();
        this.bounceElapsed = 0;
        const cellNodes = this.cellNodes;
        const cellComponents = this.cellComponents;
        for (let i = 0; i < cellNodes.length; i++) {
            cellNodes[i].setPosition(0, this.initialY[i]);
            if (board && board[i] !== undefined) {
                cellComponents[i].setBlur(false);
                cellComponents[i].setCellValue(board[i]);
            }
        }
        this.refreshCellZOrder();
        this.state = 0;
        if (wasRolling) this.slots.reelStopped?.(true);
    }
    private resetScrollSpeed() {
        this.scrollSpeed = this.speed;
        this.decelActive = false;
        this.decelRemainingDist = 0;
        this.decelAccel = 0;
    }

    // 同列统一加速，距离较远的牌自然更晚落地。
    private drops: number[] = [];
    private targets: number[] = [];
    private dropBounces: number[] = [];
    private dropDelay = 0;
    private dropVelocity = DROP_INITIAL_SPEED;
    private dropLandingPending: boolean[] = [];
    /** 在原节点上设置新图标和起点；只有有效牌和预览牌参与下落。 */
    dropTo(result: number[], sources: number[], newActiveCells?: boolean[], delay = 0) {
        // 按稳定ID判定新牌，原有胡移动时不重复触发落地闪光。
        this.dropLandingPending = result.map(
            (_, i) => i >= 2 && i < COLUMN_HEIGHTS[this.index] + 2 && (newActiveCells?.[i - 1] ?? sources[i - 1] <= 0),
        );
        this.result = result;
        this.stop();
        this.dropDelay = Math.max(0, delay);
        this.dropVelocity = DROP_INITIAL_SPEED;
        this.targets = this.initialY.slice();
        this.drops = result.map((value, i) =>
            i > 0 && i < COLUMN_HEIGHTS[this.index] + 2 && value ? Math.max(0, i - 1 - sources[i - 1]) * CELL_HEIGHT : 0,
        );
        this.dropBounces = this.drops.map(() => -1);
        this.cellNodes.forEach((n, i) => n.setPosition(0, this.targets[i] + this.drops[i]));
        this.state = this.drops.some((v) => v > 0) ? 5 : 0;
    }
    private playDropLandingEffect(index: number) {
        if (!this.dropLandingPending[index]) return;
        this.dropLandingPending[index] = false;
        this.cellComponents[index].playScatterStop();
    }

    /** 手动停止补落时只触发新牌，且每张只播放一次。 */
    playDropLandingEffects() {
        this.cellComponents.forEach((_, i) => this.playDropLandingEffect(i));
    }

    /** 根据稳定行号触发原生特效，不更改cell的逻辑索引。 */
    award(rows: number[], transformed: number[], effectLayer?: Node) {
        this.cellNodes.forEach((_, i) => {
            const rank = this.settleAnchor < 0 ? i : this.getResultRank(i),
                row = rank - 1;
            if (rows.includes(row))
                this.cellComponents[i].playWin(transformed.includes(row), effectLayer);
        });
        // 逻辑索引会循环，旧锚点的 sibling 顺序也会保留，不能据此决定谁盖住谁。
        if (effectLayer) sortAwardLayer(effectLayer);
    }
    activeRowForCell(node: Node) {
        const index = this.cellNodes.indexOf(node);
        if (index < 0) return -1;
        const rank = this.settleAnchor < 0 ? index : this.getResultRank(index);
        return rank >= 2 && rank < COLUMN_HEIGHTS[this.index] + 2 ? rank - 2 : -1;
    }
    restoreWinLayers() {
        this.cellComponents.forEach((cell) => cell.restoreWinLayer());
    }

    get isAwardPlaying() {
        return this.cellComponents.some((cell) => cell.isAwardPlaying);
    }
    refreshEffects() {
        this.cellComponents.forEach((cell) => cell.refreshEffect());
    }
    playLandingEffects() {
        this.cellComponents.forEach((cell, i) => {
            const rank = this.settleAnchor < 0 ? i : this.getResultRank(i);
            if (rank >= 2 && rank < COLUMN_HEIGHTS[this.index] + 2) cell.playScatterStop();
        });
    }
    tick(dt: number, realDt = dt): void {
        if (this.state === 5) {
            // 列间等待结束才开始加速，按真实位移积分避免帧率影响加速曲线。
            const waiting = Math.min(dt, this.dropDelay);
            this.dropDelay -= waiting;
            dt -= waiting;
            if (dt <= 0) return;
            const velocity = this.dropVelocity;
            const move = velocity * dt + 0.5 * DROP_ACCELERATION * dt * dt;
            this.dropVelocity += DROP_ACCELERATION * dt;
            this.cellNodes.forEach((node, i) => {
                const distance = this.drops[i];
                if (distance > 0) {
                    this.drops[i] = Math.max(0, distance - move);
                    if (this.drops[i] === 0) {
                        // 精确计算本帧落地时刻，剩余时间用于回弹。
                        const landingTime = (2 * distance) /
                            (Math.sqrt(velocity * velocity + 2 * DROP_ACCELERATION * distance) + velocity);
                        this.dropBounces[i] = Math.max(0, dt - landingTime);
                    }
                } else if (this.dropBounces[i] >= 0) this.dropBounces[i] += dt;
                const t = this.dropBounces[i];
                let bounce = 0;
                if (t >= 0) {
                    if (t >= 0.08) {
                        this.dropBounces[i] = -1;
                        this.playDropLandingEffect(i);
                    } else bounce = t < 0.03 ? (20 * t) / 0.03 : 20 * (1 - (t - 0.03) / 0.05);
                }
                node.setPosition(0, this.targets[i] + this.drops[i] + bounce);
            });
            if (this.drops.every((v) => v === 0) && this.dropBounces.every((t) => t < 0))
                this.state = 0;
            return;
        }

        if (this.state === 1) {
            this.tickLift(dt);
            return;
        }
        if (this.state === 4) {
            this.tickBounce(dt);
            return;
        }
        if (this.state === 2 || this.state === 3) {
            const settling = this.state === 3;
            const wrapInfo = this.tickScroll(dt, settling);
            this.rolledSeconds += realDt;


            if (this.state === 2 && this.stopPending) {
                if (!this.stopDelayDone) {
                    this.delay_end_time -= dt;
                    if (this.delay_end_time <= 0) {
                        this.stopDelayDone = true;
                    }
                } else if (wrapInfo.any) {
                    this.beginSettle(wrapInfo.anchor);
                }
            } else if (settling) {
                // 减速距离耗尽时补齐最后一格，避免积分误差让末格停在回卷边界前。
                if (this.decelActive && this.decelRemainingDist <= 0) {
                    this.cellComponents.forEach((cell, index) => {
                        if (this.landed[index]) return;
                        cell.setBlur(false);
                        cell.setCellValue(this.result[this.getResultRank(index)]);
                        this.landed[index] = true;
                    });
                }
                if (this.isAllLanded()) this.startBounce();
            }
            return;
        }
    }

    /** 从条带末尾依次停牌，支持每列不同的条带长度。 */
    private beginSettle(triggerIndex: number) {
        this.settleAnchor = triggerIndex;
        this.computeStopInitY(triggerIndex);
        this.stopPending = false;
        this.stopDelayDone = false;
        this.landed.fill(false);
        this.landed[triggerIndex] = true;
        const rank = this.getResultRank(triggerIndex);
        this.cellComponents[triggerIndex].setBlur(false);
        this.cellComponents[triggerIndex].setCellValue(this.result[rank]);
        this.resetScrollSpeed();
        this.refreshDecel();
        this.state = 3;
    }

    /**
     * trigger 第一个到底 → 转满一圈后停最下；
     * 后续节点依次到底，按本列节点总数计算最终位置。
     * 例 trigger=2：node3(顶)…node2(底)
     */
    private computeStopInitY(triggerIndex: number) {
        this.stopInitY = new Array(this.cellCount);
        for (let k = 0; k < this.cellCount; k++) {
            const nodeIndex = (triggerIndex - k + this.cellCount) % this.cellCount;
            this.stopInitY[nodeIndex] = this.initialY[0] - CELL_HEIGHT * (this.cellCount - 1 - k);
        }
    }

    /** 根据停轴锚点计算当前节点在本列结果中的索引。 */
    private getResultRank(nodeIndex: number): number {
        const landOrder = (this.settleAnchor - nodeIndex + this.cellCount) % this.cellCount;
        return this.cellCount - 1 - landOrder;
    }

    private getTargetY(index: number): number {
        return this.stopInitY.length > 0 ? this.stopInitY[index] : this.initialY[index];
    }

    private tickLift(dt: number): void {
        this.delay_start_time -= dt;
        if (this.delay_start_time > 0) {
            return;
        }
        const move = this.up_speed * dt;
        const cellNodes = this.cellNodes;
        for (let i = 0; i < cellNodes.length; i++) {
            const cell = cellNodes[i];
            cell.setPosition(0, cell.position.y + move);
        }
        this.up_time -= dt;
        if (this.up_time <= 0) {
            // 各列独立结束上抬后，才切换本列的模糊图。
            this.cellComponents.forEach((cell) => cell.setBlur(true));
            this.state = 2;
        }
    }

    private tickScroll(dt: number, settling: boolean): { any: boolean; anchor: number } {
        const move = this.consumeScrollMove(dt, settling);
        const cellNodes = this.cellNodes;
        const cellComponents = this.cellComponents;
        let anyWrapped = false;
        let anchorIndex = -1;
        for (let i = 0; i < cellNodes.length; i++) {
            const cell = cellNodes[i];
            let y = cell.position.y - move;
            if (y <= this.wrapY) {
                y += this.wrapOffset;
                if (!anyWrapped) {
                    anyWrapped = true;
                    anchorIndex = i;
                }
                if (settling && !this.landed[i]) {
                    const rank = this.getResultRank(i);
                    cellComponents[i].setBlur(false);
                    cellComponents[i].setCellValue(this.result[rank]);
                    this.landed[i] = true;
                    this.refreshDecel();
                } else if (!settling && !(this.stopPending && this.stopDelayDone)) {
                    cellComponents[i].setBlur(true);
                    cellComponents[i].setCellValue(this.pickSpinCell());
                }
            }
            cell.setPosition(0, y);
        }
        if (anyWrapped) {
            this.refreshCellZOrder();
        }

        return { any: anyWrapped, anchor: anchorIndex };
    }

    private consumeScrollMove(dt: number, settling: boolean): number {
        if (!settling || !this.decelActive) {
            return this.speed * dt;
        }
        const move = this.scrollSpeed * dt;
        this.decelRemainingDist = Math.max(0, this.decelRemainingDist - move);
        this.scrollSpeed = Math.sqrt(Math.max(0, 2 * this.decelAccel * this.decelRemainingDist));
        return move;
    }

    private refreshDecel() {
        const remaining = this.cellCount - this.getLandedCount();
        if (remaining <= 0) {
            this.scrollSpeed = 0;
            this.decelActive = false;
            return;
        }
        this.decelRemainingDist = remaining * CELL_HEIGHT;
        if (!this.decelActive) {
            this.scrollSpeed = this.speed;
            this.decelActive = true;
        }
        this.decelAccel = (this.scrollSpeed * this.scrollSpeed) / (2 * this.decelRemainingDist);
    }

    private getLandedCount(): number {
        let count = 0;
        for (let i = 0; i < this.landed.length; i++) {
            if (this.landed[i]) {
                count++;
            }
        }
        return count;
    }

    private isAllLanded(): boolean {
        return this.getLandedCount() >= this.cellCount;
    }

    private startBounce() {
        this.correctToInitY();
        this.bounceElapsed = 0;
        this.bounceGoingUp = true;
        this.state = 4;
    }

    private tickBounce(dt: number) {
        this.bounceElapsed += dt;
        const cellNodes = this.cellNodes;
        const duration = this.bounceGoingUp ? BOUNCE_UP_DURATION : BOUNCE_DOWN_DURATION;
        const t = Math.min(this.bounceElapsed / duration, 1);
        if (this.bounceGoingUp) {
            const offset = BOUNCE_OVERSHOOT * t;
            for (let i = 0; i < cellNodes.length; i++) {
                cellNodes[i].setPosition(0, this.getTargetY(i) + offset);
            }
            if (t >= 1) {
                this.bounceGoingUp = false;
                this.bounceElapsed = 0;
            }
            return;
        }

        const offset = BOUNCE_OVERSHOOT * (1 - t);
        for (let i = 0; i < cellNodes.length; i++) {
            cellNodes[i].setPosition(0, this.getTargetY(i) + offset);
        }
        if (t >= 1) {
            this.correctToInitY();
            this.state = 0;
            this.slots.reelStopped?.(false);
        }
    }

    private correctToInitY() {
        const cellNodes = this.cellNodes;
        for (let i = 0; i < cellNodes.length; i++) {
            cellNodes[i].setPosition(0, this.getTargetY(i));
        }
        this.refreshCellZOrder();
    }
}
