import { HistoryReplay } from './history_types';
import { activeColumns, INDICES } from '../network/frame_adapter';
import { replayShareButton } from './replay_share';
/** Read-only playback has no reference to the wager API, session token or live round controller. */
export class Ag3Replay {
    private root = document.createElement('section');
    private index = 0;
    private timer: ReturnType<typeof setTimeout>;
    private playing = false;
    private body = document.createElement('div');
    private status = document.createElement('div');
    private play: HTMLButtonElement;
    private key = (event: KeyboardEvent) => { if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
    } };
    constructor(private data: HistoryReplay, private onClose: () => void, share?: () => Promise<string>, private image?: (symbol: number) => string) {
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-label', 'AG3 replay');
        this.root.setAttribute('aria-modal', 'true');
        this.root.style.cssText = 'position:fixed;inset:0;z-index:14000;background:#171419ed;color:#fff;display:flex;align-items:center;justify-content:center;padding:12px;font:16px sans-serif';
        const panel = document.createElement('div');
        panel.style.cssText = 'width:min(500px,100%);max-height:100%;overflow:auto;background:#38271f;border:1px solid #9d774e;border-radius:16px;padding:18px;box-sizing:border-box';
        const title = document.createElement('h3');
        title.textContent = 'AG3 · ' + data.bet.betId;
        title.style.overflowWrap = 'anywhere';
        panel.append(title, this.status, this.body);
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:18px';
        const button = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'flex:1;min-width:65px;height:40px;border:1px solid #ad804f;border-radius:20px;background:#9e683d;color:white;cursor:pointer'; b.onclick = fn; controls.append(b); return b; };
        button('Previous', () => this.show(this.index - 1));
        this.play = button('Play', () => { this.playing = !this.playing; this.tick(); });
        button('Next', () => this.show(this.index + 1));
        if (share) {
            const b = replayShareButton(share, () => this.root);
            b.style.cssText = 'width:70px;height:40px';
            controls.append(b);
        }
        button('Close', () => this.close());
        panel.append(controls);
        this.root.append(panel);
        document.body.append(this.root);
        document.addEventListener('keydown', this.key, true);
        this.show(0);
    }
    private show(index: number) {
        this.index = Math.max(0, Math.min(this.data.frames.length - 1, index));
        const frame = this.data.frames[this.index];
        this.status.textContent = `${frame.mode === 'free' ? 'Free' : 'Base'} · ${this.index + 1}/${this.data.frames.length} · Win ${(Number(frame.winAmount) / 100).toFixed(2)}`;
        this.body.replaceChildren();
        this.body.style.cssText = 'display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;align-items:center;margin-top:16px';
        const wins = new Set(frame.wins.flatMap(w => w.cellIds));
        const labels = ['', '🤠', '🔫', '🎩', '🥃', 'A', 'K', 'Q', 'J', 'WILD', 'SCATTER'];
        activeColumns({ ...frame, requestId: '', nextRequestId: '' }).forEach((symbols, c) => { const column = document.createElement('div'); column.style.cssText = 'display:flex;flex-direction:column;gap:4px'; symbols.slice().reverse().forEach((symbol, r) => { const cell = document.createElement('div'); const source = this.image?.(symbol); if (source) {
            const img = document.createElement('img');
            img.src = source;
            img.alt = labels[symbol % 1000] || String(symbol);
            img.style.cssText = 'width:100%;height:100%;object-fit:contain';
            cell.append(img);
        }
        else
            cell.textContent = labels[symbol % 1000] || String(symbol); const actual = frame.board[c][r + (frame.previewRows || 0)]; cell.style.cssText = `height:48px;display:grid;place-items:center;border:2px solid ${wins.has(actual.id) ? '#ffdb5c' : symbol >= 1000 ? '#b98c33' : '#795445'};border-radius:7px;background:${wins.has(actual.id) ? '#765321' : '#493125'};font-weight:bold;font-size:${symbol % 1000 >= 9 ? '9' : '19'}px`; column.append(cell); }); this.body.append(column); });
    }
    private tick() { clearTimeout(this.timer); this.play.textContent = this.playing ? 'Pause' : 'Play'; if (!this.playing)
        return; if (this.index === this.data.frames.length - 1)
        this.show(0); this.timer = setTimeout(() => { this.show(this.index + 1); if (this.index === this.data.frames.length - 1)
        this.playing = false; this.tick(); }, 1000); }
    close() { clearTimeout(this.timer); document.removeEventListener('keydown', this.key, true); this.root.remove(); this.onClose(); }
}
