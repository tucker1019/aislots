import {validateRabbitParameters,validateRabbitTable,type Parameters,type WeightTable} from './model';
import {createAliasSampler,seededRandom} from './simulation';
export interface RabbitRound {baseDue:number;basePaid:number;specialDue:number[];specialPaid:number[];triggered:boolean;totalPaid:number;capped:boolean}
export class RabbitSimulator {
 readonly random:()=>number;private baseSample:ReturnType<typeof createAliasSampler>;private freeSample:ReturnType<typeof createAliasSampler>;
 count=0;mean=0;m2=0;baseSum=0;freeSum=0;hits=0;triggers=0;caps=0;specialSpins=0;
 constructor(base:WeightTable,free:WeightTable,readonly p:Parameters,seed:number,random?:()=>number){
  validateRabbitParameters(p);validateRabbitTable(base);validateRabbitTable(free);this.random=random??seededRandom(seed);this.baseSample=createAliasSampler(base.rows,base.totalWeight,10);this.freeSample=createAliasSampler(free.rows,free.totalWeight,10);
 }
 round():RabbitRound {
  const random=this.random,baseDue=random()<this.p.baseSpinWinProbability?this.baseSample(random):0,basePaid=Math.min(5000,baseDue);
  let totalPaid=basePaid;const triggered=totalPaid<5000&&random()<this.p.freeSpinTriggerProbability,specialDue:number[]=[],specialPaid:number[]=[];
  if(triggered)for(let i=0;i<8&&totalPaid<5000;i++){const due=random()<this.p.freeSpinWinProbability?this.freeSample(random):0,paid=Math.min(5000-totalPaid,due);specialDue.push(due);specialPaid.push(paid);totalPaid+=paid;}
  return {baseDue,basePaid,specialDue,specialPaid,triggered,totalPaid,capped:totalPaid>=5000};
 }
 step(){const r=this.round();this.count++;const delta=r.totalPaid-this.mean;this.mean+=delta/this.count;this.m2+=delta*(r.totalPaid-this.mean);this.baseSum+=r.basePaid;this.freeSum+=r.totalPaid-r.basePaid;this.hits+=Number(r.totalPaid>0);this.triggers+=Number(r.triggered);this.caps+=Number(r.capped);this.specialSpins+=r.specialPaid.length;}
 result(){const n=this.count;return {count:n,totalRtp:this.mean,baseRtp:n?this.baseSum/n:0,freeRtp:n?this.freeSum/n:0,standardError:n>1?Math.sqrt(this.m2/(n-1)/n):0,hitProbability:n?this.hits/n:0,triggers:this.triggers,capCount:this.caps,specialSpins:this.specialSpins};}
}
