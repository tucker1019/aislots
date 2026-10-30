// Run with Node 22 from the repository root. Expected results come from the numerical tool.
import {writeFileSync} from 'node:fs';
import {cascade,library,setup,symbol} from '../../slot_math/tests/helpers/board.mjs';
const c={...setup([2,2,2,2,2]),gold:{columns:[2,3,4],baseProbability:0,freeProbability:0,wildSymbolId:'10'},symbols:[{...symbol('1'),payouts:{3:2}},{...symbol('3'),payouts:{3:1}},{...symbol('2'),payouts:{}},symbol('10','wild',0)]};
const cases=[];
for(const mode of ['base','free'])for(const interior of [false,true]){
 let round=cascade.createCascadeRound(c,()=>0,interior?[['1','3'],['1001','2'],['1','3'],['2','2'],['2','2']]:[['1','2'],['1001','2'],['1','2'],['2','2'],['2','2']],mode);
 const draws=interior?[.99,.99,.99,.99,.99,.99]:[.5,.5,.99,.99,.99];let index=0;
 while(!round.finished&&!round.limited)round=cascade.advanceCascadeRound(round,c,()=>draws[index++]??.99);
 cases.push({mode,interior,skeleton:library.encodeSkeleton(round),key:library.rawMultiplierKey(round,c),wins:round.steps.map(s=>s.wins.map(w=>({symbolId:Number(w.symbolId),cellIds:w.cellIds,ways:w.ways,columns:w.columns}))),transformed:round.steps.map(s=>s.transformedIds)});
}
const {lineCount,...board}=c;board.version=1;
writeFileSync(new URL('../internal/engine/testdata/ts-gold.json',import.meta.url),JSON.stringify({board,cases},null,2)+'\n');
import ts from '../../slot_math/node_modules/typescript/lib/typescript.js';
import {readFileSync} from 'node:fs';
const source=ts.transpile(readFileSync(new URL('../../slot_math/src/domain/model.ts',import.meta.url),'utf8'),{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
const model=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const p={lineCount:20,baseSpinWinProbability:.3,freeSpinWinProbability:.5,freeSpinTriggerProbability:.01,freeSpinGuaranteedWin:true,lossStreakRtpCompensation:true,freeTriggerRtpCompensation:true,freeSpinAwardWeights:[[3,3],[5,1]],freeRetriggerLimit:2,lossStreakRule:{enabled:true,start:3,probability:.4,interval:2,step:.02,cap:9},winStreakRule:{enabled:true,start:2,probability:.25,interval:1,step:.02,cap:5},freeTriggerRule:{enabled:true,start:10,probability:.0102,interval:5,step:.0002,cap:30}};
const base=[[0,2],[2,8],[20,3],[200,1]],free=[[0,2],[4,8],[40,3]];
const basePlan=model.createBasePrizePlan(model.parseWeightTable(JSON.stringify(base)),20),freeTable=model.parseWeightTable(JSON.stringify(free));
const numeric=[];
for(const limit of [0,1,2,null]){const parameters={...p};if(limit===null)delete parameters.freeRetriggerLimit;else parameters.freeRetriggerLimit=limit;const freePlan=model.createFreeTriggerCompensationPlan(freeTable,parameters);
 numeric.push({parameters,base,free,spins:freePlan.session.freeSessionSpins,baseChecks:[0,-1,-3,-5,-9,2,5].map(streak=>({streak,probability:model.streakProbability(parameters,streak),mean:basePlan.profile(model.streakProbability(parameters,streak),parameters.baseSpinWinProbability,streak<0).multiplierMean})),freeChecks:[0,10,15,30].map(misses=>{const trigger=model.freeTriggerProbability(parameters,misses,true);return {misses,trigger,probability:freePlan.at(trigger).freeWinProbability,mean:freePlan.at(trigger).sessionMean}})});
}
writeFileSync(new URL('../internal/engine/testdata/ts-probability.json',import.meta.url),JSON.stringify(numeric,null,2)+'\n');
