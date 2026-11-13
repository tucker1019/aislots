import { button, el, placeOverlay, trapTab } from '../history/history_dom';
import { disposeFloatingScroll, floatingScroll } from './history_scroll';
import { RULE_SECTIONS } from './rules_content';
import { RULES_CSS } from './rules_styles';

const SVG = 'http://www.w3.org/2000/svg';
// Crop the existing AG4 atlases using the unrotated frames in their plists.
const PAYOUTS = [
    { name: 'Wild', value: 250, frame: [1, 1, 304, 330] },
    { name: 'Emas', value: 100, frame: [1, 1, 318, 292] },
    { name: 'Ruyi', value: 25, frame: [1, 295, 300, 310] },
    { name: 'Kantong', value: 10, frame: [1, 1141, 256, 274] },
    { name: 'Angpau', value: 8, frame: [1, 865, 256, 274] },
    { name: 'Petasan', value: 5, frame: [1, 607, 268, 256] },
    { name: 'Jeruk', value: 3, frame: [259, 931, 232, 254] },
];
const ILLUSTRATIONS = [
    '',
    'paytable_features.png',
    'paytable_multiplier_feature.png',
    'paytable_payline.png',
];

function payoutCards() {
    const grid = el('div', 'pay-grid');
    PAYOUTS.forEach(({ name, value, frame }, index) => {
        const wild = index === 0;
        const card = el('div', 'pay-card' + (wild ? ' pay-wild' : ''));
        const symbol = document.createElementNS(SVG, 'svg');
        symbol.setAttribute('class', 'pay-symbol');
        symbol.setAttribute('viewBox', frame.join(' '));
        symbol.setAttribute('role', 'img');
        symbol.setAttribute('aria-label', name);
        const image = document.createElementNS(SVG, 'image');
        image.setAttribute('href', new URL(wild ? 'rules/wild_symbol.png' : 'rules/normal_symbol.png', document.baseURI).href);
        image.setAttribute('width', wild ? '463' : '492');
        image.setAttribute('height', wild ? '332' : '1416');
        const clip = document.createElementNS(SVG, 'clipPath');
        clip.id = 'ag4-rule-symbol-' + index;
        const crop = document.createElementNS(SVG, 'rect');
        ['x', 'y', 'width', 'height'].forEach((key, i) => crop.setAttribute(key, String(frame[i])));
        clip.append(crop);
        image.setAttribute('clip-path', 'url(#' + clip.id + ')');
        symbol.append(clip, image);
        card.append(symbol, el('span', '', String(value)));
        grid.append(card);
    });
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
        const { left, top, width, height } = this.canvas.getBoundingClientRect();
        const scale = Math.min(width / 750, height / 1334);
        placeOverlay(this.root, {
            left: left + (width - 750 * scale) / 2, top: top + (height - 1334 * scale) / 2,
            width: 750 * scale, height: 1334 * scale,
        });
    };

    private keydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation(); this.close();
        } else if (event.key === 'Tab') trapTab(this.root, event);
    };

    open() {
        if (this.root) { this.root.focus(); return; }
        if (!document.getElementById('ag4-paytable-style')) {
            const style = el('style'); style.id = 'ag4-paytable-style';
            style.textContent = RULES_CSS; document.head.append(style);
        }
        this.focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.previousPointer = this.canvas.style.pointerEvents;
        this.canvas.style.pointerEvents = 'none';
        const root = this.root = el('section', 'slot-history slot-rules slot-paytable');
        root.id = 'ag4-paytable'; root.tabIndex = -1;
        root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'ag4-paytable-title');
        const header = el('header', 'history-header');
        const title = el('h1', '', '赔率表'); title.id = 'ag4-paytable-title';
        header.append(button('返回', () => this.close(), 'history-back'), title);
        const scroll = el('div', 'history-scroll'), copy = el('article', 'rules-copy');
        copy.lang = 'id';
        RULE_SECTIONS.forEach(({ title, items }, index) => {
            const section = el('section', 'rules-section');
            section.append(el('h2', '', title));
            if (index === 0) section.append(payoutCards());
            else {
                const image = el('img', 'pay-illustration');
                image.src = new URL('rules/' + ILLUSTRATIONS[index], document.baseURI).href;
                image.alt = title;
                section.append(image);
            }
            const list = el('ul');
            items.forEach(text => list.append(el('li', '', text)));
            section.append(list); copy.append(section);
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
