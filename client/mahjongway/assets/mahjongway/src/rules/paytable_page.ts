import { el } from '../history/history_dom';
import { loadHistoryArt } from '../history/history_assets';
import { symbolNames } from '../history/history_model';
import { RulesPage } from './rules_page';
import { RULE_SECTIONS } from './rules_content';

import { PAYOUTS } from './paytable_data';

const CSS = `
.slot-paytable .rules-copy{padding:1em 1.5em 2.5em}
.slot-paytable .pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:1em .8em;margin:1.5em 0}
.slot-paytable .pay-card{display:flex;align-items:center;gap:.6em;min-width:0;background:#30303e;border-radius:.5em;padding:.7em .5em}
.slot-paytable .pay-symbol{display:inline-flex;position:relative;width:4.5em;height:5.2em;flex-shrink:0;align-items:center;justify-content:center}
.slot-paytable .pay-symbol img{width:100%;height:100%;object-fit:contain;position:relative}
.slot-paytable .pay-symbol img.pay-base{position:absolute;inset:0}
.slot-paytable .pay-symbol img.pay-glow{position:absolute;inset:0;mix-blend-mode:screen}
.slot-paytable .pay-values{flex:1;font-variant-numeric:tabular-nums}
.slot-paytable .pay-row{display:flex;justify-content:space-between;gap:.6em;color:#aaa9b3;line-height:1.8}
.slot-paytable .pay-row b{color:var(--accent);font-weight:500}
.slot-paytable .pay-visual{display:flex;justify-content:center;align-items:center;gap:1em;margin:1em 0}
.slot-paytable .pay-caption{color:#f5f4f7;text-align:center}
.slot-paytable .pay-bar{position:relative;display:flex;justify-content:space-evenly;align-items:center;min-height:4em;margin:1em 0;background-size:100% 100%}
.slot-paytable .pay-bar img{width:19%;height:3em;object-fit:contain}
.slot-paytable .pay-equation{text-align:center;color:var(--accent);font-size:1.25em;margin:1em 0}
.slot-paytable .pay-example{display:grid;grid-template-columns:repeat(3,1fr);gap:.5em;text-align:center}
.slot-paytable .pay-example div{border-radius:.4em;background:#30303e;padding:.7em .3em;color:var(--accent)}
`;
function section(parent: HTMLElement, title: string) {
    const node = el('section', 'rules-section');
    node.append(el('h2', '', title)); parent.append(node); return node;
}
function paragraphs(parent: HTMLElement, items: readonly string[]) {
    items.forEach(text => parent.append(el('p', '', text)));
}
/** HTML 赔率表沿用规则页的弹层生命周期，图片使用现有游戏资源。 */
export class PaytablePage extends RulesPage {
    constructor(canvas: HTMLCanvasElement) {
        super(canvas, { title: '赔率表', id: 'slot-paytable', css: CSS, build: buildPaytable });
    }
}
function buildPaytable(parent: HTMLElement) {
    const images: { image: HTMLImageElement; key: string }[] = [];
    const backgrounds: { element: HTMLElement; key: string }[] = [];
    const image = (key: string, alt: string) => {
        const node = el('img'); node.alt = alt;
        images.push({ image: node, key }); return node;
    };
    const symbol = (id: number) => {
        const node = el('span', 'pay-symbol');
        if (id === 10) {
            const base = image('wild_base', ''); base.className = 'pay-base'; node.append(base);
        }
        if (id === 11) {
            const glow = image('scatter_background', ''); glow.className = 'pay-glow'; node.append(glow);
        }
        node.append(image(String(id), symbolNames[id > 1000 ? id - 1000 : id] || '图标'));
        return node;
    };
    const intro = section(parent, '图标赔率');
    const specials = el('div', 'pay-visual');
    for (const [id, label] of [[10, '百搭图标'], [11, '免费图标（胡）']] as const) {
        const item = el('div', 'pay-caption'); item.append(symbol(id), el('div', '', label)); specials.append(item);
    }
    intro.append(specials);
    const grid = el('div', 'pay-grid');
    for (const payout of PAYOUTS) {
        const card = el('div', 'pay-card'), values = el('div', 'pay-values');
        payout.values.forEach((amount, index) => {
            const row = el('div', 'pay-row'); row.append(el('span', '', String(5 - index)), el('b', '', String(amount))); values.append(row);
        });
        card.append(symbol(payout.symbol), values); grid.append(card);
    }
    intro.append(grid);
    paragraphs(intro, ['百搭图标可替代除免费图标（胡）之外的所有图标。', '金底图标只会出现在第2、3、4轴。']);
    for (const rule of RULE_SECTIONS.slice(1)) {
        const block = section(parent, rule.title);
        if (rule.title === '金底图标') {
            const visual = el('div', 'pay-visual'); visual.append(symbol(1009), el('span', '', '→'), symbol(10)); block.append(visual);
        }
        if (rule.title === '免费旋转') {
            const visual = el('div', 'pay-visual'); visual.append(symbol(11), symbol(11), symbol(11)); block.append(visual);
        }
        if (rule.title === '消除倍率' || rule.title === '免费旋转') {
            const bar = el('div', 'pay-bar'); backgrounds.push({ element: bar, key: 'multiplier_background' });
            const factors = rule.title === '消除倍率' ? [1, 2, 3, 5] : [2, 4, 6, 10];
            factors.forEach(factor => bar.append(image('multiplier_light_' + factor, '×' + factor))); block.append(bar);
        }
        paragraphs(block, rule.items);
    }
    const ways = section(parent, '1,024种获胜方式');
    paragraphs(ways, ['中奖图标从最左轴开始向右连续出现，即可形成中奖方式。', '每种图标的中奖方式总数，按从左至右各相邻轴上该中奖图标的数量相乘计算。']);
    const example = el('div', 'pay-example');
    for (const [column, count] of [[1, 1], [2, 3], [3, 2]]) example.append(el('div', '', `第${column}轴：${count}个`));
    ways.append(example, el('div', 'pay-equation', '1 × 3 × 2 = 6 种中奖方式'));
    paragraphs(ways, ['中奖图标的赔付乘以中奖方式总数，即为对应的中奖金额。', '示例赔率：5个为500，4个为100，3个为10。']);
    ways.append(el('div', 'pay-equation', '本例总赢分：10 × 6 = 60'));
    paragraphs(ways, ['每轮派彩后，所有中奖图标将被消除，上方图标向下掉落，进入下一轮。', '每次旋转都会继续计算新的中奖组合，直到不再出现中奖组合为止。', '所有赢分均以现金金额显示。']);
    void loadHistoryArt().then(art => {
        images.forEach(({ image: node, key }) => { if (art[key]) node.src = art[key]; });
        backgrounds.forEach(({ element, key }) => { if (art[key]) element.style.backgroundImage = `url("${art[key]}")`; });
    }).catch(() => parent.prepend(el('p', '', '图标资源加载失败，请关闭后重新打开。')));
}
