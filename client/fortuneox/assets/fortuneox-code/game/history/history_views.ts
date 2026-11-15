import { replayShareButton } from './replay_share';
import { floatingScroll } from './history_scroll';
import { button, el, notice } from './history_dom';
import { dateText, fraction, money, symbolNames } from './history_model';
import type { HistoryArt, HistoryList, HistoryRecord, HistoryReplay } from './history_types';

export function header(
    host: HTMLElement,
    title: string,
    back: () => void,
    art: HistoryArt,
    subtitle = '',
) {
    const bar = el('header', 'history-header');
    const control = button('返回', back, 'history-back');
    control.setAttribute('aria-label', '返回');
    bar.append(control, el('h1', '', title));
    if (subtitle) bar.append(el('div', 'history-subtitle', subtitle));
    host.append(bar);
}
export function listRows(
    host: HTMLElement,
    data: HistoryList,
    art: HistoryArt,
    select: (record: HistoryRecord) => void,
    more: () => void,
    loading: boolean,
    append = false,
    replay?: (record: HistoryRecord) => void,
    share?: (record: HistoryRecord) => Promise<string>,
) {
    const headings = el('div', 'history-columns' + (replay ? ' has-replay' : '') + (share ? ' has-share' : ''));
    for (const text of ['时间\n(GMT+8)', '交易', '投注', '盈亏', ''])
        headings.append(el('span', '', text));
    if (!append) host.append(headings);
    for (const record of data.items) {
        const row = button('', () => select(record), 'history-record');
        row.setAttribute('aria-label', '查看下注 ' + record.betId);
        const id = el('div', 'history-id', record.betId);
        if (record.winningRoundCount)
            id.append(el('span', 'history-mark', '中奖 ' + record.winningRoundCount));
        if (record.status === 'active') id.append(el('span', 'history-progress', '进行中'));
        const profit = el(
            'span',
            'history-amount' + (record.profitAmount.startsWith('-') ? ' history-loss' : ''),
            money(record.profitAmount, data.amountScale, record.currency),
        );
        const arrow = el('span', 'history-chevron');
        arrow.setAttribute('aria-hidden', 'true');
        row.append(
            el('span', 'history-time', dateText(record.createdAt)),
            id,
            el(
                'span',
                'history-amount history-loss',
                money(record.betAmount, data.amountScale, record.currency),
            ),
            profit,
            arrow,
        );
        if (replay && record.status === 'complete') {
            const wrapper = el('div', 'history-record-wrap');
            const play = button('回放', () => replay(record), 'history-replay');
            play.setAttribute('aria-label', '回放交易 ' + record.betId);
            row.classList.add('has-replay');
            const actions = el('div', 'history-record-actions');
            if (share) {
                row.classList.add('has-share');
                const control = replayShareButton(() => share(record),
                    () => host.closest<HTMLElement>('.slot-history') || host, 'history-share');
                control.setAttribute('aria-label', '分享交易 ' + record.betId);
                actions.append(control);
            }
            actions.append(play);
            wrapper.append(row, actions); host.append(wrapper);
        } else host.append(row);
    }
    if (!append && !data.items.length) notice(host, '这个时间段暂无游戏记录');
    if (data.nextCursor) {
        const load = button('加载更多', more, 'history-more');
        load.disabled = loading;
        host.append(load);
    }
}
export function listFooter(host: HTMLElement, data: HistoryList, currency: string) {
    const footer = el('footer', 'history-footer');
    footer.append(
        el('span', '', '共 ' + data.summary.recordCount + ' 条记录'),
        el('span', 'history-amount', money(data.summary.betAmount, data.amountScale, currency)),
        el('span', 'history-amount', money(data.summary.profitAmount, data.amountScale, currency)),
    );
    host.append(footer);
}
export function detailBody(
    host: HTMLElement,
    detail: HistoryReplay,
    index: number,
    art: HistoryArt,
    previous: () => void,
    next: () => void,
    loading: boolean,
    direction = 0,
) {
    const round = detail.frames[index],
        record = detail.bet;
    const strip = el('div', 'history-detail-strip');
    for (const [label, value] of [
        ['交易', record.betId],
        ['投注', money(round.chargeAmount, detail.amountScale, record.currency)],
        ['盈亏', money(round.profitAmount, detail.amountScale, record.currency)],
        ['余额', money(String(round.balance), detail.amountScale, record.currency)],
    ]) {
        const item = el('div');
        item.append(el('strong', '', label), el('span', '', value));
        strip.append(item);
    }
    host.append(strip);
    const scroll = el('div', 'history-scroll history-detail-scroll');
    const facts = el('div', 'history-facts');
    for (const [title, value] of [
        ['轮次', index + 1 + '/' + record.totalRoundCount],
        ['单线投注额', round.payoutUnit ? fraction(round.payoutUnit, 4, detail.amountScale) : '—'],
        ['线数', String(round.lineCount || '—')],
    ]) {
        const fact = el('div', '', title);
        fact.append(el('strong', '', value));
        facts.append(fact);
    }
    const boardWrap = el('div', 'history-board-wrap');
    const board = el('div', 'history-board');
    board.style.gridTemplateColumns = `repeat(${round.board.length}, minmax(0, 1fr))`;
    board.setAttribute('aria-label', '第' + (index + 1) + '轮盘面');
    for (const column of round.board) {
        const col = el('div', 'history-board-column');
        for (const cell of column) {
            const tile = el('div', 'ag7-history-cell');
            const image = el('img', 'history-tile');
            image.src = art[String(cell.symbolId)];
            image.alt = symbolNames[cell.symbolId];
            tile.append(image);
            col.append(tile);
        }
        board.append(col);
    }
    boardWrap.append(board);
    const left = arrowButton('上一轮', previous, true);
    left.disabled = index === 0 || loading;
    const right = arrowButton('下一轮', next, false);
    right.disabled = loading || (index === detail.frames.length - 1 && !detail.nextCursor);
    scroll.append(facts, boardWrap, el('div', 'history-payment-title', '赔付明细'));
    const payouts = el('div', 'history-payouts');
    if (!round.payouts.length)
        payouts.append(
            el(
                'p',
                'history-empty-win',
                round.wins.length ? '本轮已中奖，历史计算明细暂缺' : '无中奖组合',
            ),
        );
    for (const [index, payout] of round.payouts.entries()) {
        const item = el('details', 'history-payout');
        const summary = el('summary');
        const icon = el('img');
        const jackpot = round.gameData.jackpot;
        icon.src = art[String(payout.symbolId)];
        icon.alt = symbolNames[payout.symbolId] || '';
        const win = round.wins[index];
        const line = jackpot ? undefined : round.gameData.lineWins.find(item => item.cellIds.join() === win?.cellIds.join() && item.symbolId === win?.symbolId);
        const label = el('div', '', jackpot ? '全盘金牛 · 2,000 倍' : line ? '第 ' + line.line + ' 条线' : '中奖线');
        if (!jackpot) label.append(el('div', 'ways', payout.columns + ' 个符号相连'));
        const amount = el(
            'div',
            'amount',
            money(payout.amount, detail.amountScale, record.currency),
        );
        const expand = el('span', 'history-expand');
        expand.setAttribute('aria-hidden', 'true');
        summary.append(icon, label, amount, expand);
        const formula = el('div', 'history-formula', '实付金额');
        formula.append(el('strong', '', money(payout.amount, detail.amountScale, record.currency)));
        item.append(summary, formula);
        payouts.append(item);
    }
    scroll.append(payouts);
    // 导航悬浮在详情视口上，滚动盘面或赔付明细时保持位置，不占内容宽高。
    const viewport = floatingScroll(scroll);
    viewport.classList.add('history-detail-viewport');
    if (direction > 0) viewport.classList.add('history-round-enter-next');
    if (direction < 0) viewport.classList.add('history-round-enter-previous');
    viewport.append(left, right);
    host.append(viewport);
    return scroll;
}
function arrowButton(label: string, action: () => void, previous: boolean) {
    const control = button('', action, 'history-round-arrow ' + (previous ? 'previous' : 'next'));
    control.setAttribute('aria-label', label);
    const chevron = el('span', 'history-round-chevron');
    chevron.setAttribute('aria-hidden', 'true');
    control.append(chevron);
    return control;
}
