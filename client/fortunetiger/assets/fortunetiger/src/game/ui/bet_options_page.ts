import { fitGameOverlay } from './game_overlay';
import { showMoney } from '../common/FTUtils';
import { totalBet, type BetChoice } from './bet_choices';
const formatMoney = (value: string) => showMoney(Number(value));
interface BetInfo { choices: BetChoice[]; bet: string; level: number; lines: number; balance: string }
/** AG1/AG2 HTML wheel layout; AG3 contributes only configuration and confirmation. */
export class BetOptionsPage {
    private betOptionsOverlay: HTMLDivElement = null;
    private cleanupKey: (() => void) | null = null;
    private betChoices: BetChoice[] = [];
    private bet = ''; private betLevel = 1; private lineCount = 20; private balance = ''; private betAmount = '';
    constructor(private canvas: HTMLCanvasElement, private info: () => BetInfo, private confirm: (bet: string, level: number) => void, private sound: () => void) {}
    destroy() { this.betOptionsOverlay?.remove(); this.betOptionsOverlay = null; this.cleanupKey?.(); this.cleanupKey = null; }
    private totalBet(bet: string, level: number) { return totalBet(bet, level, this.lineCount); }
    open() {
        this.destroy();
        const info = this.info();
        this.betChoices = info.choices; this.bet = info.bet; this.betLevel = info.level; this.lineCount = info.lines; this.balance = info.balance; this.betAmount = this.totalBet(this.bet, this.betLevel);
        const canvas = this.canvas;
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const bounds = canvas.getBoundingClientRect();
        const root = document.createElement('div');
        root.className = 'aislot-bet-options';
        root.addEventListener('click', event => { if ((event.target as Element).closest('button')) this.sound(); });
        root.innerHTML = `<div class="bet-options-panel" role="dialog" aria-modal="true" aria-label="投注选项"><div class="bet-options-header"><h2>投注选项</h2><button class="bet-options-close" aria-label="关闭">×</button></div><div class="bet-options-content"><div class="bet-options-head"><span>投注额</span><i>×</i><span>投注级别</span><i>×</i><span>线路</span><i>=</i><strong>投注总额</strong></div><div class="bet-selector-bg"></div><div class="bet-wheel"><div class="bet-wheel-column bet-wheel-bet"></div><i>×</i><div class="bet-wheel-column bet-wheel-level"></div><i>×</i><div class="bet-wheel-column bet-wheel-lines"><span>${this.lineCount}</span></div><i>=</i><strong class="bet-wheel-total"></strong></div><div class="bet-gradient top"></div><div class="bet-gradient bottom"></div></div><div class="bet-options-actions"><button class="bet-max">最大投注</button><button class="bet-confirm">确认</button></div><div class="bet-options-footer"><span>钱包余额</span><b>${formatMoney(this.balance)}</b><span>投注额</span><b class="bet-footer-amount">${formatMoney(this.betAmount)}</b></div></div>`;
        const panel = root.firstElementChild as HTMLDivElement;
        const choices = this.betChoices.length ? this.betChoices : [{ bet: this.bet, level: this.betLevel, display: this.betAmount }];
        const values = Array.from(new Set(choices.map(item => item.bet)));
        const levels = Array.from(new Set(choices.map(item => item.level)));
        const totals = Array.from(new Set(choices.map(item => item.display))).sort((a,b)=>BigInt(a)<BigInt(b)?-1:BigInt(a)>BigInt(b)?1:0);
        let selectedBet = this.bet, selectedLevel = this.betLevel;
        const render = () => {
            const fill = (selector: string, items: Array<string | number>, selected: string | number, pick: (v: string) => void, format: (v: string) => string) => {
                const column = panel.querySelector(selector) as HTMLElement;
                column.replaceChildren();
                items.forEach(value => { const row = document.createElement('button'); row.textContent = format(String(value)); row.className = String(value) === String(selected) ? 'active' : ''; row.onclick = () => { pick(String(value)); render(); }; column.append(row); });
                const active = column.querySelector('.active') as HTMLElement;
                if (active) requestAnimationFrame(() => {
                    column.dataset.syncing = '1';
                    column.scrollTop = active.offsetTop - (column.clientHeight - active.offsetHeight) / 2;
                    requestAnimationFrame(() => delete column.dataset.syncing);
                });
                column.onscroll = () => {
                    if (column.dataset.syncing) return;
                    const center = column.scrollTop + column.clientHeight / 2;
                    const index = Math.max(0, Math.min(items.length - 1, Math.round((center - 64 - 16) / 32)));
                    const value = String(items[index]);
                    if (value !== String(selected)) { pick(value); render(); }
                };
            };
            const updateTotal = () => {
                (panel.querySelector('.bet-footer-amount') as HTMLElement).textContent = formatMoney(this.totalBet(selectedBet, selectedLevel));
            };
            fill('.bet-wheel-bet', values, selectedBet, value => selectedBet = value, value => formatMoney(value));
            fill('.bet-wheel-level', levels, selectedLevel, value => selectedLevel = Number(value), value => value);
            fill('.bet-wheel-total', totals, this.totalBet(selectedBet, selectedLevel), value => {
                const match = choices.find(item => item.display === value);
                if (match) { selectedBet = match.bet; selectedLevel = match.level; }
            }, value => formatMoney(value));
            updateTotal();
            (panel.querySelector('.bet-confirm') as HTMLButtonElement).onclick = () => {
                this.confirm(selectedBet, selectedLevel); close();
            };
        };
        const close = () => { root.classList.remove('visible'); window.setTimeout(() => root.remove(), 220); this.betOptionsOverlay = null; this.cleanupKey?.(); this.cleanupKey = null; };
        (panel.querySelector('.bet-options-close') as HTMLButtonElement).onclick = close;
        (panel.querySelector('.bet-max') as HTMLButtonElement).onclick = () => { const best = choices.reduce((a,b)=>BigInt(a.display)>BigInt(b.display)?a:b); selectedBet = best.bet; selectedLevel = best.level; render(); };
        root.addEventListener('click', event => { if (event.target === root) close(); });
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
        window.addEventListener('keydown', escape);
        this.cleanupKey = () => window.removeEventListener('keydown', escape);
        render();
        root.style.left = `${bounds.left}px`; root.style.top = `${bounds.top}px`; root.style.width = `${bounds.width}px`; root.style.height = `${bounds.height}px`;
        if (!document.getElementById('aislot-bet-options-style')) {
            const style = document.createElement('style'); style.id = 'aislot-bet-options-style';
            style.textContent = `.aislot-bet-options{position:fixed;z-index:13000;background:rgba(20,20,30,.18);font-family:Nunito,Arial,sans-serif;color:#f5f4f7;overflow:hidden}.bet-options-panel{position:absolute;left:0;right:0;bottom:0;background:#30303c;border-radius:20px 20px 0 0;padding-bottom:7px;transform:translate3d(0,100%,0);transition:transform .25s cubic-bezier(.25,.1,.25,1)}.aislot-bet-options.visible .bet-options-panel{transform:translate3d(0,0,0)}.bet-options-header{height:53px;display:flex;align-items:center;justify-content:center;position:relative}.bet-options-panel h2{margin:8px 0 0;font-size:16px;font-weight:400}.bet-options-close{position:absolute;right:18px;top:11px;border:0;border-radius:50%;width:32px;height:32px;background:#50505d;color:#fff;font-size:25px;line-height:25px}.bet-options-content{position:relative;background:#282833;padding:0 5% 10px;overflow:hidden}.bet-options-head,.bet-wheel{display:grid;grid-template-columns:22.32% 5% 18.855% 5% 17.67% 5% 23.715%;align-items:center;justify-content:space-between;text-align:center;gap:0}.bet-options-head{height:34px;color:#fff;font-size:11px}.bet-options-head span{opacity:.3}.bet-options-head strong{color:#b47850;font-weight:400}.bet-options-head i,.bet-wheel>i{font-style:normal;opacity:.3}.bet-selector-bg{position:absolute;left:4px;right:4px;top:60px;height:36px;background:#30303d;border:1px solid #262633;border-radius:30px}.bet-wheel{height:160px;position:relative;z-index:1}.bet-wheel-column{height:160px;overflow:auto;scrollbar-width:none}.bet-wheel-column::-webkit-scrollbar{display:none}.bet-wheel-column button{display:block;width:100%;height:32px;border:0;background:transparent;color:#fff;font:inherit;font-size:16px;line-height:32px;white-space:nowrap}.bet-wheel-column button.active{color:#fff}.bet-wheel-lines span,.bet-wheel-total{font-size:16px;font-weight:400;color:#fff}.bet-wheel-total{color:#b47850}.bet-gradient{position:absolute;left:5%;right:5%;height:55px;z-index:2;pointer-events:none}.bet-gradient.top{top:30px;background:linear-gradient(#282833 8%,rgba(40,40,51,0))}.bet-gradient.bottom{bottom:8px;background:linear-gradient(0deg,#282833 8%,rgba(40,40,51,0))}.bet-options-actions{display:flex;justify-content:space-between;gap:10px;margin:24px 10px}.bet-options-actions button{height:36px;border-radius:30px;padding:0 12px;font:inherit;font-size:14px}.bet-options-actions .bet-max{width:30%;border:1px solid #b47850;background:#30303d;color:#b47850}.bet-options-actions .bet-confirm{width:67%;border:1px solid #b47850;background:#b47850;color:rgba(255,255,255,.85)}.bet-options-footer{display:flex;justify-content:space-between;align-items:center;margin:0 10px;background:rgba(48,48,60,.7);font-size:12px;color:#aaa;padding:6px 12px;border-radius:16px}.bet-options-footer b{color:#b47850;font-weight:400}`;
            style.textContent += '.bet-wheel-column,.bet-wheel-total{box-sizing:border-box;position:relative;height:160px;overflow:auto;scrollbar-width:none;scroll-snap-type:y mandatory;scroll-padding:64px 0;padding:64px 0}.bet-wheel-column button,.bet-wheel-total button{display:block;width:100%;height:32px;scroll-snap-align:center;border:0;background:transparent;color:#777782;font:inherit;font-size:16px;line-height:32px;white-space:nowrap}.bet-wheel-column button.active,.bet-wheel-total button.active{color:#fff}.bet-wheel-column::-webkit-scrollbar,.bet-wheel-total::-webkit-scrollbar{display:none}.bet-selector-bg{top:96px;height:32px}.bet-wheel-lines{height:160px;padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;transform:none}.bet-wheel-lines span{display:block;height:32px;line-height:32px}.bet-wheel-total{color:#b47850;font-weight:400;transform:none}.bet-wheel-total button{color:#777782}.bet-wheel-total button.active{color:#fff}';
            style.textContent += '.bet-wheel-column button,.bet-wheel-total button{box-sizing:border-box;padding:0}.bet-options-panel{max-height:100%;overflow:auto}.bet-options-panel button{cursor:pointer}';
            document.head.append(style);
        }
        document.body.append(root); fitGameOverlay(root, canvas, 414); this.betOptionsOverlay = root; requestAnimationFrame(() => root.classList.add('visible'));
    }

}
