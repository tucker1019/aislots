import {evaluateFortuneTiger,runFortuneTigerRound,type TigerRound} from './fortuneTiger';
import {validatePaylines,gridCells,type PaylineConfig} from './paylines';
import {seededRandom} from './simulation';
import type {WeightRow} from './model';
export type TigerMode='base'|'free';
/** Stages contain zero-based position/symbol pairs. Ordinary holes are intentionally unspecified. */
export interface TigerSkeleton {target:number|null;stages:number[][]}
export interface TigerSkeletonOptions {mode:TigerMode;count:number;seed:number;perMultiplier:number;maxRetained:number}
export interface TigerSkeletonStats {generated:number;wins:number;losses:number;retained:number;duplicates:number;capacitySkipped:number;bytes:number}
export interface TigerSkeletonLibrary {version:1;format:'payline-skeleton-v1';mode:TigerMode;config:PaylineConfig;options:TigerSkeletonOptions;stats:TigerSkeletonStats;buckets:Record<string,TigerSkeleton[]>;partial:boolean}
const MAX_BYTES=24*1024*1024;
function ensure(v:unknown,message='骨架格式或倍率不一致。'):asserts v {if(!v)throw new Error(message);}
export function inspectTigerSkeleton(data:TigerSkeleton,c:PaylineConfig,mode:TigerMode){
 validatePaylines(c);ensure(mode==='base'||mode==='free');const size=gridCells(c.columnHeights).length;
 ensure(data&&Object.keys(data).every(key=>['target','stages'].includes(key))&&Array.isArray(data.stages)&&data.stages.length>0&&data.stages.length<=size+1);
 const ids=new Set(c.symbols.map(s=>s.id)),board=Array<number>(size).fill(0),boards:number[][]=mode==='free'?[[...board]]:[];
 ensure(mode==='base'?data.target===null&&data.stages.length===1:c.symbols.some(s=>s.id===data.target&&s.role==='normal'));
 const fixed=new Set<number>();
 data.stages.forEach((pairs,stage)=>{
  ensure(Array.isArray(pairs)&&pairs.length%2===0&&pairs.length<=size*2);
  for(let i=0;i<pairs.length;i+=2){const pos=pairs[i],id=pairs[i+1];ensure(Number.isSafeInteger(pos)&&pos>=0&&pos<size&&Number.isSafeInteger(id)&&ids.has(id)&&!fixed.has(pos));ensure(mode==='base'||id===data.target);board[pos]=id;fixed.add(pos);}
  boards.push([...board]);
  if(mode==='free'){const full=fixed.size===size,last=stage===data.stages.length-1;ensure(last?(full||pairs.length===0):!full&&pairs.length>0,'重转骨架须以填满或无新增结束，不能修改锁定格。');}
 });
 const result=evaluateFortuneTiger(c,board);
 if(mode==='base')ensure([...fixed].every(pos=>result.winningCellIds.includes(pos+1)),'普通骨架只固定参与中奖的图标。');
 const raw=result.rawPayout*result.bonusMultiplier;
 return {key:String(Number(raw.toPrecision(14))),multiplier:raw/c.lines.length,boards,result};
}
export function encodeTigerSkeleton(round:TigerRound):TigerSkeleton {
 if(round.mode==='normal'){const winning=new Set(round.result.winningCellIds);return {target:null,stages:[round.frames[0].board.flatMap((id,pos)=>winning.has(pos+1)?[pos,id]:[])]};}
 return {target:round.targetSymbolId,stages:round.frames.slice(1).map(f=>f.addedCellIds.flatMap(id=>[id-1,f.board[id-1]]))};
}
export function validateTigerSkeletonOptions(o:TigerSkeletonOptions){ensure(o&&(o.mode==='base'||o.mode==='free')&&Number.isSafeInteger(o.count)&&o.count>=1&&o.count<=100_000_000&&Number.isSafeInteger(o.seed)&&o.seed>=0&&o.seed<=0xffffffff&&Number.isSafeInteger(o.perMultiplier)&&o.perMultiplier>=1&&o.perMultiplier<=10000&&Number.isSafeInteger(o.maxRetained)&&o.maxRetained>=1&&o.maxRetained<=20000,'生成参数：局数 1～1亿，种子 uint32，每倍率 1～10000 条，最多保留 20000 条。');}
export class TigerSkeletonGenerator {
 readonly config:PaylineConfig;readonly options:TigerSkeletonOptions;
 readonly stats:TigerSkeletonStats={generated:0,wins:0,losses:0,retained:0,duplicates:0,capacitySkipped:0,bytes:0};
 private buckets:Record<string,TigerSkeleton[]>={};private seen=new Set<string>();private random:()=>number;
 constructor(c:PaylineConfig,o:TigerSkeletonOptions){validatePaylines(c);ensure(c.feature,'请配置 AG4 骨架生成规则。');validateTigerSkeletonOptions(o);this.config=structuredClone(c);this.options={...o};this.random=seededRandom(o.seed);}
 get done(){return this.stats.generated>=this.options.count;}
 step(){if(this.done)return;const round=runFortuneTigerRound(this.config,BigInt(this.config.lines.length)*100n,this.random,this.options.mode),skeleton=encodeTigerSkeleton(round),key=String(Number((round.result.rawPayout*round.result.bonusMultiplier).toPrecision(14))),positive=round.result.rawPayout>0;
  this.stats.generated++;if(positive)this.stats.wins++;else this.stats.losses++;
  const encoded=JSON.stringify(skeleton),signature=`${key}:${encoded}`;if(this.seen.has(signature)){this.stats.duplicates++;return;}
  const bytes=new TextEncoder().encode(encoded).length;
  if(this.stats.retained>=this.options.maxRetained||(this.buckets[key]?.length??0)>=this.options.perMultiplier||this.stats.bytes+bytes>MAX_BYTES){this.stats.capacitySkipped++;return;}
  const inspected=inspectTigerSkeleton(skeleton,this.config,this.options.mode);ensure(inspected.key===key,'骨架裁剪后倍率发生变化。');
  (this.buckets[key]??=[]).push(skeleton);this.seen.add(signature);this.stats.retained++;this.stats.bytes+=bytes;
 }
 result():TigerSkeletonLibrary{return structuredClone({version:1,format:'payline-skeleton-v1',mode:this.options.mode,config:this.config,options:this.options,stats:this.stats,buckets:this.buckets,partial:!this.done});}
}
export function tigerCoverage(r:TigerSkeletonLibrary,rows:WeightRow[]){const required=[...new Set(rows.filter(([m,w])=>m>0&&w>0).map(([m])=>String(Number(m.toPrecision(14)))))],missing=required.filter(key=>!r.buckets[key]?.length);return {required:required.length,covered:required.length-missing.length,missing};}
export function validateTigerSkeletonLibrary(value:unknown,c:PaylineConfig):TigerSkeletonLibrary{
 ensure(value&&typeof value==='object');const r=value as TigerSkeletonLibrary;ensure(r.version===1&&r.format==='payline-skeleton-v1'&&r.mode===r.options?.mode);validateTigerSkeletonOptions(r.options);ensure(JSON.stringify(r.config)===JSON.stringify(c),'骨架配置已经改变，请重新生成。');
 const stats=r.stats;ensure(stats&&Object.values(stats).every(n=>Number.isSafeInteger(n)&&n>=0)&&stats.generated>0&&stats.generated<=r.options.count&&stats.wins+stats.losses===stats.generated&&stats.retained+stats.duplicates+stats.capacitySkipped===stats.generated&&stats.retained<=r.options.maxRetained&&stats.bytes<=MAX_BYTES&&r.partial===(stats.generated<r.options.count));
 ensure(r.buckets&&typeof r.buckets==='object'&&!Array.isArray(r.buckets));let retained=0,bytes=0;const seen=new Set<string>();
 for(const [key,list] of Object.entries(r.buckets)){ensure(Array.isArray(list)&&list.length>0&&list.length<=r.options.perMultiplier);for(const s of list){ensure(inspectTigerSkeleton(s,c,r.mode).key===key);const data=JSON.stringify(s),signature=`${key}:${data}`;ensure(!seen.has(signature));seen.add(signature);retained++;bytes+=new TextEncoder().encode(data).length;}}
 ensure(retained===stats.retained&&retained>0&&bytes===stats.bytes);return r;
}
