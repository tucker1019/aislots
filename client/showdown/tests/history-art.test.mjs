import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../assets/wildbountyshowdown/src/history/'+p,import.meta.url),'utf8');
test('AG3 history uses actual game symbols and six-column variable-height layout',()=>{
 assert.doesNotMatch(read('ag3_history.ts'),/loadHistoryArt/);
 assert.match(read('ag3_history.ts'),/this.image\(id\)/);
 assert.match(read('ag3_history.ts'),/gold_frame:this.image\(0\)/);
 assert.match(read('history_views.ts'),/frame.src = art.gold_frame/);
 assert.doesNotMatch(read('history_styles.ts'),/border:2px solid #edbd48/);
 assert.match(read('history_views.ts'),/round.board.length/);
 assert.match(read('history_styles.ts'),/align-items:center/);
 assert.match(read('history_styles.ts'),/flex:0 0 20%/);
 assert.doesNotMatch(read('history_model.ts'),/三饼|八万|白板/);
});

test('all history symbols and gold frames share one atlas scale',()=>{
 const source=fs.readFileSync(new URL('../assets/wildbountyshowdown/src/wbsgame/view/WBSGameLayer.ts',import.meta.url),'utf8');
 assert.match(source,/const inset=50\*canvas.width\/350/);
 assert.doesNotMatch(source,/getImageData|size=Math.max\(width,height\)/);
 assert.match(read('history_styles.ts'),/history-gold-tile>\.history-tile\{position:absolute;inset:0;width:100%;height:100%/);
});
