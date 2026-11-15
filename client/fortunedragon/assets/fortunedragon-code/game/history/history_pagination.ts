import { errorText } from './history_dom';
import { busyButton } from './async_control';
import { toast } from '../net/FDGameUI';
import { listRows, listFooter } from './history_views';
import type { HistoryArt, HistoryList, HistoryRecord } from './history_types';

/** 只追加分页，不拆除滚动容器或已有行；请求期间仍可浏览已有记录。 */
export async function appendHistoryPage(options: {
    host: HTMLElement;
    current: HistoryList;
    art: HistoryArt;
    fetch: (cursor: string) => Promise<HistoryList>;
    isCurrent: () => boolean;
    select: (record: HistoryRecord) => void;
    more: () => void;
    replay?: (record: HistoryRecord) => void;
    share?: (record: HistoryRecord) => Promise<string>;
}): Promise<HistoryList | null> {
    const scroll = options.host.querySelector<HTMLElement>('.history-scroll');
    const content = scroll?.querySelector<HTMLElement>('.history-scroll-content');
    const button = content?.querySelector<HTMLButtonElement>('.history-more');
    if (!scroll || !content || !button) return null;
    busyButton(button, true);
    try {
        const page = await options.fetch(options.current.nextCursor);
        if (!options.isCurrent()) return null;
        // 记录响应到达时的位置，避免把请求期间用户的滚动撤回。
        const top = scroll.scrollTop;
        const oldCount = content.querySelectorAll('.history-record').length;
        button.remove();
        listRows(content, page, options.art, options.select, options.more, false, true, options.replay, options.share);
        content.querySelectorAll('.history-record')[oldCount]?.classList.add('history-new-page');
        options.host.querySelector('.history-footer')?.remove();
        listFooter(options.host, page, options.current.items[0]?.currency || 'IDR');
        scroll.scrollTop = top;
        return { ...page, items: [...options.current.items, ...page.items] };
    } catch (error) {
        if (!options.isCurrent()) return null;
        toast(errorText(error));
        return null;
    } finally {
        if (button.isConnected && options.isCurrent()) {
            busyButton(button, false);
        }
    }
}
