/** 一次额度对应完整付费局，包含其所有消除和免费；停止只取消后续局。 */
export class AutoSpinRunner {
    remaining = 0;
    active = false;
    private generation = 0;
    constructor(
        private spin: () => Promise<boolean>,
        private pause: () => Promise<void>,
        private ready: () => boolean,
        private changed: () => void,
    ) {}
    start(count: number) {
        if (this.active || !this.ready() || !Number.isSafeInteger(count) || count < 1 || count > 1000) return false;
        this.active = true; this.remaining = count;
        const generation = ++this.generation;
        this.changed();
        void this.run(generation);
        return true;
    }
    stop() {
        ++this.generation;
        this.active = false; this.remaining = 0; this.changed();
    }
    private async run(generation: number) {
        try {
            while (this.active && generation === this.generation && this.ready()) {
                const completed = await this.spin();
                // 旧任务在等待当前局或局间间隔时被取消，不能再扣次数或覆盖新任务。
                if (generation !== this.generation || !this.active) return;
                if (!completed || !this.ready()) break;
                this.remaining = Math.max(0, this.remaining - 1);
                if (!this.remaining) break;
                this.changed();
                await this.pause();
            }
        } catch (error) {
            console.error('自动旋转已停止', error);
        } finally {
            if (generation === this.generation) this.stop();
        }
    }
}
