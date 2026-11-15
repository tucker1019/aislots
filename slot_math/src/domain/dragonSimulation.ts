import {seededRandom} from './simulation';
import {dragonProfile,validateDragonFiles,type DragonFiles,type DragonBetMode} from './dragonMath';
import type {WeightRow} from './model';
export function dragonPick(rows:WeightRow[],random:()=>number){let n=random()*rows.reduce((s,r)=>s+r[1],0);for(const [m,w] of rows){n-=w;if(n<0)return m;}return rows.at(-1)![0];}
export class DragonSimulator {
 readonly random:()=>number;readonly files:DragonFiles;readonly mode:DragonBetMode;readonly seed:number;
 count=0;triggers=0;hits=0;capCount=0;featureBoards=0;basePaid=0;freePaid=0;sumSquares=0;
 constructor(files:DragonFiles,mode:DragonBetMode,seed:number){validateDragonFiles(files);if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('种子须为uint32。');this.files=structuredClone(files);this.mode=mode;this.seed=seed;this.random=seededRandom(seed);}
 round(){const f=this.files,p=dragonProfile(f,this.mode),d=f.config.dragon!,random=this.random,special=random()<f.config.parameters.freeSpinTriggerProbability;let raw=0,boards=0;const rounds=special?8:1,cap=2500*p.divisor;
  for(let i=0;i<rounds;i++){
   const hit=random()<(special?p.freeHit:p.baseHit),boardRaw=hit?dragonPick(special?p.free:p.base,random):0;
   let multiplier=0;if(special){const count=dragonPick(d.freeMultiplierCounts,random);for(let j=0;j<count;j++)multiplier+=dragonPick(d.freeMultipliers,random);}else multiplier=dragonPick(d.normalMultipliers,random);
   raw=Math.min(cap,raw+boardRaw*multiplier);boards++;if(raw===cap)break;
  }
  return {special,paid:raw/p.divisor,boards,capped:raw===cap};
 }
 step(){const r=this.round();this.count++;this.hits+=Number(r.paid>0);this.capCount+=Number(r.capped);this.sumSquares+=r.paid*r.paid;if(r.special){this.triggers++;this.featureBoards+=r.boards;this.freePaid+=r.paid;}else this.basePaid+=r.paid;}
 result(){const n=this.count,mean=n?(this.basePaid+this.freePaid)/n:0;return {seed:this.seed,count:n,triggers:this.triggers,totalRtp:mean,baseRtp:n?this.basePaid/n:0,freeRtp:n?this.freePaid/n:0,hitProbability:n?this.hits/n:0,capCount:this.capCount,averageFeatureBoards:this.triggers?this.featureBoards/this.triggers:0,standardError:n>1?Math.sqrt(Math.max(0,(this.sumSquares-n*mean*mean)/(n-1))/n):0};}
}
