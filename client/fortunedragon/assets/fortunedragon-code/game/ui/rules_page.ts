import { button, el, placeOverlay, trapTab } from '../history/history_dom';
import { disposeFloatingScroll, floatingScroll } from '../history/history_scroll';
import { loadHistoryArt } from '../history/history_assets';
import type { HistoryArt } from '../history/history_types';
import { toast } from '../net/FDGameUI';
import { RULES_CSS } from './rules_styles';
import { LINES, PAYOUTS } from '../net/FDResultAdapter';
import { visibleGameBounds } from './game_overlay';

const SYMBOLS = ['Koin', 'Simpul Tiongkok', 'Petasan', 'Lentera', 'Angpau', 'Bongkahan Emas', 'Wild'];
const RULE_SECTIONS = [
    { title: 'Nilai Bayaran Simbol', figure: 'payouts', items: [
        'Simbol Wild menggantikan semua simbol.',
    ] },
    { title: 'Rol Pengali', figure: 'reel', items: [
        'Selama putaran apa pun, rol pengali di bagian bawah rol akan berputar untuk menampilkan pengali nilai kosong, x2, x5, atau x10.',
        'Jika rol pengali menampilkan nilai x2, x5, atau x10, semua kemenangan dari putaran tersebut akan dikalikan dengan pengali yang ditampilkan sebelum kemenangan dibayarkan.',
    ] },
    { title: 'Fitur Naga Keberuntungan', figure: 'bonus', items: [
        'Selama putaran apa pun, Fitur Naga Keberuntungan dengan 8 Putaran Keberuntungan dapat dipicu secara acak saat rol sedang berputar.',
        'Selama Fitur Naga Keberuntungan, rol pengali akan diperbesar dan 2 atau 3 pengali akan diberikan untuk setiap Putaran Keberuntungan.',
    ] },
    { title: 'Kemenangan Maksimum', items: [
        'Jumlah kemenangan maksimum adalah 2.500x dari jumlah taruhan.',
        'Jika kemenangan total dari permainan utama atau Fitur Naga Keberuntungan mencapai 2.500x jumlah taruhan, putaran akan berakhir.',
    ] },
    { title: 'Taruhan Pasti Menang', figure: 'sure', items: [
        'Opsi Taruhan Pasti Menang bisa diaktifkan untuk setiap putaran dan akan meningkatkan taruhan sebesar 5x.',
        'Mengaktifkan Taruhan Pasti Menang akan menjamin kemenangan untuk setiap putaran (tidak termasuk Putaran Keberuntungan).',
    ] },
    { title: 'Baris Taruhan Yang Menang', figure: 'lines', items: [
        'Hanya kemenangan tertinggi per baris taruhan yang akan dibayarkan.',
        'Baris taruhan akan menang jika simbol yang menang tampil berurutan dari rol paling kiri ke rol paling kanan.',
        'Semua kemenangan akan ditampilkan dalam bentuk uang tunai.',
    ] },
];

function featureExample(kind: string) {
    const figure = el('div', 'dragon-rule-example');
    figure.setAttribute('role', 'img');
    if (kind === 'sure') {
        figure.classList.add('dragon-rule-sure');
        figure.setAttribute('aria-label', 'Opsi Taruhan Pasti Menang, taruhan dikali 5');
        figure.append(el('strong', '', '×5'));
    } else {
        const bonus = kind === 'bonus';
        figure.setAttribute('aria-label', bonus ? 'Contoh Putaran Keberuntungan dengan tiga pengali' : 'Nilai kosong, x2, x5, dan x10 pada rol pengali');
        for (const value of (bonus ? ['×2', '×5', '×10'] : ['', '×2', '×5', '×10']))
            figure.append(el('span', '', value));
    }
    return figure;
}

function lineDiagrams() {
    const row = el('div', 'dragon-paylines');
    LINES.forEach((line, i) => {
        const item = el('div');
        const grid = el('div', 'dragon-line');
        for (const col of [[1,2,3],[4,5,6],[7,8,9]]) {
            const group = el('div');
            for (const id of col) group.append(el('i', line.some(cell => cell === id) ? 'on' : ''));
            grid.append(group);
        }
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
        if (!document.getElementById('ag8-paytable-style')) {
            const style = el('style'); style.id = 'ag8-paytable-style';
            style.textContent = RULES_CSS + `
.dragon-paylines{display:grid;grid-template-columns:repeat(5,1fr);justify-items:center;gap:9px;margin:12px 0;color:#ffc824}
.dragon-line{display:grid;grid-template-columns:repeat(3,1fr);align-items:center;width:34px;gap:1px;margin-bottom:4px}
.dragon-line i{display:block;aspect-ratio:1;margin:1px 0;background:#494951;border-radius:1px}.dragon-line .on{background:#ffc824}
.dragon-rule-example{display:flex;justify-content:center;align-items:center;gap:.45em;width:fit-content;max-width:100%;margin:0 auto 1em;padding:.5em .75em;border-radius:.55em;background:#472426;color:#ffc824}
.dragon-rule-example span{display:grid;place-items:center;min-width:2.45em;height:2.45em;border:1px solid #ad7843;border-radius:50%;background:#692d26;font-weight:700}
.dragon-rule-example.dragon-rule-sure{min-width:5.2em;border:1px solid #ad7843;font-size:1.25em}
`; document.head.append(style);
        }
        this.focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.previousPointer = this.canvas.style.pointerEvents;
        this.canvas.style.pointerEvents = 'none';
        const root = this.root = el('section', 'slot-history slot-rules slot-paytable');
        root.id = 'ag8-paytable'; root.tabIndex = -1;
        root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'ag8-paytable-title');
        const header = el('header', 'history-header');
        const title = el('h1', '', '赔率表'); title.id = 'ag8-paytable-title';
        header.append(button('返回', () => this.close(), 'history-back'), title);
        const scroll = el('div', 'history-scroll'), copy = el('article', 'rules-copy');
        copy.lang = 'id';
        const payouts = el('div');
        RULE_SECTIONS.forEach(({ title, items, figure }) => {
            const section = el('section', 'rules-section');
            section.append(el('h2', '', title));
            if (figure === 'payouts') section.append(payouts);
            else if (figure === 'lines') section.append(lineDiagrams());
            else if (figure) section.append(featureExample(figure));
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
                payouts.replaceWith(payoutCards(art));
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
