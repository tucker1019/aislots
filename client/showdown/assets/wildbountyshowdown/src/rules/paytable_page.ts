import { el } from '../history/history_dom';
import { RulesPage } from './rules_page';
import { PAYOUTS, SECTIONS, SYMBOL_NOTES } from './paytable_data';
const CSS = `
#ag3-paytable .rules-copy{padding:1em 1.5em 2.5em}
#ag3-paytable .pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:.9em .7em;margin:1.5em 0}
#ag3-paytable .pay-card{display:flex;align-items:center;gap:.55em;min-width:0;background:#30303e;border-radius:.5em;padding:.7em .45em}
#ag3-paytable .pay-symbol{display:inline-flex;position:relative;width:4.3em;height:4.8em;flex-shrink:0;align-items:center;justify-content:center;vertical-align:middle}
#ag3-paytable .pay-symbol img{width:100%;height:100%;object-fit:contain}
#ag3-paytable .pay-symbol.gold{border:.15em solid #e7bc57;border-radius:.5em;background:linear-gradient(#d19a3644,#f3d46122);box-sizing:border-box}
#ag3-paytable .pay-values{flex:1;font-variant-numeric:tabular-nums}
#ag3-paytable .pay-row{display:flex;justify-content:space-between;gap:.6em;color:#aaa9b3;line-height:1.8}
#ag3-paytable .pay-row b{color:var(--accent);font-weight:500}
#ag3-paytable .pay-visual{display:flex;justify-content:center;align-items:center;gap:.8em;margin:1em 0;flex-wrap:wrap}
#ag3-paytable .pay-caption{text-align:center;color:#f5f4f7;font-size:.9em}
#ag3-paytable .pay-factors{display:flex;flex-wrap:wrap;gap:.45em;justify-content:center;align-items:center;margin:1.3em 0;color:var(--accent)}
#ag3-paytable .pay-factors b{font-weight:500;background:#30303e;border:1px solid #4a4140;padding:.4em .6em;border-radius:.35em}
#ag3-paytable .pay-equation{text-align:center;color:var(--accent);font-size:1.2em;margin:1em 0}
#ag3-paytable .pay-ways{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.2em;align-items:center;margin:1.5em 0}
#ag3-paytable .pay-column{display:flex;flex-direction:column;gap:.2em}
#ag3-paytable .pay-column .pay-symbol{width:100%;height:2.5em;background:#30303e;border-radius:.25em;box-sizing:border-box}
#ag3-paytable .pay-column .pay-symbol.match{border:1px solid #c79b52;background:#56422b}
#ag3-paytable .buy-illustration{border:1px solid #bd9151;background:linear-gradient(#74552c,#483324);border-radius:.6em;padding:1em;text-align:center;color:#efcd8f;margin:1em 0}
`;
const names: Record<number,string>={1:'蒙面牛仔',2:'左轮手枪',3:'牛仔帽',4:'威士忌',5:'A',6:'K',7:'Q',8:'J',9:'Wild 百搭',10:'Scatter 免费图标'};
export class Ag3PaytablePage extends RulesPage {
    constructor(canvas:HTMLCanvasElement,image:(symbol:number)=>string) {
        super(canvas,{title:'赔率表',id:'ag3-paytable',css:CSS,build:parent=>buildPaytable(parent,image)});
    }
}
function buildPaytable(parent:HTMLElement,image:(symbol:number)=>string) {
    const section=(title:string)=>{const block=el('section','rules-section');block.append(el('h2','',title));parent.append(block);return block;};
    const symbol=(id:number)=>{
        const wrap=el('span','pay-symbol'+(id>=1000?' gold':''));
        const img=el('img');img.alt=names[id%1000]||String(id);const src=image(id);if(src)img.src=src;wrap.append(img);return wrap;
    };
    const intro=section('符号赔率'),specials=el('div','pay-visual');
    for(const id of [9,10]){const item=el('div','pay-caption');item.append(symbol(id),el('div','',names[id]));specials.append(item);}intro.append(specials);
    const grid=el('div','pay-grid');
    for(const payout of PAYOUTS){const card=el('div','pay-card'),values=el('div','pay-values');
        for(let index=3;index>=0;index--){const row=el('div','pay-row');row.append(el('span','',String(index+3)),el('b','',String(payout.values[index])));values.append(row);}
        card.append(symbol(payout.id),values);grid.append(card);
    }
    intro.append(grid);for(const text of SYMBOL_NOTES)intro.append(el('p','',text));
    for(const rule of SECTIONS){const block=section(rule.title);
        if(rule.id==='gold'){const visual=el('div','pay-visual');visual.append(symbol(1001),el('span','','→'),symbol(9));block.append(visual);}
        if(rule.id==='free'){const visual=el('div','pay-visual');visual.append(symbol(10),symbol(10),symbol(10));block.append(visual);}
        if(rule.id==='multiplier'||rule.id==='free'){
            const bar=el('div','pay-factors');for(const text of (rule.id==='free'?['×8','→','×16','→','×32','…','×1,024']:['×1','→','×2','→','×4','…','×1,024']))bar.append(el(text.startsWith('×')?'b':'span','',text));block.append(bar);
        }
        if(rule.id==='buy')block.append(el('div','buy-illustration','购买免费旋转'));
        if(rule.id==='ways'){
            const visual=el('div','pay-ways');
            [3,4,5,5,4,3].forEach((height,c)=>{const column=el('div','pay-column');for(let r=0;r<height;r++){const match=c<3&&r<2,cell=symbol(match?1:((r+c)%7+2));if(match)cell.classList.add('match');column.append(cell);}visual.append(column);});
            block.append(visual,el('div','pay-equation','2 × 2 × 2 = 8'),el('div','pay-equation','10 × 8 = 80'));
        }
        const list=el('ul');for(const text of rule.items)list.append(el('li','',text));block.append(list);
    }
}
