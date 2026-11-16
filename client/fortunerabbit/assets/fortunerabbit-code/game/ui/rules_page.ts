import { button, el, placeOverlay, trapTab } from '../history/history_dom';
import { disposeFloatingScroll, floatingScroll } from '../history/history_scroll';
import { loadHistoryArt } from '../history/history_assets';
import type { HistoryArt } from '../history/history_types';
import { toast } from '../net/FRGameUI';
import { RULES_CSS } from './rules_styles';
import { visibleGameBounds } from './game_overlay';

// Values and ordering from the supplied Fortune Rabbit paytable and AG5 paylines.
const PAYOUTS = [
    [7, 'Wild', 200], [6, "Emas", 100], [5, "Kantong keberuntungan", 50], [4, "Angpau", 10],
    [3, "Koin", 5], [2, "Petasan", 3], [1, "Wortel", 2],
] as const;

// The supplied AG5 rules use Indonesian, as does the AG4 rules body.
const RULE_SECTIONS = [
    {
        title: 'Nilai Bayaran Simbol',
        items: ['Simbol Wild menggantikan semua simbol kecuali Simbol Hadiah.'],
    },
    {
        title: 'Simbol-simbol Hadiah',
        illustration: { name: 'paytable_prize', width: 493, height: 531, alt: 'Contoh 5 simbol Hadiah pada rol' },
        items: [
            'Selama putaran apa pun, satu atau lebih simbol Hadiah bisa saja muncul di rol.',
            'Setiap nilai simbol Hadiah bisa berkisar mulai dari 0,5x hingga 500x dari jumlah taruhan total.',
            'Saat 5 atau lebih simbol Hadiah muncul di mana saja di rol, kemenangan dari semua simbol Hadiah akan diberikan.',
        ],
    },
    {
        title: 'Fitur Kelinci Keberuntungan',
        illustration: { name: 'paytable_features', width: 493, height: 532, alt: 'Contoh rol pada Fitur Kelinci Keberuntungan' },
        items: [
            'Selama putaran apa pun, Fitur Kelinci Keberuntungan dengan 8 Putaran Keberuntungan bisa saja dipicu secara acak ketika rol sedang berputar.',
            'Selama Fitur Kelinci Keberuntungan, hanya simbol Hadiah yang akan muncul di rol.',
        ],
    },
    {
        title: 'Kemenangan Maksimum',
        items: [
            'Jumlah kemenangan maksimum adalah 5.000x dari jumlah taruhan.',
            'Jika kemenangan total di permainan utama atau Fitur Kelinci Keberuntungan mencapai 5.000x dari jumlah taruhan, putaran akan berakhir.',
        ],
    },
    {
        title: 'Baris Taruhan Yang Menang',
        illustration: { name: 'paytable_payline', width: 624, height: 183, alt: 'Diagram baris taruhan 01–10' },
        items: [
            'Hanya kemenangan tertinggi untuk setiap baris taruhan yang akan dibayarkan.',
            'Baris taruhan dimenangkan jika simbol-simbol yang menang tampil berurutan dari rol paling kiri ke rol paling kanan.',
            'Semua hasil menang ditampilkan dalam nilai uang tunai.',
        ],
    },
];

function payoutCards(art: HistoryArt) {
    const grid = el('div', 'pay-grid');
    for (const [id, name, value] of PAYOUTS) {
        const card = el('div', 'pay-card' + (id === 7 ? ' pay-wild' : ''));
        const symbol = el('img', 'pay-symbol');
        symbol.src = art[String(id)];
        symbol.alt = name;
        card.append(symbol, el('span', '', String(value)));
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
        if (!document.getElementById('ag5-paytable-style')) {
            const style = el('style'); style.id = 'ag5-paytable-style';
            style.textContent = RULES_CSS; document.head.append(style);
        }
        this.focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.previousPointer = this.canvas.style.pointerEvents;
        this.canvas.style.pointerEvents = 'none';
        const root = this.root = el('section', 'slot-history slot-rules slot-paytable');
        root.id = 'ag5-paytable'; root.tabIndex = -1;
        root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'ag5-paytable-title');
        const header = el('header', 'history-header');
        const title = el('h1', '', "Tabel Pembayaran"); title.id = 'ag5-paytable-title';
        header.append(button("Kembali", () => this.close(), 'history-back'), title);
        const scroll = el('div', 'history-scroll'), copy = el('article', 'rules-copy');
        copy.lang = 'id';
        let symbols: HTMLElement;
        RULE_SECTIONS.forEach(({ title, items, illustration }, index) => {
            const section = el('section', 'rules-section');
            section.append(el('h2', '', title));
            if (index === 0) {
                symbols = el('div');
                section.append(symbols);
            } else if (illustration) {
                const image = el('img', 'pay-illustration');
                image.alt = illustration.alt;
                image.width = illustration.width;
                image.height = illustration.height;
                if (illustration.name === 'paytable_payline') image.classList.add('pay-line-diagram');
                image.src = new URL('rules/' + illustration.name + '.png', document.baseURI).href;
                section.append(image);
            }
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
            if (this.root === root) symbols.replaceWith(payoutCards(art));
        } catch {
            if (this.root === root) { this.close(); toast("Gagal memuat aturan. Silakan coba lagi."); }
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
