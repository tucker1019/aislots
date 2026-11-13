import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/domain/model.ts',import.meta.url),'utf8');const model=await import(`data:text/javascript;base64,${Buffer.from(ts.transpile(source,{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022})).toString('base64')}`);
test('two weight tables, two hit rates and replacing respin trigger determine RTP',()=>{
 assert.equal(typeof model.calculateRespinModel,'function');const base=model.parseWeightTable('[[5,1],[15,1]]'),free=model.parseWeightTable('[[50,1]]');const p={lineCount:5,baseSpinWinProbability:.4,freeSpinWinProbability:.5,freeSpinTriggerProbability:.1};const r=model.calculateRespinModel(base,free,p);assert.ok(Math.abs(r.baseRtp-.72)<1e-12);assert.ok(Math.abs(r.freeRtp-.5)<1e-12);assert.ok(Math.abs(r.totalRtp-1.22)<1e-12);assert.ok(Math.abs(r.hitProbability-.41)<1e-12);
 for(const [trigger,normal,respin] of [[0,.8,0],[1,0,5]]){const v=model.calculateRespinModel(base,free,{...p,freeSpinTriggerProbability:trigger});assert.ok(Math.abs(v.baseRtp-normal)<1e-12);assert.ok(Math.abs(v.freeRtp-respin)<1e-12);}
 assert.throws(()=>model.calculateRespinModel(base,free,{...p,baseSpinWinProbability:2}));
});
test('ordinary table drops unreachable awards without changing the Lua source expectation',()=>{
 const root=new URL('../../game_configs/AG4/',import.meta.url),original=JSON.parse(fs.readFileSync(new URL('lua-1017-source.json',root))),config=JSON.parse(fs.readFileSync(new URL('config.json',root)));
 const base=JSON.parse(fs.readFileSync(new URL('base.json',root))),free=JSON.parse(fs.readFileSync(new URL('free.json',root)));
 const before=model.parseWeightTable(JSON.stringify(original.tables.base.filter(([m])=>m>0))),after=model.parseWeightTable(JSON.stringify(base));assert.equal(base.length,135);assert.equal(free.length,26);assert.ok(base.every(([m])=>m!==420&&m!==430));assert.ok(Math.abs(before.totalWeight-after.totalWeight)<1e-7);assert.ok(Math.abs(before.mean-after.mean)<1e-12);
 for(const kind of ['base','free']){const rows=original.tables[kind],prob=rows.filter(([m])=>m>0).reduce((s,[,w])=>s+w,0)/rows.reduce((s,[,w])=>s+w,0);assert.ok(Math.abs(prob-config.parameters[kind==='base'?'baseSpinWinProbability':'freeSpinWinProbability'])<1e-7);}
 const r=model.calculateRespinModel(model.parseWeightTable(JSON.stringify(base)),model.parseWeightTable(JSON.stringify(free)),config.parameters);assert.ok(Number.isFinite(r.totalRtp));
});

test('regenerated respin table covers only reachable awards and preserves its mean and total RTP',()=>{
 const root=new URL('../../game_configs/AG4/',import.meta.url),original=JSON.parse(fs.readFileSync(new URL('lua-1017-source.json',root))),config=JSON.parse(fs.readFileSync(new URL('config.json',root))),board=JSON.parse(fs.readFileSync(new URL('paylines.json',root)));
 const base=model.parseWeightTable(fs.readFileSync(new URL('base.json',root),'utf8')),free=model.parseWeightTable(fs.readFileSync(new URL('free.json',root),'utf8')),before=model.parseWeightTable(JSON.stringify(original.tables.free.filter(([m])=>m>0)));
 const reachable=new Set();for(const symbol of board.symbols.filter(s=>s.role==='normal'))for(let mask=0;mask<512;mask++){const lines=board.lines.filter(line=>line.every(id=>mask&(1<<(id-1)))).length;reachable.add(symbol.payout*lines*(mask===511?10:1));}
 assert.deepEqual(free.rows.map(([m])=>m).sort((a,b)=>a-b),[...reachable].filter(n=>n>0).sort((a,b)=>a-b));assert.ok(free.rows.every(([,w])=>w>0));
 assert.ok(Math.abs(free.totalWeight-before.totalWeight)<1e-7);assert.ok(Math.abs(free.mean-before.mean)<1e-12);
 const oldRtp=model.calculateRespinModel(base,before,config.parameters),newRtp=model.calculateRespinModel(base,free,config.parameters);assert.ok(Math.abs(newRtp.totalRtp-oldRtp.totalRtp)<1e-12);assert.ok(Math.abs(newRtp.freeRtp-oldRtp.freeRtp)<1e-12);
});
