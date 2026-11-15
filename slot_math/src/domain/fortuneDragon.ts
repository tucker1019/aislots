import type {WeightRow} from './model';
import {seededRandom} from './simulation';
export type DragonMode='base'|'free';
export interface DragonConfig {version:1;ruleType:'fortune_dragon_v1';columnHeights:number[];lines:number[][];symbols:{id:number;name:string;role:'normal'|'wild';payout:number;weight:number}[]}
export interface DragonSkeleton {cells:number[]}
export interface DragonOptions {mode:DragonMode;count:number;seed:number;perMultiplier:number;maxRetained:number}
export interface DragonLibrary {version:1;format:'dragon-skeleton-v1';mode:DragonMode;config:DragonConfig;options:DragonOptions;targets:number[];stats:{generated:number;retained:number;duplicates:number;rejected:number;capacitySkipped:number;bytes:number};buckets:Record<string,DragonSkeleton[]>;partial:boolean}
const LINES=[[2,5,8],[1,4,7],[3,6,9],[1,5,9],[3,5,7]],PAYOUTS=[0,2,3,5,10,25,50,100],MAX_BYTES=24*1024*1024;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function ensure(v:unknown,message='金龙配置或骨架格式无效。'):asserts v {if(!v)throw Error(message);}
function keys(v:object,allowed:string[]){ensure(Object.keys(v).every(k=>allowed.includes(k)));}
export function validateDragonConfig(value:unknown):DragonConfig {
 ensure(object(value));keys(value,['version','ruleType','columnHeights','lines','symbols']);
 const c=value as unknown as DragonConfig;
 ensure(c.version===1&&c.ruleType==='fortune_dragon_v1'&&JSON.stringify(c.columnHeights)==='[3,3,3]'&&JSON.stringify(c.lines)===JSON.stringify(LINES),'金龙固定三列三行、五条线。');
 ensure(Array.isArray(c.symbols)&&c.symbols.length===7);
 c.symbols.forEach((s,i)=>{ensure(object(s));keys(s,['id','name','role','payout','weight']);ensure(s.id===i+1&&typeof s.name==='string'&&s.name.trim().length>0&&s.name.length<=40&&s.role===(i===6?'wild':'normal')&&s.payout===PAYOUTS[i+1]&&Number.isFinite(s.weight)&&s.weight>0&&s.weight<=1e9,'七种图标、赔付和百搭规则固定；形态权重须为正数。');});
 return c;
}
function raw(board:number[]){
 let total=0;
 for(const [a,b,c] of LINES){const x=board[a-1],y=board[b-1],z=board[c-1];if(!x||!y||!z)continue;const id=x!==7?x:y!==7?y:z;if((x===id||x===7)&&(y===id||y===7)&&(z===id||z===7))total+=PAYOUTS[id];}
 return total;
}
function evaluate(board:number[]){
 const wins:{line:number;symbolId:number;payout:number;positions:number[]}[]=[];
 LINES.forEach((line,i)=>{const ids=line.map(p=>board[p-1]);if(ids.includes(0))return;const id=ids.find(id=>id!==7)||7;if(ids.every(v=>v===id||v===7))wins.push({line:i+1,symbolId:id,payout:PAYOUTS[id],positions:line.map(p=>p-1)});});
 const rawPayout=wins.reduce((sum,w)=>sum+w.payout,0),winningPositions=[...new Set(wins.flatMap(w=>w.positions))].sort((a,b)=>a-b);
 return {rawPayout,totalBetMultiplier:rawPayout/5,wins,winningPositions};
}
export function evaluateDragon(config:DragonConfig,board:number[],mode:DragonMode='base'){
 validateDragonConfig(config);ensure(mode==='base'||mode==='free');ensure(Array.isArray(board)&&board.length===9&&board.every(id=>Number.isSafeInteger(id)&&id>=0&&id<=7),'金龙盘面须为九格，空白为0，符号为1～7。');
 
 return evaluate(board);
}
export function dragonSkeleton(config:DragonConfig,board:number[],mode:DragonMode):DragonSkeleton {
 const result=evaluateDragon(config,board,mode),fixed=new Set(result.winningPositions);
 return {cells:[...fixed].sort((a,b)=>a-b).flatMap(i=>[i,board[i]])};
}
export function inspectDragonSkeleton(s:DragonSkeleton,c:DragonConfig,mode:DragonMode){
 ensure(object(s));keys(s,['cells']);ensure(Array.isArray(s.cells)&&s.cells.length>0&&s.cells.length<=18&&s.cells.length%2===0);
 const board=Array<number>(9).fill(0),seen=new Set<number>();
 for(let i=0;i<s.cells.length;i+=2){const p=s.cells[i],id=s.cells[i+1];ensure(Number.isSafeInteger(p)&&p>=0&&p<9&&!seen.has(p)&&Number.isSafeInteger(id)&&id>=1&&id<=7);board[p]=id;seen.add(p);}
 const result=evaluateDragon(c,board,mode),necessary=new Set(result.winningPositions);
 ensure(result.rawPayout>0&&necessary.size===seen.size&&[...seen].every(i=>necessary.has(i)),'骨架只保留中奖必要格。');
 validateFillable(board);return {...result,board,key:String(result.rawPayout)};
}
function validateFillable(board:number[]){for(const line of LINES){const ids=line.map(p=>board[p-1]);ensure(!(ids.includes(0)&&ids.filter(id=>id===7).length===2),'两个百搭加空格无法补成非中奖线。');}}
function unit(random:()=>number){const n=random();ensure(Number.isFinite(n)&&n>=0&&n<1,'随机源须为[0,1)。');return n;}
function pick<T extends {weight:number}>(rows:T[],random:()=>number){ensure(rows.length>0,'没有可一次补齐的合法图标。');let n=unit(random)*rows.reduce((s,r)=>s+r.weight,0);for(const r of rows){n-=r.weight;if(n<0)return r;}return rows.at(-1)!;}
/** Six ordinary symbols, at most five lines per cell: filtering leaves a legal choice.
 * Filled cells are ordinary symbols, so no later step creates two-Wild dead ends.
 * Every hole consumes exactly one draw; no retries, backtracking or skeleton changes.
 */
function fill(c:DragonConfig,board:number[],random:()=>number){
 validateFillable(board);
 for(let pos=0;pos<9;pos++)if(board[pos]===0){
  const allowed=c.symbols.filter(s=>s.role==='normal'&&LINES.every(line=>{
   if(!line.includes(pos+1))return true;
   const ids=line.map(p=>p===pos+1?s.id:board[p-1]);if(ids.includes(0))return true;
   const normal=ids.filter(id=>id!==7);return new Set(normal).size>1;
  }));board[pos]=pick(allowed,random).id;
 }
}
export function fillDragonSkeleton(s:DragonSkeleton,c:DragonConfig,mode:DragonMode,random:()=>number=Math.random){
 const before=inspectDragonSkeleton(s,c,mode),board=[...before.board];fill(c,board,random);const after=evaluate(board);
 ensure(JSON.stringify({...before,board:undefined,key:undefined})===JSON.stringify(after),'一次补齐改变了奖金。');return board;
}
export function generateDragonLoss(c:DragonConfig,mode:DragonMode,random:()=>number=Math.random){
 validateDragonConfig(c);ensure(mode==='base'||mode==='free');const board=Array<number>(9).fill(0);fill(c,board,random);ensure(raw(board)===0);return board;
}
export function dragonCoverage(library:{buckets:Record<string,DragonSkeleton[]>},rows:WeightRow[]){const required=[...new Set(rows.filter(([m,w])=>m>0&&w>0).map(([m])=>String(m)))],missing=required.filter(m=>!library.buckets[m]?.length);return {required:required.length,covered:required.length-missing.length,missing};}
function validateOptions(o:DragonOptions){ensure(object(o));keys(o,['mode','count','seed','perMultiplier','maxRetained']);ensure((o.mode==='base'||o.mode==='free')&&Number.isSafeInteger(o.count)&&o.count>=1&&o.count<=50_000_000&&Number.isSafeInteger(o.seed)&&o.seed>=0&&o.seed<=0xffffffff&&Number.isSafeInteger(o.perMultiplier)&&o.perMultiplier>=1&&o.perMultiplier<=1000&&Number.isSafeInteger(o.maxRetained)&&o.maxRetained>=1&&o.maxRetained<=20000,'生成次数1～5000万、种子uint32、每倍率1～1000条、总容量1～20000条。');}
export class DragonSkeletonGenerator {
 readonly config:DragonConfig;readonly options:DragonOptions;readonly targets:number[];readonly buckets:Record<string,DragonSkeleton[]>={};
 readonly stats={generated:0,retained:0,duplicates:0,rejected:0,capacitySkipped:0,bytes:0};
 private cursor=0;private seen=new Set<string>();private wanted:Set<number>;private order:number[];private coveredAt=-1;
 constructor(c:DragonConfig,o:DragonOptions,targets:number[]){validateDragonConfig(c);validateOptions(o);ensure(Array.isArray(targets)&&targets.length>0&&targets.length<=500&&targets.every(m=>Number.isSafeInteger(m)&&m>0&&m<=500));this.config=structuredClone(c);this.options={...o};this.targets=[...new Set(targets)].sort((a,b)=>a-b);this.wanted=new Set(this.targets);
  const random=seededRandom(o.seed),remaining=[...c.symbols];this.order=[];while(remaining.length){const s=pick(remaining,random);this.order.push(s.id);remaining.splice(remaining.indexOf(s),1);}
 }
 get done(){return this.stats.generated>=this.options.count||this.cursor>=7**9||this.stats.retained>=this.options.maxRetained||(this.coveredAt>=0&&this.stats.generated>=this.coveredAt+100000);}
 step(){
  if(this.done)return;let code=this.cursor++;const board=Array<number>(9);for(let pos=0;pos<9;pos++){board[pos]=this.order[code%7];code=Math.floor(code/7);}this.stats.generated++;
  const payout=raw(board),key=String(payout);if(!this.wanted.has(payout)){this.stats.rejected++;return;}
  if((this.buckets[key]?.length??0)>=this.options.perMultiplier){this.stats.capacitySkipped++;return;}
  const skeleton=dragonSkeleton(this.config,board,this.options.mode),encoded=JSON.stringify(skeleton),signature=key+':'+encoded;
  if(this.seen.has(signature)){this.stats.duplicates++;return;}
  const bytes=new TextEncoder().encode(encoded).length;if(this.stats.bytes+bytes>MAX_BYTES){this.stats.capacitySkipped++;return;}
  inspectDragonSkeleton(skeleton,this.config,this.options.mode);(this.buckets[key]??=[]).push(skeleton);this.seen.add(signature);this.stats.retained++;this.stats.bytes+=bytes;
  if(this.coveredAt<0&&this.targets.every(m=>this.buckets[m]?.length))this.coveredAt=this.stats.generated;
 }
 result(stopped=false):DragonLibrary{return structuredClone({version:1,format:'dragon-skeleton-v1',mode:this.options.mode,config:this.config,options:this.options,targets:this.targets,stats:this.stats,buckets:this.buckets,partial:stopped&&!this.done});}
}
export function validateDragonLibrary(value:unknown,c:DragonConfig):DragonLibrary {
 ensure(object(value));keys(value,['version','format','mode','config','options','targets','stats','buckets','partial','gameRevision']);
 const r=value as unknown as DragonLibrary;ensure(r.version===1&&r.format==='dragon-skeleton-v1'&&r.mode===r.options?.mode&&JSON.stringify(r.config)===JSON.stringify(c),'骨架配置已改变，请重新生成。');validateDragonConfig(c);validateOptions(r.options);
 ensure(Array.isArray(r.targets)&&r.targets.length>0&&r.targets.length<=500&&new Set(r.targets).size===r.targets.length&&r.targets.every(m=>Number.isSafeInteger(m)&&m>0&&m<=500));
 const stats=r.stats;ensure(object(stats));keys(stats,['generated','retained','duplicates','rejected','capacitySkipped','bytes']);ensure(Object.keys(stats).length===6&&Object.values(stats).every(n=>Number.isSafeInteger(n)&&n>=0)&&stats.generated>0&&stats.generated<=r.options.count&&stats.retained>0&&stats.retained<=r.options.maxRetained&&stats.retained+stats.duplicates+stats.rejected+stats.capacitySkipped===stats.generated&&stats.bytes<=MAX_BYTES&&typeof r.partial==='boolean');
 ensure(object(r.buckets));let retained=0,bytes=0;const seen=new Set<string>();
 for(const [key,list] of Object.entries(r.buckets)){ensure(r.targets.includes(Number(key))&&String(Number(key))===key&&Array.isArray(list)&&list.length>0&&list.length<=r.options.perMultiplier);for(const s of list){ensure(inspectDragonSkeleton(s,c,r.mode).key===key);const encoded=JSON.stringify(s),signature=key+':'+encoded;ensure(!seen.has(signature));seen.add(signature);bytes+=new TextEncoder().encode(encoded).length;retained++;}}
 ensure(retained===stats.retained&&bytes===stats.bytes);return r;
}
