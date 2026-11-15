import type {Parameters,WeightTable} from './model';

export const OX_LENGTH_WEIGHTS=[[2,100],[3,500],[4,1000],[5,2500],[6,3200],[7,2300],[8,400]] as const;
export function validateOxParameters(p:Parameters){
 if(p.lineCount!==10||p.freeSpinWinProbability!==1||![p.baseSpinWinProbability,p.freeSpinTriggerProbability].every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error('金牛固定十线、特殊整段中奖率100%；普通中奖率和触发率须在0～100%。');
}
export function validateOxTable(table:WeightTable,mode:'base'|'free'){
 const seen=new Set<number>();
 for(const [m] of table.rows){if(!Number.isSafeInteger(m)||m<=0||m>20000||seen.has(m)||(mode==='free'&&m>10000))throw Error('金牛表须为不重复的正整数原始倍率；普通最大20000，特殊最大10000。空奖由中奖率控制。');seen.add(m);}
}
export function calculateOxModel(base:WeightTable,free:WeightTable,p:Parameters){
 validateOxParameters(p);validateOxTable(base,'base');validateOxTable(free,'free');
 const trigger=p.freeSpinTriggerProbability,hit=p.baseSpinWinProbability;
 const baseRtp=(1-trigger)*hit*base.mean/10,freeRtp=trigger*free.mean/10,totalRtp=baseRtp+freeRtp;
 const second=((1-trigger)*hit*base.secondMoment+trigger*free.secondMoment)/100;
 const hitProbability=(1-trigger)*hit+trigger,variance=Math.max(0,second-totalRtp**2);
 return {baseRtp,freeRtp,totalRtp,hitProbability,baseMean:base.mean/10,specialMean:free.mean/10,totalVariance:variance,standardDeviation:Math.sqrt(variance),averageWin:hitProbability?totalRtp/hitProbability:0};
}
