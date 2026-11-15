import {calculateRespinModel,parseWeightTable} from './model';
import {seededRandom} from './simulation';
import type {GameFiles} from './settings';

export class RespinSimulation {
 readonly theoretical:ReturnType<typeof calculateRespinModel>;
 readonly stats={paidSpins:0,featureSpins:0,wins:0,rawSum:0,rtp:0,hitProbability:0};
 private random:()=>number;private tables:{values:number[];cumulative:number[];total:number}[];
 constructor(readonly files:GameFiles,readonly count:number,seed:number){
  if(!Number.isSafeInteger(count)||count<1||count>1e9||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('模拟局数或种子无效。');
  this.theoretical=calculateRespinModel(parseWeightTable(JSON.stringify(files.base)),parseWeightTable(JSON.stringify(files.free)),files.config.parameters);
  this.random=seededRandom(seed);
  this.tables=[files.base,files.free].map(rows=>{let total=0;const positive=rows.filter(([m,w])=>m>0&&w>0);return {values:positive.map(([m])=>m),cumulative:positive.map(([,w])=>total+=w),total};});
 }
 get done(){return this.stats.paidSpins>=this.count;}
 step(){if(this.done)return;const p=this.files.config.parameters,s=this.stats,feature=this.random()<p.freeSpinTriggerProbability;let raw=0;
  s.paidSpins++;if(feature)s.featureSpins++;
  if(this.random()<(feature?p.freeSpinWinProbability:p.baseSpinWinProbability)){
   const t=this.tables[feature?1:0],cursor=this.random()*t.total;let lo=0,hi=t.values.length-1;
   while(lo<hi){const mid=(lo+hi)>>>1;if(cursor<t.cumulative[mid])hi=mid;else lo=mid+1;}raw=t.values[lo];s.wins++;
  }
  s.rawSum+=raw;s.rtp=s.rawSum/(s.paidSpins*p.lineCount);s.hitProbability=s.wins/s.paidSpins;
 }
}
