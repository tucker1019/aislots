import type {Parameters,WeightTable} from './model';

export function validateMouseParameters(p:Parameters){
 if(p.lineCount!==5||p.freeSpinWinProbability!==1||![p.baseSpinWinProbability,p.freeSpinTriggerProbability].every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error('金鼠固定五线、特殊整段中奖率100%；普通中奖率和触发率须在0～100%。');
}
export function validateMouseTable(table:WeightTable){
 const seen=new Set<number>();
 for(const [m] of table.rows){if(!Number.isSafeInteger(m)||m<=0||m>5000||seen.has(m))throw Error('金鼠表只允许不重复的正整数原始倍率，最大5000；空奖由中奖率控制。');seen.add(m);}
}
export function calculateMouseModel(base:WeightTable,free:WeightTable,p:Parameters){
 validateMouseParameters(p);validateMouseTable(base);validateMouseTable(free);
 const trigger=p.freeSpinTriggerProbability,normalHit=p.baseSpinWinProbability;
 const baseRtp=(1-trigger)*normalHit*base.mean/5,freeRtp=trigger*free.mean/5,totalRtp=baseRtp+freeRtp;
 const second=((1-trigger)*normalHit*base.secondMoment+trigger*free.secondMoment)/25;
 const hitProbability=(1-trigger)*normalHit+trigger;
 return {baseRtp,freeRtp,totalRtp,hitProbability,baseMean:base.mean/5,specialMean:free.mean/5,totalVariance:Math.max(0,second-totalRtp**2),standardDeviation:Math.sqrt(Math.max(0,second-totalRtp**2)),averageWin:hitProbability?totalRtp/hitProbability:0};
}
export function mouseLossExtra(raw:number){return raw<75?1:raw<200?2:raw<500?3:4;}
export const MOUSE_LENGTH_WEIGHTS=[[1,149],[2,600],[3,300],[4,151]] as const;
