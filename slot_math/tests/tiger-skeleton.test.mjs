import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
function load(url){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',code)(p=>load(new URL(p+'.ts',url)),m.exports,m);return m.exports;}
let lib;try{lib=load(new URL('../src/domain/tigerSkeleton.ts',import.meta.url));}catch(e){if(e.code!=='ENOENT')throw e;lib={};}
const fixture=()=>JSON.parse(fs.readFileSync(new URL('../../game_configs/AG4/paylines.json',import.meta.url)));
test('ordinary skeleton fixes only winning positions, x10 only for identical full grid',()=>{
 assert.equal(typeof lib.inspectTigerSkeleton,'function');const c=fixture(),s={target:null,stages:[[1,1,4,1,7,1]]};const a=lib.inspectTigerSkeleton(s,c,'base');assert.equal(a.key,'3');assert.equal(a.multiplier,.6);
 const full={target:null,stages:[Array.from({length:9},(_,i)=>[i,1]).flat()]};assert.equal(lib.inspectTigerSkeleton(full,c,'base').key,'150');
 assert.throws(()=>lib.inspectTigerSkeleton({target:null,stages:[[0,1,1,2]]},c,'base'));
});
test('respin skeleton stores only newly locked positions and explicit no-growth finish',()=>{
 const c=fixture(),s={target:1,stages:[[1,1,4,1,7,1],[0,1],[]]};const r=lib.inspectTigerSkeleton(s,c,'free');assert.equal(r.key,'3');assert.equal(r.boards.length,4);assert.deepEqual(r.boards.at(-1),r.boards.at(-2));
 for(const bad of [{target:7,stages:[[]]},{target:1,stages:[[1,1],[1,1],[]]},{target:1,stages:[[1,1]]},{target:1,stages:[[],[1,1]]}])assert.throws(()=>lib.inspectTigerSkeleton(bad,c,'free'));
});
test('generation chooses explicit ordinary or respin mode without using analysis trigger probability',()=>{
 const c=fixture();c.feature.fillProbability=1;c.feature.targetWeights=[{symbolId:1,weight:1}];const o={mode:'free',count:10,seed:123,perMultiplier:2,maxRetained:10};const g=new lib.TigerSkeletonGenerator(c,o);while(!g.done)g.step();const r=g.result();assert.equal(r.format,'payline-skeleton-v1');assert.equal(r.stats.generated,10);assert.equal(r.stats.retained,1);assert.ok(r.buckets['150']);assert.equal('betMinor' in r.options,false);assert.equal('winMinor' in r.buckets['150'][0],false);lib.validateTigerSkeletonLibrary(r,c);
 const coverage=lib.tigerCoverage(r,[[3,1],[150,1],[1000,0],[250,1]]);assert.deepEqual(coverage.missing,['3','250']);assert.equal(coverage.covered,1);
 const bad=structuredClone(r);bad.buckets['149']=bad.buckets['150'];delete bad.buckets['150'];assert.throws(()=>lib.validateTigerSkeletonLibrary(bad,c));
});
test('skeleton storage rejects money snapshots and extra full-round fields',()=>{
 const c=fixture();assert.throws(()=>lib.inspectTigerSkeleton({target:null,stages:[[1,1,4,1,7,1]],winMinor:'100'},c,'base'));
});
