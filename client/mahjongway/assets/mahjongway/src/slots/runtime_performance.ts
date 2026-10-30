import { director, Director, Node, Sprite } from 'cc';

/** 仅 ?perf=1 启用；按阶段采集原始帧间隔，不使用游戏逻辑截断后的 dt。 */
export class RuntimePerformance {
    private samples = new Map<string, Array<{ frame: number; cpu: number }>>();
    private started = 0;
    private phase = 'idle';
    private previous = 0;
    private lastPublish = 0;
    private output: HTMLElement;
    private frameStart = () => {
        this.started = performance.now();
    };
    private frameEnd = () => {
        const now = performance.now();
        if (document.visibilityState !== 'visible') {
            this.previous = 0;
            return;
        }
        if (this.previous) {
            const rows = this.samples.get(this.phase) || [];
            // 保留最多两万帧，避免诊断本身无限占用内存。
            if (rows.length < 20000)
                rows.push({ frame: now - this.previous, cpu: now - this.started });
            this.samples.set(this.phase, rows);
        }
        this.previous = now;
        if (now - this.lastPublish > 2000) {
            this.lastPublish = now;
            this.publish();
        }
    };

    constructor(private root: Node) {
        this.output = document.createElement('script');
        this.output.id = 'runtime-performance';
        this.output.setAttribute('type', 'application/json');
        document.body.appendChild(this.output);
        director.on(Director.EVENT_BEFORE_UPDATE, this.frameStart);
        director.on(Director.EVENT_AFTER_DRAW, this.frameEnd);
    }

    setPhase(phase: string) {
        this.phase = phase;
    }

    private publish() {
        const phases = {};
        for (const [phase, samples] of this.samples) {
            const frames = samples.map((s) => s.frame).sort((a, b) => a - b);
            const total = frames.reduce((a, b) => a + b, 0);
            const percentile = (p: number) =>
                frames[Math.min(frames.length - 1, Math.floor(frames.length * p))];
            phases[phase] = {
                frames: frames.length,
                seconds: total / 1000,
                fps: (1000 * frames.length) / total,
                frameP50: percentile(0.5),
                frameP95: percentile(0.95),
                frameMax: frames[frames.length - 1],
                over25ms: frames.filter((v) => v > 25).length,
                over50ms: frames.filter((v) => v > 50).length,
                cpuMean: samples.reduce((a, b) => a + b.cpu, 0) / samples.length,
                cpuMax: Math.max(...samples.map((s) => s.cpu)),
            };
        }
        let nodes = 0,
            activeNodes = 0,
            activeSprites = 0;
        const walk = (node: Node) => {
            nodes++;
            if (node.activeInHierarchy) {
                activeNodes++;
                const sprite = node.getComponent(Sprite);
                if (sprite?.enabled) activeSprites++;
            }
            node.children.forEach(walk);
        };
        walk(this.root);
        this.output.textContent = JSON.stringify({
            phases,
            nodes,
            activeNodes,
            activeSprites,
            visibility: document.visibilityState,
        });
    }

    destroy() {
        director.off(Director.EVENT_BEFORE_UPDATE, this.frameStart);
        director.off(Director.EVENT_AFTER_DRAW, this.frameEnd);
        this.output.remove();
    }
}
