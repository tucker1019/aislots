// Fixtures come from the actual math checker; no duplicated payout algorithm.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../slot_math/package.json',import.meta.url)),ts=require('typescript');
function load(url){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',code)(p=>load(new URL(p+'.ts',url)),m.exports,m);return m.exports;}
const rabbit=load(new URL('../../slot_math/src/domain/fortuneRabbit.ts',import.meta.url));
const config=JSON.parse(fs.readFileSync(new URL('../../game_configs/AG5/paylines.json',import.meta.url)));
const boards=[
 ['base',Array(10).fill(0)],['base',Array(10).fill(7)],['base',[6,11,12,6,13,14,15,6,0,0]],
 ['base',[7,0,0,7,0,0,0,6,0,0]],['base',[7,0,0,7,0,0,0,7,0,0]],
 ['free',[11,12,13,0,0,0,0,0,0,0]],['free',[14,15,0,0,0,0,0,0,0,0]],
 ['free',[11,12,13,14,15,16,0,0,0,0]],['free',Array(10).fill(19)],
];
let seed=1018;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(const mode of ['base','free'])for(let i=0;i<100;i++)boards.push([mode,rabbit.generateRabbitBoard(config,mode,random)]);
const cases=boards.map(([mode,board])=>{
 const e=rabbit.evaluateRabbit(config,board,mode);
 return {mode,board,raw:e.rawPayout,line:e.linePayout,reward:e.rewardPayout,winningCellIds:e.winningPositions.map(p=>p+1),wins:e.wins.map(w=>({line:w.line,symbolId:w.symbolId,payout:w.payout,cellIds:w.positions.map(p=>p+1)})),stake:123,win:String(BigInt(e.rawPayout)*123n/10n)};
});
const samples=[
 ['base',{cells:[0,6,3,6,7,6]}],['base',{cells:[1,7,4,7,0,6,7,6,5,6,9,6]}],
 ['base',{cells:[0,6,3,6,7,6,9,2]}],['base',{cells:[0,6,0,6]}],
 ['free',{cells:[0,11,1,11,2,11,3,11,4,11]}],['free',{cells:[0,11,1,11]}],
 ['free',{cells:[0,6,3,6,7,6]}],
];
const skeletonCases=samples.map(([mode,skeleton])=>{
 try{const e=rabbit.inspectRabbitSkeleton(skeleton,config,mode);const board=rabbit.fillRabbitSkeleton(skeleton,config,mode,()=>0);return {mode,skeleton,valid:true,key:e.key,board};}catch{return {mode,skeleton,valid:false};}
});
fs.writeFileSync(new URL('../testdata/ag5-parity.json',import.meta.url),JSON.stringify({source:'slot_math/src/domain/fortuneRabbit.ts',cases,skeletonCases},null,2)+'\n');
