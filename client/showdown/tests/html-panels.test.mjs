import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from '../../../slot_math/node_modules/typescript/lib/typescript.js';
const root=new URL('../assets/wildbountyshowdown/src/',import.meta.url);
const load=p=>fs.readFileSync(new URL(p,root),'utf8');
test('wager choices preserve exact base and level, deduplicate only total picker',async()=>{
 const code=ts.transpile(load('ui/bet_choices.ts'),{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});const m=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const c=m.buildChoices(['10','50'],20,10);assert.equal(c.length,20);assert.deepEqual(c[0],{bet:'10',level:1,display:'200'});assert.equal(c.at(-1).display,'10000');assert.equal(c.filter(x=>x.display==='1000').length,2);assert.equal(m.totalBet('10',5,20),'1000');
 assert.throws(()=>m.buildChoices([],20,10));assert.throws(()=>m.buildChoices(['-1'],20,10));
});
test('AG3 entry points use HTML pages and cannot instantiate native wager/auto panels',()=>{
 const menu=load('wbsgame/view/WBSPopupMenuCtrl.ts');assert.match(menu,/showHtmlBet/);assert.match(menu,/showHtmlAuto/);assert.doesNotMatch(menu,/instantiate\(wbsgame.gamelayer.panel(?:Bet|Auto)Prefab\)/);
 const ui=load('ui/ag3_panels.ts');assert.match(ui,/readOnly/);assert.match(ui,/WBSSTATE.READY/);assert.match(ui,/getIsAuto/);assert.match(ui,/setBitMultIndex/);assert.match(ui,/onAutoSelectClick/);
});

test('wheel totals avoid Cocos loose-spread Set conversion',()=>{assert.doesNotMatch(load('ui/bet_options_page.ts'),/\[\.\.\.new Set/);assert.match(load('ui/bet_options_page.ts'),/Array.from\(new Set/);});
