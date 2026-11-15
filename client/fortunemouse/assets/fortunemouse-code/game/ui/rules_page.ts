import { button, el, placeOverlay, trapTab } from '../history/history_dom';
import { disposeFloatingScroll, floatingScroll } from '../history/history_scroll';
import { loadHistoryArt } from '../history/history_assets';
import type { HistoryArt } from '../history/history_types';
import { toast } from '../net/FMGameUI';
import { RULES_CSS } from './rules_styles';
import { LINES, PAYOUTS } from '../net/FMResultAdapter';
import { visibleGameBounds } from './game_overlay';

// Copy supplied for Fortune Mouse; symbol/line order is shared with the frame adapter.
const SYMBOLS = ['Kacang', 'Jeruk', 'Petasan', 'Kantong Koin', 'Angpau', 'Fu', 'Wild'];
const RULE_SECTIONS = [
    { title: 'Nilai Simbol Bayaran', items: ['Simbol Wild menggantikan semua simbol.'] },
    { title: 'Fitur Tikus Keberuntungan', items: [
        'Selama putaran mana saja, 3 simbol Wild bisa saja ditambahkan ke rol tengah ketika rol sedang berputar.',
        'Rol pertama dan ketiga akan diputar ulang hingga terjadi kemenangan.',
    ] },
    { title: 'Kemenangan Maksimum', items: [
        'Saat simbol Wild memenuhi semua rol, 1000x jumlah taruhan total akan diberikan.',
    ] },
    { title: 'Baris Taruhan Yang Menang', items: [
        'Hanya kemenangan tertinggi untuk setiap baris taruhan yang akan dibayarkan.',
        'Baris taruhan dimenangkan jika simbol-simbol yang menang tampil berurutan dari rol paling kiri ke rol paling kanan.',
        'Semua hasil menang ditampilkan dalam nilai uang tunai.',
    ] },
];

function diagram(art: HistoryArt, jackpot: boolean) {
    const grid = el('div', 'mouse-example');
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', jackpot ? '9 simbol Wild' : '3 simbol Wild di rol tengah');
    for (const id of (jackpot ? Array(9).fill(7) : [5,7,4,2,7,6,3,7,2])) {
        const img = el('img');
        img.src = art[String(id)]; img.alt = '';
        grid.append(img);
    }
    return grid;
}

function lineDiagrams() {
    const row = el('div', 'mouse-paylines');
    LINES.forEach((line, i) => {
        const item = el('div');
        const grid = el('div', 'mouse-line');
        for (const id of [1,4,7,2,5,8,3,6,9]) grid.append(el('i', line.some(cell => cell === id) ? 'on' : ''));
        item.append(grid, el('span', '', String(i+1).padStart(2,'0')));
        row.append(item);
    });
    return row;
}

function payoutCards(art: HistoryArt) {
    const grid = el('div', 'pay-grid');
    for (let id = PAYOUTS.length; id > 0; id--) {
        const card = el('div', 'pay-card' + (id === 7 ? ' pay-wild' : ''));
        const symbol = el('img', 'pay-symbol');
        symbol.src = art[String(id)];
        symbol.alt = SYMBOLS[id - 1];
        card.append(symbol, el('span', '', String(PAYOUTS[id - 1])));
        grid.append(card);
    }
    return grid;
}

export class RulesPage {
    private root: HTMLElement = null;
    private observer: ResizeObserver = null;
    private previousPointer = '';
    private focused: HTMLElement = null;

    constructor(private canvas: HTMLCanvasElement) {}

    private resize = () => {
        if (!this.root) return;
        placeOverlay(this.root, visibleGameBounds(this.canvas));
    };

    private keydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation(); this.close();
        } else if (event.key === 'Tab') trapTab(this.root, event);
    };

    async open() {
        if (this.root) { this.root.focus(); return; }
        if (!document.getElementById('ag6-paytable-style')) {
            const style = el('style'); style.id = 'ag6-paytable-style';
            style.textContent = RULES_CSS + `
.mouse-example{display:grid;grid-template-columns:repeat(3,1fr);margin:12px auto;width:min(58%,210px);padding:6px;background:#391b20;border:2px solid #9a572e;border-radius:8px;gap:3px}
.mouse-example img{width:100%;aspect-ratio:1;object-fit:contain}
.mouse-paylines{display:flex;justify-content:center;gap:clamp(7px,2.2vw,18px);margin:12px 0;color:#ffc824}
.mouse-line{display:grid;grid-template-columns:repeat(3,1fr);width:30px;aspect-ratio:1;gap:1px;margin-bottom:4px}
.mouse-line i{background:#494951;border-radius:1px}.mouse-line .on{background:#ffc824}
`; document.head.append(style);
        }
        this.focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.previousPointer = this.canvas.style.pointerEvents;
        this.canvas.style.pointerEvents = 'none';
        const root = this.root = el('section', 'slot-history slot-rules slot-paytable');
        root.id = 'ag6-paytable'; root.tabIndex = -1;
        root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'ag6-paytable-title');
        const header = el('header', 'history-header');
        const title = el('h1', '', '赔率表'); title.id = 'ag6-paytable-title';
        header.append(button('返回', () => this.close(), 'history-back'), title);
        const scroll = el('div', 'history-scroll'), copy = el('article', 'rules-copy');
        copy.lang = 'id';
        const illustrations: HTMLElement[] = [];
        RULE_SECTIONS.forEach(({ title, items }, index) => {
            const section = el('section', 'rules-section');
            section.append(el('h2', '', title));
            if (index < 3) {
                const placeholder = el('div');
                illustrations.push(placeholder);
                section.append(placeholder);
            } else section.append(lineDiagrams());
            const list = el('ul');
            items.forEach(item => list.append(el('li', '', item)));
            section.append(list);
            copy.append(section);
        });
        scroll.append(copy); root.append(header, floatingScroll(scroll));
        for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click'])
            root.addEventListener(type, event => event.stopPropagation());
        document.body.append(root); this.resize();
        requestAnimationFrame(() => root.classList.add('is-visible'));
        root.focus({ preventScroll: true });
        window.addEventListener('resize', this.resize);
        this.observer = new ResizeObserver(this.resize); this.observer.observe(this.canvas);
        document.addEventListener('keydown', this.keydown, true);
        try {
            const art = await loadHistoryArt();
            if (this.root === root) {
                illustrations[0].replaceWith(payoutCards(art));
                illustrations[1].replaceWith(diagram(art, false));
                illustrations[2].replaceWith(diagram(art, true));
            }
        } catch {
            if (this.root === root) { this.close(); toast('规则加载失败，请重试。'); }
        }
    }

    close() {
        if (!this.root) return;
        disposeFloatingScroll(this.root); this.observer?.disconnect(); this.observer = null;
        window.removeEventListener('resize', this.resize);
        document.removeEventListener('keydown', this.keydown, true);
        this.root.remove(); this.root = null;
        this.canvas.style.pointerEvents = this.previousPointer;
        if (this.focused?.isConnected) this.focused.focus({ preventScroll: true });
    }
}
