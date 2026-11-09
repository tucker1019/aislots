interface ReelState {
    state: number;
    delay_end_time: number;
}
/** 仅计算已停列的有效Scatter；顶部服务端预览牌不计数。 */
export function anticipationColumns(
    board: Array<Array<{ symbolId: number }>>,
    free: boolean,
    fast: boolean,
    previewRows = 1,
) {
    let count = 0;
    return board.map((col) => {
        const active = !free && !fast && count >= 2;
        count += col.slice(previewRows).filter((cell) => cell.symbolId === 11).length;
        return active;
    });
}
export class Anticipation {
    private enabled: boolean[] = [];
    private started = new Set<number>();
    private finished = new Set<number>();
    constructor(
        private reels: ReelState[],
        private show: (column: number, visible: boolean) => void,
    ) {}
    begin(enabled: boolean[]) {
        this.clear();
        this.enabled = enabled;
    }
    tick() {
        this.enabled.forEach((enabled, c) => {
            if (!enabled || this.finished.has(c)) return;
            const reel = this.reels[c];
            if (!this.started.has(c)) {
                if (c > 0 && this.reels[c - 1].state === 0) {
                    this.started.add(c);
                    reel.delay_end_time = 4;
                    this.show(c, true);
                } else reel.delay_end_time = Math.max(0.1, reel.delay_end_time);
            } else if (reel.state === 0) {
                this.finished.add(c);
                this.show(c, false);
            }
        });
    }
    clear() {
        this.enabled.forEach((enabled, c) => {
            if (enabled && !this.finished.has(c)) this.reels[c].delay_end_time = 0;
        });
        this.started.forEach((c) => this.show(c, false));
        this.enabled = [];
        this.started.clear();
        this.finished.clear();
    }
}
