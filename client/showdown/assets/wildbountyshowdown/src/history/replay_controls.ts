import { button, el, placeOverlay, trapTab } from './history_dom';
import { replayShareButton } from './replay_share';
import { gameBounds } from './history_model';

/** 顶栏提供回放控制，其余区域透传给棋盘、Stop 和原生弹窗。 */
export class ReplayControls {
    private root = el('div');
    private status = el('div');
    private again = button('重新播放', () => this.restart?.());
    private observer: ResizeObserver;
    private previousPointer: string;
    private resize = () => placeOverlay(this.root, gameBounds(this.canvas.getBoundingClientRect(),750,1334));
    private keydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.exit(); }
        if (event.key === 'Tab') trapTab(this.root, event);
    };
    constructor(private canvas: HTMLCanvasElement, betId: string, private exit: () => void,
        options: { share?: () => Promise<string>; exitLabel?: string } = {}, private restart?: () => void) {
        this.previousPointer = canvas.style.pointerEvents;
        canvas.style.pointerEvents = 'auto';
        this.root.className = 'game-replay-controls';
        this.root.style.cssText = 'position:fixed;z-index:13000;pointer-events:none;font-family:Arial,sans-serif;color:#fff;';
        for (const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchmove','touchend','click'])
            this.root.addEventListener(type, event => event.stopPropagation());
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-label', '游戏回放');
        this.root.setAttribute('aria-modal', 'true');
        const bar = el('div');
        bar.style.cssText = 'pointer-events:auto;display:flex;align-items:center;gap:.7em;background:rgba(30,29,39,.94);padding:.7em;';
        const text = el('div'); text.style.cssText = 'flex:1;min-width:0;overflow-wrap:anywhere;font-size:.8em;';
        text.append(el('div', '', '回放 · ' + betId), this.status);
        this.status.setAttribute('role','status');
        const close = button(options.exitLabel || '退出回放', exit);
        close.style.cssText = 'flex:none;border:1px solid #bb7c4b;border-radius:1.5em;background:#30303e;color:#e4c29d;padding:.6em .8em;font:inherit;font-size:.8em;cursor:pointer;';
        if (options.share) {
            const share = replayShareButton(options.share, () => this.root);
            share.setAttribute('aria-label', '分享回放');
            share.style.cssText = close.style.cssText + 'box-sizing:border-box;width:4.6em;min-width:4.6em;max-width:4.6em;flex:0 0 4.6em;white-space:nowrap;padding:.6em .3em;';
            bar.append(share);
        }
        this.again.style.cssText = close.style.cssText; this.again.hidden = true; bar.append(this.again,text,close);this.root.append(bar);document.body.append(this.root);
        this.resize(); close.focus();
        window.addEventListener('resize',this.resize);
        document.addEventListener('keydown',this.keydown,true);
        if (typeof ResizeObserver !== 'undefined') {
            this.observer = new ResizeObserver(this.resize);this.observer.observe(canvas);
        }
    }
    progress(index: number, count: number, free: boolean) {
        this.again.hidden = true;
        this.status.textContent = `${free ? '免费旋转' : '普通旋转'} · 第 ${index + 1}/${count} 轮`;
    }
    done(message = '回放结束') { this.status.textContent = message; this.again.hidden = !this.restart; }
    destroy() {
        this.root.remove();this.observer?.disconnect();
        window.removeEventListener('resize',this.resize);
        document.removeEventListener('keydown',this.keydown,true);
        this.canvas.style.pointerEvents = this.previousPointer;
    }
}
