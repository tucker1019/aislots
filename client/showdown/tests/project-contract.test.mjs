import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const root=new URL('../',import.meta.url);const source=path=>fs.readFileSync(new URL('assets/wildbountyshowdown/src/'+path,root),'utf8');
test('gold conversion renders configured plain Wild, never the vendor golden Wild',()=>{
 const board=JSON.parse(fs.readFileSync(new URL('../../../game_configs/AG3/board.json',import.meta.url)));
 assert.equal(board.gold.wildSymbolId,'9');
 assert.match(source('wbsgame/view/WBSRollLayer.ts'),/item\["type"\] = WBSConstant.WILD_TYPE/);
 assert.match(source('wbsgame/view/WBSCellItem.ts'),/let newType = WBSConstant.WILD_TYPE/);
});
test('touch cancellation is canvas-only so history can scroll on mobile',()=>{
 const template=fs.readFileSync(new URL('build-templates/web-mobile/index.ejs',root),'utf8');
 assert.doesNotMatch(template,/document\.addEventListener\('touchmove'/);
 assert.match(template,/getElementById\('GameCanvas'\)\.addEventListener\('touchmove'/);
});
