import { el, placeOverlay, trapTab } from '../history/history_dom';
import { dateText, gameBounds } from '../history/history_model';
import { HISTORY_CSS } from '../history/history_styles';
import { floatingScroll, disposeFloatingScroll } from '../history/history_scroll';
import { header } from '../history/history_views';
import { RULE_SECTIONS, CONTROL_SECTIONS, ADDITIONAL_RULES, RuleSection } from './rules_content';

const RULE_CSS = `
.slot-rules .rules-copy{padding:1em 2em 2.5em;color:#aaa9b3;font-size:.88em;line-height:1.75}
.slot-rules .rules-section{padding:.5em 0 1.3em;border-bottom:1px solid #3b3a46;margin-bottom:1.5em}
.slot-rules h2{color:#f5f4f7;font-size:1.15em;font-weight:500;text-align:center;margin:.5em 0 1.1em}
.slot-rules h3{color:var(--accent);font-size:1em;font-weight:500;margin:1.2em 0 .5em}
.slot-rules ul{padding-left:1.2em;margin:0}.slot-rules li{padding-left:.15em;margin-bottom:.8em}
.slot-rules p{margin:0 0 1em}
`;
function section(parent: HTMLElement, value: RuleSection, level: 'h2' | 'h3') {
    const block = el('section', level === 'h2' ? 'rules-section' : 'rules-control');
    const list = el('ul');
    block.append(el(level, '', value.title), list);
    value.items.forEach(text => list.append(el('li', '', text)));
    parent.append(block);
}
export interface RulePageContent {
    title: string;
    id: string;
    css: string;
    build(parent: HTMLElement): void;
}
/** 规则只读展示；复用记录页的主题、游戏区域定位和悬浮滚动条。 */
export class RulesPage {
    private root: HTMLElement = null;
    private timer: ReturnType<typeof setInterval> = null;
    private observer: ResizeObserver = null;
    private previousPointer = '';
    private focused: HTMLElement = null;
    constructor(private canvas: HTMLCanvasElement, private content?: RulePageContent) {}
    private resize = () => {
        if (this.root) placeOverlay(this.root, gameBounds(this.canvas.getBoundingClientRect()));
    };
    private keydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation(); this.close();
        } else if (event.key === 'Tab') trapTab(this.root, event);
    };
    open() {
        if (this.root) { this.root.focus(); return; }
        if (!document.getElementById('slot-history-style')) {
            const style = el('style'); style.id = 'slot-history-style';
            style.textContent = HISTORY_CSS; document.head.append(style);
        }
        if (!document.getElementById('slot-rules-style')) {
            const style = el('style'); style.id = 'slot-rules-style';
            style.textContent = RULE_CSS; document.head.append(style);
        }
        this.focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.previousPointer = this.canvas.style.pointerEvents;
        this.canvas.style.pointerEvents = 'none';
        if (this.content && !document.getElementById(this.content.id + '-style')) {
            const style = el('style'); style.id = this.content.id + '-style';
            style.textContent = this.content.css; document.head.append(style);
        }
        const root = this.root = el('section', 'slot-history slot-rules' + (this.content ? ' slot-paytable' : ''));
        root.id = this.content?.id || 'slot-rules'; root.tabIndex = -1;
        root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', this.content?.title || '游戏规则');
        const caption = el('div', 'history-caption'), clock = el('span');
        const tick = () => clock.textContent = dateText(new Date().toISOString()).split('\n')[0];
        tick(); caption.append(el('span', '', 'Mahjong Ways'), clock); root.append(caption);
        header(root, this.content?.title || '游戏规则', () => this.close(), {});
        const scroll = el('div', 'history-scroll'), copy = el('article', 'rules-copy');
        if (this.content) this.content.build(copy);
        else {
            RULE_SECTIONS.forEach(value => section(copy, value, 'h2'));
            const controls = el('section', 'rules-section');
            controls.append(el('h2', '', '主游戏与按钮说明'));
            CONTROL_SECTIONS.forEach(value => section(controls, value, 'h3'));
            copy.append(controls);
            const extra = el('section', 'rules-section');
            extra.append(el('h2', '', '补充说明'));
            ADDITIONAL_RULES.forEach(text => extra.append(el('p', '', text)));
            copy.append(extra);
        }
        scroll.append(copy); root.append(floatingScroll(scroll));
        for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click'])
            root.addEventListener(type, event => event.stopPropagation());
        document.body.append(root); this.resize();
        requestAnimationFrame(() => this.root?.classList.add('is-visible'));
        root.focus();
        window.addEventListener('resize', this.resize);
        this.observer = new ResizeObserver(this.resize); this.observer.observe(this.canvas);
        document.addEventListener('keydown', this.keydown, true);
        this.timer = setInterval(tick, 1000);
    }
    close() {
        if (!this.root) return;
        disposeFloatingScroll(this.root); this.observer?.disconnect(); this.observer = null;
        if (this.timer) clearInterval(this.timer); this.timer = null;
        window.removeEventListener('resize', this.resize);
        document.removeEventListener('keydown', this.keydown, true);
        this.root.remove(); this.root = null;
        this.canvas.style.pointerEvents = this.previousPointer;
        if (this.focused?.isConnected) this.focused.focus();
    }
    destroy() { this.close(); }
}
