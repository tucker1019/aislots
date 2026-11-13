import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/domain/paylines.ts', import.meta.url), 'utf8');
const p = await import(`data:text/javascript;base64,${Buffer.from(ts.transpile(source, {module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022})).toString('base64')}`);
const fixture = () => JSON.parse(readFileSync(new URL('../../game_configs/AG4/paylines.json', import.meta.url)));
test('AG4 uses exact native symbol IDs and paytable', () => {
 const c = p.validatePaylines(fixture());
 assert.deepEqual(c.symbols.map(s=>[s.id,s.payout]), [[1,3],[2,5],[3,8],[4,10],[5,25],[6,100],[7,250]]);
 assert.equal(c.symbols.find(s=>s.role==='wild').id,7);
});
test('10 total / 5 lines * 3 = 6 for one orange line',()=>{
 const r=p.evaluatePaylines(fixture(), [0,1,0,0,1,0,0,1,0]);
 assert.equal(r.wins.length,1); assert.equal(r.totalBetMultiplier,.6); assert.equal(r.totalBetMultiplier*10,6);
});
test('Wild substitutes, all Wild takes highest award, each group pays once',()=>{
 const c=fixture(); c.lines=[[1,4,7]];
 assert.equal(p.evaluatePaylines(c,[7,0,0,7,0,0,1,0,0]).wins[0].symbolId,1);
 const r=p.evaluatePaylines(c,[7,0,0,7,0,0,7,0,0]);
 assert.equal(r.wins.length,1); assert.equal(r.wins[0].payout,250);
});
test('full oranges pays five lines without AG4 x10 special rule',()=>{
 const r=p.evaluatePaylines(fixture(),Array(9).fill(1));
 assert.equal(r.wins.length,5);assert.equal(r.totalBetMultiplier,3);assert.equal(r.winningCellIds.length,9);
});
test('uneven columns and arbitrary group lengths are configurable',()=>{
 const c=fixture();c.columnHeights=[3,4,3];c.lines=[[3,7,10],[1,2]];
 const b=Array(10).fill(0);for(const id of [3,7,10])b[id-1]=2;
 assert.equal(p.evaluatePaylines(c,b).wins[0].payout,5);
 assert.deepEqual(p.gridCells(c.columnHeights).at(-1),{id:10,column:2,row:2});
});
test('rejects invalid shape, duplicate/out-of-range groups and symbol IDs',()=>{
 for(const change of [c=>c.columnHeights=[3,0],c=>c.lines=[[1,1,2]],c=>c.lines=[[1,4,10]],c=>c.lines=[[1,4,7],[7,4,1]],c=>c.symbols[1].id=1,c=>c.symbols[0].payout=-1]) {
  const c=fixture();change(c);assert.throws(()=>p.validatePaylines(c));
 }
 assert.throws(()=>p.evaluatePaylines(fixture(),[1]));
 assert.throws(()=>p.evaluatePaylines(fixture(),Array(9).fill(99)));
});
test('random generator respects zero weights and deterministic random source',()=>{
 const c=fixture();c.symbols.forEach(s=>s.weight=s.id===2?1:0);
 assert.deepEqual(p.generatePaylineBoard(c,()=>0.5),Array(9).fill(2));
 c.symbols.forEach(s=>s.weight=0);assert.throws(()=>p.validatePaylines(c));
});

test('payline file service round trips with revision conflict protection and leaves cascade files alone',async(t)=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path');
 const {createPaylineStore}=await import('../server/game-files.mjs');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'payline-store-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'AG4'));await fs.writeFile(path.join(root,'AG4/paylines.json'),JSON.stringify(fixture()));
 await fs.writeFile(path.join(root,'AG4/board.json'),'untouched');
 const store=createPaylineStore(root,p.validatePaylines),doc=await store.read('AG4');
 const changed=structuredClone(doc.file);changed.columnHeights=[3,4,3];changed.lines=[[1,5,9]];
 const next=await store.save('AG4',doc.revision,changed);assert.notEqual(next.revision,doc.revision);
 assert.deepEqual((await store.read('AG4')).file,changed);
 await assert.rejects(()=>store.save('AG4',doc.revision,doc.file),e=>e.status===409);
 assert.equal(await fs.readFile(path.join(root,'AG4/board.json'),'utf8'),'untouched');
 await assert.rejects(()=>store.save('AG4',next.revision,{...changed,lines:[[99,1]]}),e=>e.status===422);
});
