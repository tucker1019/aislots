import { replayShareButton } from './replay_share';
import { floatingScroll } from './history_scroll';
import { button, el, notice } from './history_dom';
import { dateText, fraction, money, moneyFraction, symbolNames } from './history_model';
import type { HistoryArt, HistoryList, HistoryRecord, HistoryReplay } from './history_types';

export function header(
    host: HTMLElement,
    title: string,
    back: () => void,
    art: HistoryArt,
    subtitle = '',
) {
    const bar = el('header', 'history-header');
    const control = button("Kembali", back, 'history-back');
    control.setAttribute('aria-label', "Kembali");
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
    for (const text of ["Waktu\n(GMT+8)", "Transaksi", "Taruhan", "Untung/rugi", ''])
        headings.append(el('span', '', text));
    if (!append) host.append(headings);
    for (const record of data.items) {
        const row = button('', () => select(record), 'history-record');
        row.setAttribute('aria-label', "Lihat taruhan " + record.betId);
        const id = el('div', 'history-id', record.betId);
        if (record.winningRoundCount)
            id.append(el('span', 'history-mark', "Menang " + record.winningRoundCount));
        if (record.status === 'active') id.append(el('span', 'history-progress', "Berlangsung"));
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
        if (replay) {
            const wrapper = el('div', 'history-record-wrap');
            const play = button("Putar ulang", () => replay(record), 'history-replay');
            play.setAttribute('aria-label', "Putar ulang transaksi " + record.betId);
            row.classList.add('has-replay');
            const actions = el('div', 'history-record-actions');
            if (share) {
                row.classList.add('has-share');
                const control = replayShareButton(() => share(record),
                    () => host.closest<HTMLElement>('.slot-history') || host, 'history-share');
                control.setAttribute('aria-label', "Bagikan transaksi " + record.betId);
                actions.append(control);
            }
            actions.append(play);
            wrapper.append(row, actions); host.append(wrapper);
        } else host.append(row);
    }
    if (!append && !data.items.length) notice(host, "Tidak ada riwayat dalam periode ini.");
    if (data.nextCursor) {
        const load = button(loading ? "Memuat…" : "Muat lagi", more, 'history-more');
        load.disabled = loading;
        host.append(load);
    }
}
export function listFooter(host: HTMLElement, data: HistoryList, currency: string) {
    const footer = el('footer', 'history-footer');
    footer.append(
        el('span', '', "Total " + data.summary.recordCount + " transaksi"),
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
        ["Transaksi", record.betId],
        ["Taruhan", money(round.chargeAmount, detail.amountScale, record.currency)],
        ["Untung/rugi", money(round.profitAmount, detail.amountScale, record.currency)],
        ["Saldo", money(String(round.balance), detail.amountScale, record.currency)],
    ]) {
        const item = el('div');
        item.append(el('strong', '', label), el('span', '', value));
        strip.append(item);
    }
    host.append(strip);
    const scroll = el('div', 'history-scroll history-detail-scroll');
    const facts = el('div', 'history-facts');
    for (const [title, value] of [
        ["Putaran", index + 1 + '/' + record.totalRoundCount],
        ["Taruhan per garis", round.payoutUnit ? moneyFraction(round.payoutUnit, detail.amountScale) : '—'],
        ["Garis", String(round.lineCount || '—')],
    ]) {
        const fact = el('div', '', title);
        fact.append(el('strong', '', value));
        facts.append(fact);
    }
    const fullScreenWin = round.gameData?.bonusMultiplier === 10;
    const boardWrap = el('div', 'history-board-wrap');
    const board = el('div', 'history-board');
    board.style.gridTemplateColumns = `repeat(${round.board.length}, minmax(0, 1fr))`;
    board.setAttribute('aria-label', "Ke-" + (index + 1) + "Hasil putaran");
    for (const column of round.board) {
        const col = el('div', 'history-board-column');
        for (const cell of column.slice(round.previewRows ?? 0)) {
            const image = el('img', 'history-tile');
            image.src = art[String(cell.symbolId)];
            const symbol = cell.symbolId > 1000 ? cell.symbolId - 1000 : cell.symbolId;
            image.alt =
                (cell.symbolId > 1000 ? "Berlapis emas" : '') + (symbolNames[symbol] || String(symbol));
            if (cell.symbolId >= 1000 && art.gold_frame) {
                const tile = el('div', 'history-gold-tile');
                const frame = el('img', 'history-gold-frame');
                frame.src = art.gold_frame; frame.alt = '';
                tile.append(image, frame); col.append(tile);
            } else if (symbol === 11 && art.scatter_background) {
                const tile = el('div', 'history-scatter');
                const glow = el('img', 'history-scatter-glow');
                glow.src = art.scatter_background;
                glow.alt = '';
                tile.append(glow, image);
                col.append(tile);
            } else col.append(image);
        }
        board.append(col);
    }
    boardWrap.append(board);
    const left = arrowButton("Sebelumnya", previous, true);
    left.disabled = index === 0 || loading;
    const right = arrowButton("Berikutnya", next, false);
    right.disabled = loading || (index === detail.frames.length - 1 && !detail.nextCursor);
    scroll.append(facts, boardWrap, el('div', 'history-payment-title', "Rincian Pembayaran"));
    if (fullScreenWin) scroll.append(el('div', 'history-payment-caption', "Pengali kemenangan layar penuh ×10"));
    const payouts = el('div', 'history-payouts');
    if (!round.payouts.length)
        payouts.append(
            el(
                'p',
                'history-empty-win',
                round.wins.length ? "Putaran ini menang, tetapi rincian perhitungan belum tersedia." : "Tidak ada kombinasi menang.",
            ),
        );
    for (const [index, payout] of round.payouts.entries()) {
        const item = el('details', 'history-payout');
        const summary = el('summary');
        const icon = el('img');
        icon.src = art[String(payout.symbolId)];
        icon.alt = symbolNames[payout.symbolId] || '';
        const line = round.gameData?.lineWins?.[index];
        const label = el('div', '', line ? "Garis " + (line.lineIndex + 1) + "" : "Garis menang");
        label.append(el('div', 'ways', payout.columns + " simbol terhubung"));
        const amount = el(
            'div',
            'amount',
            money(payout.amount, detail.amountScale, record.currency),
        );
        const expand = el('span', 'history-expand');
        expand.setAttribute('aria-hidden', 'true');
        summary.append(icon, label, amount, expand);
        const formula = el(
            'div',
            'history-formula',
            "Taruhan per garis × pembayaran simbol" + (line && fullScreenWin ? " × pengali layar penuh" : '') + " = kemenangan",
        );
        const expression =
            line
                ? [
                      moneyFraction(round.payoutUnit || '0', detail.amountScale),
                      fraction(line.payout),
                      ...(fullScreenWin ? ['10'] : []),
                  ].join(' × ')
                : moneyFraction(round.payoutUnit || '0', detail.amountScale) + ' × ' + fraction(payout.rawPayout);
        formula.append(
            el(
                'strong',
                '',
                expression + ' = ' + money(payout.amount, detail.amountScale, record.currency),
            ),
        );
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
