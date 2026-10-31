import { appendHistoryPage } from './history_pagination';
import { floatingScroll, disposeFloatingScroll } from './history_scroll';
import { button, el, errorText, notice, trapTab, placeOverlay } from './history_dom';
import { datePicker } from './history_dates';
import { dateRange, dateText, recentDates } from './history_model';
import { HISTORY_CSS } from './history_styles';
import { detailBody, header, listFooter, listRows } from './history_views';
import type {
    HistoryArt,
    HistoryClient,
    HistoryList,
    HistoryRecord,
    HistoryReplay,
} from './history_types';

type Bounds = { left: number; top: number; width: number; height: number };
/** 游戏区域内的HTML模态页；只读API、局部状态，不持有任何下注控制权。 */
export class HistoryPage {
    private root: HTMLElement = null;
    private content: HTMLElement = null;
    private observer: ResizeObserver = null;
    private epoch = 0;
    private art: HistoryArt = {};
    private data: HistoryList = null;
    private detail: HistoryReplay = null;
    private index = 0;
    private loading = false;
    private mode: 'today' | 'week' | 'custom' = 'today';
    private dates = recentDates(1);
    private scrollTop = 0;
    private focused: HTMLElement = null;
    private previousPointer = '';
    private resize = () => {
        if (!this.isOpen) return;
        placeOverlay(this.root, this.bounds());
    };
    private keydown = (event: KeyboardEvent) => {
        if (!this.isOpen) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.close();
        }
        if (event.key !== 'Tab') return;
        trapTab(this.root, event);
    };

    constructor(
        private api: HistoryClient,
        private canvas: HTMLCanvasElement,
        private bounds: () => Bounds,
        private assets: () => Promise<HistoryArt>,
        private currency = 'IDR',
    ) {}
    get isOpen() {
        return !!this.root && !this.root.hidden;
    }

    open() {
        if (this.isOpen) {
            this.root.focus();
            return;
        }
        if (!this.root) this.mount();
        this.root.classList.remove('is-visible');
        this.root.hidden = false;
        this.focused =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.previousPointer = this.canvas.style.pointerEvents;
        this.canvas.style.pointerEvents = 'none';
        this.root.focus();
        this.resize();
        requestAnimationFrame(() => this.root?.classList.add('is-visible'));
        window.addEventListener('resize', this.resize);
        if (typeof ResizeObserver !== 'undefined') {
            this.observer = new ResizeObserver(this.resize);
            this.observer.observe(this.canvas);
        }
        document.addEventListener('keydown', this.keydown, true);
        this.mode = 'today';
        this.dates = recentDates(1);
        this.scrollTop = 0;
        void this.loadList(false);
    }
    close() {
        if (!this.isOpen) return;
        this.epoch++;
        this.root.hidden = true;
        this.root.classList.remove('is-visible');
        this.data = null;
        this.detail = null;
        this.loading = false;
        this.clearContent();
        this.canvas.style.pointerEvents = this.previousPointer;
        window.removeEventListener('resize', this.resize);
        document.removeEventListener('keydown', this.keydown, true);
        this.observer?.disconnect();
        this.observer = null;
        if (this.focused?.isConnected) this.focused.focus();
    }
    destroy() {
        this.close();
        this.root?.remove();
        this.root = null;
    }

    private mount() {
        if (!document.getElementById('slot-history-style')) {
            const style = el('style');
            style.id = 'slot-history-style';
            style.textContent = HISTORY_CSS;
            document.head.append(style);
        }
        this.root = el('section', 'slot-history');
        this.root.id = 'slot-history';
        this.root.hidden = true;
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('aria-label', '游戏记录');
        this.root.tabIndex = -1;
        this.content = el('div', 'history-main');
        this.root.append(this.content);
        document.body.append(this.root);
        for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click'])
            this.root.addEventListener(type, (event) => event.stopPropagation());
    }
    private clearContent() {
        disposeFloatingScroll(this.content);
        this.content.replaceChildren();
    }
    private listScreen() {
        this.clearContent();
        header(this.content, '游戏记录', () => this.close(), this.art);
        const tabs = el('div', 'history-tabs');
        tabs.setAttribute('role', 'tablist');
        for (const [id, text] of [
            ['today', '今天'],
            ['week', '最近7天'],
            ['custom', '自定义'],
        ] as const) {
            const tab = button(text, () => {
                if (id === 'custom') {
                    this.dateScreen();
                    return;
                }
                if (this.mode === id) return;
                this.mode = id;
                this.dates = recentDates(id === 'today' ? 1 : 7);
                this.scrollTop = 0;
                void this.loadList(false);
            });
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', String(this.mode === id));
            tabs.append(tab);
        }
        const scroll = el('div', 'history-scroll');
        scroll.addEventListener('scroll', () => (this.scrollTop = scroll.scrollTop));
        this.content.append(tabs, scroll);
        if (this.data) {
            listRows(
                scroll,
                this.data,
                this.art,
                (record) => void this.showDetail(record),
                () => void this.loadList(true),
                this.loading,
            );
            listFooter(this.content, this.data, this.data.items[0]?.currency || this.currency);
        } else notice(scroll, this.loading ? '加载中…' : '暂无记录');
        const next = scroll.nextSibling;
        this.content.insertBefore(floatingScroll(scroll), next);
        scroll.scrollTop = this.scrollTop;
        return scroll;
    }
    private async loadList(more: boolean) {
        if (more && (this.loading || !this.data?.nextCursor)) return;
        if (more) {
            const epoch = ++this.epoch;
            this.loading = true;
            const data = await appendHistoryPage({
                host: this.content, current: this.data, art: this.art,
                fetch: cursor => this.api.historyRecords({ ...dateRange(this.dates.start, this.dates.end), cursor }),
                isCurrent: () => epoch === this.epoch && this.isOpen,
                select: record => void this.showDetail(record),
                more: () => void this.loadList(true),
            });
            if (epoch === this.epoch && this.isOpen) {
                this.loading = false;
                if (data) this.data = data;
            }
            return;
        }
        const epoch = ++this.epoch;
        const cursor = undefined;
        if (!more) this.data = null;
        this.detail = null;
        this.loading = true;
        this.listScreen();
        try {
            const [data, art] = await Promise.all([
                this.api.historyRecords({ ...dateRange(this.dates.start, this.dates.end), cursor }),
                this.assets(),
            ]);
            if (epoch !== this.epoch || !this.isOpen) return;
            this.art = art;
            this.data =
                more && this.data ? { ...data, items: [...this.data.items, ...data.items] } : data;
            this.loading = false;
            this.listScreen();
        } catch (reason) {
            if (epoch !== this.epoch || !this.isOpen) return;
            this.loading = false;
            const scroll = this.listScreen();
            notice(scroll, errorText(reason), () => void this.loadList(more));
        }
    }
    private dateScreen() {
        this.epoch++;
        this.loading = false;
        this.clearContent();
        header(this.content, '游戏记录', () => this.listScreen(), this.art, '请选择最多7天');
        datePicker(
            this.content,
            this.dates.start,
            this.dates.end,
            (start, end) => {
                this.dates = { start, end };
                this.mode = 'custom';
                this.scrollTop = 0;
                void this.loadList(false);
            },
            () => this.listScreen(),
        );
    }
    private async showDetail(record: HistoryRecord) {
        const epoch = ++this.epoch;
        this.loading = false;
        this.detail = null;
        this.clearContent();
        header(this.content, '记录详情', () => this.backToList(), this.art);
        notice(this.content, '加载中…');
        try {
            const detail = await this.api.historyReplay(record.betId);
            if (epoch !== this.epoch || !this.isOpen) return;
            if (!detail.frames.length) throw new Error('暂无已结算盘面');
            this.detail = detail;
            this.index = 0;
            this.detailScreen();
        } catch (reason) {
            if (epoch !== this.epoch || !this.isOpen) return;
            this.clearContent();
            header(this.content, '记录详情', () => this.backToList(), this.art);
            notice(this.content, errorText(reason), () => void this.showDetail(record));
        }
    }
    private backToList() {
        this.epoch++;
        this.detail = null;
        this.loading = false;
        this.listScreen();
    }
    private detailScreen(direction = 0) {
        if (!this.detail) return;
        const round = this.detail.frames[this.index];
        this.clearContent();
        header(
            this.content,
            round.mode === 'free' ? '免费旋转' : '普通旋转',
            () => this.backToList(),
            this.art,
        );
        detailBody(
            this.content,
            this.detail,
            this.index,
            this.art,
            () => {
                if (this.index > 0) {
                    this.index--;
                    this.detailScreen(-1);
                }
            },
            () => void this.nextRound(1),
            this.loading,
            direction,
        );
    }
    private async nextRound(direction = 1) {
        if (this.loading || !this.detail) return;
        if (this.index < this.detail.frames.length - 1) {
            this.index++;
            this.detailScreen(direction);
            return;
        }
        if (!this.detail.nextCursor) return;
        const epoch = this.epoch;
        this.loading = true;
        this.detailScreen(direction);
        try {
            const page = await this.api.historyReplay(
                this.detail.bet.betId,
                this.detail.nextCursor,
            );
            if (epoch !== this.epoch || !this.isOpen) return;
            this.detail = { ...page, frames: [...this.detail.frames, ...page.frames] };
            if (page.frames.length) this.index++;
            this.loading = false;
            this.detailScreen(direction);
        } catch (reason) {
            if (epoch !== this.epoch || !this.isOpen) return;
            this.loading = false;
            this.detailScreen(direction);
            notice(this.content, errorText(reason), () => void this.nextRound());
        }
    }
}
