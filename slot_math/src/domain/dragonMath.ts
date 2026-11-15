import type {WeightRow} from './model';

export type DragonBetMode='normal'|'boost';
export interface DragonNumerical {
  normalMultipliers:WeightRow[];
  freeMultiplierCounts:WeightRow[];
  freeMultipliers:WeightRow[];
  boost:{base:WeightRow[];free:WeightRow[];baseWinProbability:number;freeWinProbability:number};
}
export interface DragonFiles {
  base:WeightRow[];free:WeightRow[];
  config:{version:1;ruleType:string;parameters:{lineCount:number;baseSpinWinProbability:number;freeSpinWinProbability:number;freeSpinTriggerProbability:number;featureSpins?:number;maxWinMultiplier?:number};simulationOptions:{paidSpins:number;seed:number|null};dragon?:DragonNumerical};
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function ensure(v:unknown,message='金龙数值配置无效。'):asserts v{if(!v)throw Error(message);}
function only(v:object,keys:string[]){ensure(Object.keys(v).every(k=>keys.includes(k)),'金龙配置包含未知字段。');}
export function validateDragonTable(rows:WeightRow[],allowed?:number[]){
  ensure(Array.isArray(rows)&&rows.length>0&&rows.length<=500);const seen=new Set<number>();let total=0;
  for(const row of rows){ensure(Array.isArray(row)&&row.length===2);const [m,w]=row;ensure(Number.isSafeInteger(m)&&m>=1&&m<=500&&!seen.has(m)&&Number.isFinite(w)&&w>=0&&w<=1e12&&(!allowed||allowed.includes(m)),'倍率表须为不重复的正整数原始倍率与非负权重；空奖由中奖率控制。');seen.add(m);total+=w;}
  ensure(total>0,'倍率表至少有一个正权重。');
}
export function validateDragonFiles(value:unknown):DragonFiles{
  ensure(object(value));only(value,['base','free','config']);ensure(object(value.config));const c=value.config;only(c,['version','ruleType','parameters','simulationOptions','dragon']);
  ensure(c.version===1&&c.ruleType==='fortune_dragon_v1'&&object(c.parameters)&&object(c.dragon)&&object(c.simulationOptions));
  const p=c.parameters,d=c.dragon;only(p,['lineCount','baseSpinWinProbability','freeSpinWinProbability','freeSpinTriggerProbability','featureSpins','maxWinMultiplier']);only(d,['normalMultipliers','freeMultiplierCounts','freeMultipliers','boost']);
  ensure(p.lineCount===5&&p.featureSpins===8&&p.maxWinMultiplier===2500,'金龙固定五线、八次免费转、实际投注2500倍封顶。');
  ensure([p.baseSpinWinProbability,p.freeSpinWinProbability,p.freeSpinTriggerProbability].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1),'中奖率和触发率须在0～100%。');
  validateDragonTable(value.base as WeightRow[]);validateDragonTable(value.free as WeightRow[]);
  validateDragonTable(d.normalMultipliers as WeightRow[],[1,2,5,10]);validateDragonTable(d.freeMultiplierCounts as WeightRow[],[2,3]);validateDragonTable(d.freeMultipliers as WeightRow[],[2,5,10]);
  ensure(object(d.boost));only(d.boost,['base','free','baseWinProbability','freeWinProbability']);validateDragonTable(d.boost.base as WeightRow[]);validateDragonTable(d.boost.free as WeightRow[]);
  ensure([d.boost.baseWinProbability,d.boost.freeWinProbability].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1));
  only(c.simulationOptions,['paidSpins','seed']);const {paidSpins,seed}=c.simulationOptions;ensure(Number.isSafeInteger(paidSpins)&&(paidSpins as number)>=1&&(paidSpins as number)<=1e9&&(seed===null||Number.isSafeInteger(seed)&&(seed as number)>=0&&(seed as number)<=0xffffffff),'模拟次数或种子无效。');
  return value as unknown as DragonFiles;
}
export function dragonProfile(f:DragonFiles,mode:DragonBetMode){
  ensure(mode==='normal'||mode==='boost');const d=f.config.dragon!;
  return {base:mode==='normal'?f.base:d.boost.base,free:mode==='normal'?f.free:d.boost.free,baseHit:mode==='normal'?f.config.parameters.baseSpinWinProbability:d.boost.baseWinProbability,freeHit:mode==='normal'?f.config.parameters.freeSpinWinProbability:d.boost.freeWinProbability,divisor:mode==='normal'?5:25};
}
export function dragonTargets(f:DragonFiles,mode:'base'|'free'){return [...new Set([...f[mode],...f.config.dragon!.boost[mode]].filter(([m,w])=>m>0&&w>0).map(([m])=>m))].sort((a,b)=>a-b);}
export function normalized(rows:WeightRow[]):WeightRow[]{const total=rows.reduce((s,r)=>s+r[1],0);return rows.filter(r=>r[1]>0).map(([m,w])=>[m,w/total]);}
export function dragonFreeMultiplierDistribution(d:DragonNumerical):WeightRow[]{
  const sums=new Map<number,number>(),multipliers=normalized(d.freeMultipliers);
  for(const [count,p] of normalized(d.freeMultiplierCounts)){
    let dist=new Map([[0,p]]);
    for(let i=0;i<count;i++){const next=new Map<number,number>();for(const [a,x] of dist)for(const [b,y] of multipliers)next.set(a+b,(next.get(a+b)??0)+x*y);dist=next;}
    for(const [m,w] of dist)sums.set(m,(sums.get(m)??0)+w);
  }
  return [...sums].sort((a,b)=>a[0]-b[0]);
}
function stageDistribution(rows:WeightRow[],hit:number,multipliers:WeightRow[]){
  const dist=new Float64Array(15001);dist[0]=1-hit;
  for(const [m,w] of normalized(rows))for(const [k,p] of normalized(multipliers))dist[m*k]+=hit*w*p;
  return dist;
}
// Polynomial exponentiation in Fourier space. Padding includes the complete
// eight-spin support, so high awards cannot wrap into low buckets. Only the
// final financial distribution is capped; early stopping gives the same sum.
function fft(re:Float64Array,im:Float64Array,inverse:boolean){
  const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
  for(let len=2;len<=n;len<<=1){const angle=(inverse?2:-2)*Math.PI/len,ur=Math.cos(angle),ui=Math.sin(angle);for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const a=i+j,b=a+len/2,tr=re[b]*wr-im[b]*wi,ti=re[b]*wi+im[b]*wr;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const next=wr*ur-wi*ui;wi=wr*ui+wi*ur;wr=next;}}}
  if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}
}
export function cappedDragonMoments(single:ArrayLike<number>,spins:number,cap:number){
  let max=single.length-1;while(max>0&&!single[max])max--;const support=max*spins;let n=1;while(n<=support)n<<=1;
  const re=new Float64Array(n),im=new Float64Array(n);for(let i=0;i<=max;i++)re[i]=single[i];fft(re,im,false);
  for(let i=0;i<n;i++){const ar=re[i],ai=im[i];let br=1,bi=0;for(let k=0;k<spins;k++){const cr=br*ar-bi*ai;bi=br*ai+bi*ar;br=cr;}re[i]=br;im[i]=bi;}fft(re,im,true);
  let total=0,mean=0,second=0,uncapped=0,capProbability=0;
  for(let i=0;i<=support;i++){const p=Math.max(0,re[i]),paid=Math.min(i,cap);total+=p;mean+=paid*p;second+=paid*paid*p;uncapped+=i*p;if(i>=cap)capProbability+=p;}
  return {mean:mean/total,second:second/total,uncapped:uncapped/total,capProbability:capProbability/total};
}
export function calculateDragonModel(f:DragonFiles,mode:DragonBetMode){
  validateDragonFiles(f);const p=dragonProfile(f,mode),d=f.config.dragon!,trigger=f.config.parameters.freeSpinTriggerProbability,cap=2500*p.divisor;
  const base=cappedDragonMoments(stageDistribution(p.base,p.baseHit,d.normalMultipliers),1,cap),free=cappedDragonMoments(stageDistribution(p.free,p.freeHit,dragonFreeMultiplierDistribution(d)),8,cap);
  const baseRtp=(1-trigger)*base.mean/p.divisor,freeRtp=trigger*free.mean/p.divisor,totalRtp=baseRtp+freeRtp,hitProbability=(1-trigger)*p.baseHit+trigger*(1-(1-p.freeHit)**8),second=((1-trigger)*base.second+trigger*free.second)/(p.divisor**2),totalVariance=Math.max(0,second-totalRtp**2);
  return {baseRtp,freeRtp,totalRtp,hitProbability,totalVariance,standardDeviation:Math.sqrt(totalVariance),baseMean:base.mean/p.divisor,freeMean:free.mean/p.divisor,capProbability:(1-trigger)*base.capProbability+trigger*free.capProbability,capReduction:((1-trigger)*(base.uncapped-base.mean)+trigger*(free.uncapped-free.mean))/p.divisor};
}
