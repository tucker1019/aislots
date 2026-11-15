import { visibleGameBounds } from './game_overlay';

export class RetryBubble {
    private node?: HTMLDivElement;
    private timer?: number;
    private resize?: ResizeObserver;

    constructor(private canvas: HTMLCanvasElement) {}

    update(attempt: number, seconds: number) {
        this.destroy();
        if (!attempt) return;
        const node = this.node = document.createElement('div');
        node.setAttribute('role', 'status');
        node.style.cssText = 'position:fixed;z-index:16000;box-sizing:border-box;pointer-events:none;padding:.65em 0;text-align:center;border-radius:.65em;background:#292930eF;box-shadow:0 .3em 1em #0006;color:white;font:14px system-ui,sans-serif;white-space:nowrap;font-variant-numeric:tabular-nums';
        const text = document.createElement('span');
        node.append(text);
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            dot.textContent = '.';
            dot.style.display = 'inline-block';
            node.append(dot);
            if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
                dot.animate([{transform:'translateY(0)'}, {transform:'translateY(-.2em)', offset:.35}, {transform:'translateY(0)', offset:.7}], {
                    duration:900, delay:i*130, iterations:Infinity,
                });
        }
        document.body.append(node);
        this.resize = new ResizeObserver(this.position);
        this.resize.observe(this.canvas);
        window.addEventListener('resize', this.position);
        this.position();
        const end = Date.now() + seconds * 1000;
        const tick = () => {
            const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            text.textContent = left ? `第 ${attempt} 次重试：${left} 秒后重试` : `第 ${attempt} 次重试中`;
        };
        tick();
        this.timer = window.setInterval(tick, 250);
    }

    private position = () => {
        if (!this.node) return;
        const rect = visibleGameBounds(this.canvas);
        this.node.style.left = `${rect.left + rect.width * .1}px`;
        this.node.style.width = `${rect.width * .8}px`;
        this.node.style.top = `${rect.top + rect.height - rect.height * .032}px`;
        this.node.style.transform = 'translateY(-100%)';
    };

    destroy() {
        window.clearInterval(this.timer);
        this.resize?.disconnect();
        window.removeEventListener('resize', this.position);
        this.node?.remove();
        this.node = undefined;
    }
}
