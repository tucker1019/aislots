import { goSession } from '../net/FTGoSession';
import { showMoney } from '../common/FTUtils';
import { button, el } from './history_dom';

export function showBetHistory() {
    const root = el('dialog');
    root.setAttribute('aria-label', '投注记录');
    root.style.cssText = 'width:min(86vw,420px);max-height:75vh;border:1px solid #bb7c4b;border-radius:12px;background:#23212c;color:#fff;padding:16px;font:15px system-ui;z-index:13000;';
    const list = el('div');
    const close = button('关闭', () => root.close());
    const more = button('加载更多', () => void load());
    const status = el('div');
    status.setAttribute('role', 'status');
    root.append(el('h2', '', '投注记录'), close, list, status, more);
    root.addEventListener('close', () => root.remove(), {once:true});
    document.body.append(root);
    root.showModal();
    let cursor: string;
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    async function load() {
        more.disabled = true;
        try {
            status.textContent = '加载中…';
            const data = await goSession.history(from.toISOString(), to.toISOString(), cursor);
            if (!root.open) return;
            for (const item of data.items) {
                const row = el('div');
                row.style.cssText = 'border-bottom:1px solid #ffffff22;padding:10px 0;overflow-wrap:anywhere;';
                row.append(el('div', '', item.betId), el('div', '', new Date(item.createdAt).toLocaleString()),
                    el('div', '', `投注 ${showMoney(Number(item.betAmount))} · 赢 ${showMoney(Number(item.totalWinAmount))}`));
                if (item.status === 'complete') row.append(button('回放', () => {
                    const url = new URL(location.href);
                    url.searchParams.set('replay', item.betId);
                    location.assign(url);
                }));
                list.append(row);
            }
            cursor = data.nextCursor;
            status.textContent = list.childElementCount ? '' : '暂无投注记录';
            more.hidden = !cursor;
            more.textContent = '加载更多';
        } catch {
            status.textContent = '';
            more.textContent = '重试';
        } finally {
            more.disabled = false;
        }
    }
    void load();
}
