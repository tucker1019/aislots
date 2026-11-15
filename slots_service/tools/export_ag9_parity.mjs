// Export deterministic examples from the actual math implementation. Run from
// any cwd with Node 22 and slot_math's existing TypeScript dependency installed.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../slot_math/package.json',import.meta.url));
const ts=require('typescript');
function load(url){
 const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','module',code)(p=>load(new URL(p+'.ts',url)),m.exports,m);
 return m.exports;
}
const tiger=load(new URL('../../slot_math/src/domain/fortuneTiger.ts',import.meta.url));
const skeletons=load(new URL('../../slot_math/src/domain/tigerSkeleton.ts',import.meta.url));
const config=JSON.parse(fs.readFileSync(new URL('../testdata/deployments/2026-11-15-ag9/AG9/paylines.json',import.meta.url)));
const boards=[
 [0,0,0,0,0,0,0,0,0],
 [1,0,0,7,0,0,1,0,0],
 [7,0,0,7,0,0,7,0,0],
 [1,2,3,1,2,3,1,2,3],
 ...Array.from({length:7},(_,i)=>Array(9).fill(i+1)),
];
let cases=boards.map(board=>{
 const result=tiger.evaluateFortuneTiger(config,board),raw=result.rawPayout*result.bonusMultiplier;
 return {board,raw:String(raw),bonus:result.bonusMultiplier,stake:123,win:String(BigInt(raw)*123n/5n),wins:result.wins.map(w=>({...w,payout:String(w.payout)}))};
});
const samples=[
 ['base',{target:null,stages:[[1,1,4,1,7,1]]}],
 ['base',{target:null,stages:[Array.from({length:9},(_,i)=>[i,1]).flat()]}],
 ['free',{target:1,stages:[[1,1,4,1,7,1],[0,1],[]]}],
 ['free',{target:7,stages:[[]]}],
 ['free',{target:1,stages:[[1,1],[1,1],[]]}],
 ['free',{target:1,stages:[[1,1]]}],
 ['free',{target:1,stages:[[],[1,1]]}],
];
const skeletonCases=samples.map(([mode,skeleton])=>{
 try{const r=skeletons.inspectTigerSkeleton(skeleton,config,mode);return {mode,skeleton,valid:true,key:r.key,boards:r.boards};}
 catch{return {mode,skeleton,valid:false};}
});
// Export every retained skeleton and its deterministic, one-pass filled outcome.
const leopard=load(new URL('../../slot_math/src/domain/fortuneLeopard.ts',import.meta.url));
const {seededRandom}=load(new URL('../../slot_math/src/domain/simulation.ts',import.meta.url));
for(const mode of ['base','free']){
 const library=JSON.parse(fs.readFileSync(new URL('../testdata/deployments/2026-11-15-ag9/AG9/'+mode+'-library/library.json',import.meta.url)));
 for(const [key,list] of Object.entries(library))for(const skeleton of list){
  const r=skeletons.inspectTigerSkeleton(skeleton,config,mode);
  skeletonCases.push({mode,skeleton,valid:true,key,boards:r.boards});
  const board=leopard.fillLeopardSkeleton(skeleton,config,mode,seededRandom(cases.length)).at(-1),result=tiger.evaluateFortuneTiger(config,board),raw=result.rawPayout*result.bonusMultiplier;
  cases.push({board,raw:String(raw),bonus:result.bonusMultiplier,stake:123,win:String(BigInt(raw)*123n/5n),wins:result.wins.map(w=>({...w,payout:String(w.payout)}))});
 }
}
for(let seed=0;seed<100;seed++)for(const mode of ['base','free']){
 const board=leopard.generateLeopardLoss(config,mode,seededRandom(seed)).at(-1),r=tiger.evaluateFortuneTiger(config,board);
 cases.push({board,raw:'0',bonus:r.bonusMultiplier,stake:123,win:'0',wins:[]});
}
fs.writeFileSync(new URL('../testdata/ag9-parity.json',import.meta.url),JSON.stringify({source:'slot_math/src/domain/{paylines,fortuneTiger,tigerSkeleton}.ts',cases,skeletonCases},null,2)+'\n');
