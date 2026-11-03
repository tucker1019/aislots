import { fitGameOverlay } from './game_overlay';
export class AutoSpinPage {
    private root: HTMLDivElement = null;
    private selected = 10;
    constructor(
        private canvas: HTMLCanvasElement,
        private start: (count: number) => void,
        private info: () => { balance: string; bet: string },
    ) {}

    open() {
        if (this.root) return;
        const root = this.root = document.createElement('div');
        root.className = 'auto-spin-overlay';
        const info = this.info();
        root.innerHTML = `<div class="auto-spin-dim"></div><section class="auto-spin-panel" role="dialog" aria-modal="true" aria-label="自动旋转"><header><h2>自动旋转</h2><button class="auto-spin-close" aria-label="关闭">×</button></header><div class="auto-spin-content"><div class="auto-spin-caption">选择自动旋转次数</div><div class="auto-spin-counts"></div></div><footer><button class="auto-spin-start">开始</button></footer><div class="auto-spin-footer"><span>钱包余额</span><b>${info.balance}</b><span>投注额</span><b>${info.bet}</b></div></section>`;

        const counts = root.querySelector('.auto-spin-counts');
        for (const count of [10, 30, 50, 80, 1000]) {
            const button = document.createElement('button');
            button.textContent = String(count);
            button.className = 'auto-spin-count' + (count === this.selected ? ' active' : '');
            button.onclick = () => {
                this.selected = count;
                counts.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
            };
            counts.append(button);
        }
        root.querySelector('.auto-spin-close').addEventListener('click', () => this.close());
        root.querySelector('.auto-spin-dim').addEventListener('click', () => this.close());
        root.querySelector('.auto-spin-start').addEventListener('click', () => {
            const count = this.selected;
            this.close();
            this.start(count);
        });
        if (!document.getElementById('auto-spin-style')) {
            const style = document.createElement('style');
            style.id = 'auto-spin-style';
            style.textContent = `.auto-spin-overlay{position:fixed;z-index:13000;overflow:hidden;font-family:Nunito,Arial,sans-serif;color:#f5f4f7}.auto-spin-dim{position:absolute;inset:0;background:rgba(0,0,0,.28)}.auto-spin-panel{position:absolute;bottom:0;left:0;right:0;background:#30303c;border-radius:1.1em 1.1em 0 0;padding-bottom:.75em;transform:translate3d(0,100%,0);transition:transform .4s cubic-bezier(.25,.1,.25,1)}.auto-spin-overlay.visible .auto-spin-panel{transform:translate3d(0,0,0)}.auto-spin-panel header{height:3.5em;display:flex;align-items:center;justify-content:center;position:relative}.auto-spin-panel h2{font-size:1em;font-weight:400;margin:.3em 0 0}.auto-spin-close{position:absolute;right:1em;top:.65em;width:1.9em;height:1.9em;border:0;border-radius:50%;background:#50505d;color:#fff;font-size:1.35em;line-height:1}.auto-spin-content{background:#282833;padding:1.1em 1.35em 1.35em}.auto-spin-caption{font-size:.82em;color:rgba(255,255,255,.58);padding:.1em 0 1em}.auto-spin-counts{display:flex;justify-content:space-between;gap:.45em}.auto-spin-count{width:19%;height:2.25em;border:1px solid #262633;border-radius:2em;background:#30303d;color:rgba(255,255,255,.42);font:inherit;font-size:.8em}.auto-spin-count.active{background:rgba(180,120,80,.2);color:#b47850}.auto-spin-panel footer{display:flex;justify-content:center;padding:1.25em 0 1.05em}.auto-spin-start{width:67%;height:2.25em;border:0;border-radius:2em;background:#b47850;color:rgba(255,255,255,.88);font:inherit;font-size:.82em}.auto-spin-footer{display:flex;justify-content:space-between;align-items:center;margin:0 .7em;background:rgba(0,0,0,.32);font-size:.78em;color:#aaa;padding:.55em .85em;border-radius:1em}.auto-spin-footer b{color:#b47850;font-weight:400}`;
            document.head.append(style);
        }
        document.body.append(root);
        fitGameOverlay(root, this.canvas);
        root.getBoundingClientRect();
        requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('visible')));
    }

    close() {
        if (!this.root) return;
        const root = this.root;
        this.root = null;
        root.classList.remove('visible');
        window.setTimeout(() => root.remove(), 420);
    }
}
