import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadTypeScript as load} from './helpers/typescript.mjs';

const skeleton=load(new URL('../src/domain/ag11Skeleton.ts',import.meta.url));
const root=new URL('../../game_configs/AG11/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,root)));

test('AG11 developer skeleton fixes winning cells and fills once without extra wins',()=>{
 const config=read('board.json'),rows=read('base.json'),targets=skeleton.ag11Targets(config,'base',rows),target=targets.find(value=>value===0.25);
 assert.equal(target,0.25);
 const generator=new skeleton.Ag11SkeletonGenerator(config,{mode:'base',count:1,perMultiplier:1,maxRetained:1,seed:1026},[target],()=>.2);
 generator.step();const result=generator.result();assert.equal(result.stats.retained,1);const row=result.buckets['0.25'][0];
 const inspected=skeleton.inspectAg11Skeleton(row,config,'base');assert.equal(inspected.rawMultiplier,0.25);
 const filled=skeleton.fillAg11Skeleton(row,config,'base',()=>.4);assert.equal(skeleton.evaluateAg11Board(config,filled).rawMultiplier,0.25);
});

test('AG11 coverage keeps unreachable targets explicit and loss boards are zero',()=>{
 const config=read('board.json'),loss=skeleton.generateAg11Loss(config,'base',()=>.5);assert.equal(skeleton.evaluateAg11Board(config,loss).rawMultiplier,0);
 const rows=read('base.json').slice(0,20),g=new skeleton.Ag11SkeletonGenerator(config,{mode:'base',count:20,perMultiplier:1,maxRetained:20,seed:1},skeleton.ag11Targets(config,'base',rows),()=>.1);for(let i=0;i<20;i++)g.step();const c=skeleton.ag11Coverage(g.result(),rows);assert.equal(c.required,20);assert.ok(c.covered<=20);assert.equal(c.covered+c.missing.length,c.required);
});
