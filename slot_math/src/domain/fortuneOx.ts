import type {WeightRow} from './model';
import {seededRandom} from './simulation';
export type OxMode='base'|'free';
export interface OxConfig {version:1;ruleType:'fortune_ox_v1';columnHeights:number[];lines:number[][];symbols:{id:number;name:string;role:'normal'|'wild';payout:number;weight:number}[];jackpotRaw:20000;fullBoardMultiplier:10}
export interface OxSkeleton {cells:number[]}
export interface OxOptions {mode:OxMode;count:number;seed:number;perMultiplier:number;maxRetained:number}
export interface OxLibrary {version:1;format:'ox-skeleton-v1';mode:OxMode;config:OxConfig;options:OxOptions;targets:number[];stats:{generated:number;retained:number;duplicates:number;rejected:number;capacitySkipped:number;bytes:number};buckets:Record<string,OxSkeleton[]>;partial:boolean}
const LINES=[[1,4,8],[1,5,8],[1,5,9],[2,5,8],[2,5,9],[2,6,9],[2,6,10],[3,6,9],[3,6,10],[3,7,10]],PAYOUTS=[0,3,5,10,20,50,100,200],MAX_BYTES=24*1024*1024;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function ensure(v:unknown,message='金牛配置或骨架格式无效。'):asserts v {if(!v)throw Error(message);}
function keys(v:object,allowed:string[]){ensure(Object.keys(v).every(k=>allowed.includes(k)));}
export function validateOxConfig(value:unknown):OxConfig {
 ensure(object(value));keys(value,['version','ruleType','columnHeights','lines','symbols','jackpotRaw','fullBoardMultiplier']);
 const c=value as unknown as OxConfig;
 ensure(c.version===1&&c.ruleType==='fortune_ox_v1'&&c.jackpotRaw===20000&&c.fullBoardMultiplier===10&&JSON.stringify(c.columnHeights)==='[3,4,3]'&&JSON.stringify(c.lines)===JSON.stringify(LINES),'金牛固定三列3、4、3格和十线；满盘十倍，全盘百搭原始倍率20000。');
 ensure(Array.isArray(c.symbols)&&c.symbols.length===7);
 c.symbols.forEach((s,i)=>{ensure(object(s));keys(s,['id','name','role','payout','weight']);ensure(s.id===i+1&&typeof s.name==='string'&&s.name.trim().length>0&&s.name.length<=40&&s.role===(i===6?'wild':'normal')&&s.payout===PAYOUTS[i+1]&&Number.isFinite(s.weight)&&s.weight>0&&s.weight<=1e9,'七种图标、赔付和百搭规则固定；形态权重须为正数。');});
 return c;
}
const SIDES=[0,1,2,7,8,9],CENTER=[3,4,5,6];
function fullSymbol(board:number[]){if(board.includes(0))return 0;const ids=new Set(board.filter(id=>id!==7));return ids.size===0?7:ids.size===1?[...ids][0]:0;}
/** Full-board awards replace line awards, including pure-Wild lines in mixed boards. */
function raw(board:number[]){
 const full=fullSymbol(board);if(full)return PAYOUTS[full]*100;
 let total=0;
 for(const [a,b,c] of LINES){const x=board[a-1],y=board[b-1],z=board[c-1];if(!x||!y||!z)continue;const symbol=x!==7?x:y!==7?y:z;if((x===symbol||x===7)&&(y===symbol||y===7)&&(z===symbol||z===7))total+=PAYOUTS[symbol];}
 return total;
}
function evaluate(board:number[]){
 const full=fullSymbol(board),jackpot=full===7,wins:{line:number;symbolId:number;payout:number;positions:number[]}[]=[];
 if(!jackpot)LINES.forEach((line,i)=>{const ids=line.map(p=>board[p-1]);if(ids.includes(0))return;const id=full||ids.find(id=>id!==7)||7;if(ids.every(v=>v===id||v===7))wins.push({line:i+1,symbolId:id,payout:PAYOUTS[id]*(full?10:1),positions:line.map(p=>p-1)});});
 const rawPayout=jackpot?20000:wins.reduce((s,w)=>s+w.payout,0),winningPositions=jackpot?Array.from({length:10},(_,i)=>i):[...new Set(wins.flatMap(w=>w.positions))].sort((a,b)=>a-b);
 return {rawPayout,totalBetMultiplier:rawPayout/10,jackpot,fullBoard:full>0,fullSymbolId:full,fullBoardMultiplier:full?10:1,wins,winningPositions};
}
export function evaluateOx(config:OxConfig,board:number[],mode:OxMode='base'){
 validateOxConfig(config);ensure(mode==='base'||mode==='free');ensure(Array.isArray(board)&&board.length===10&&board.every(id=>Number.isSafeInteger(id)&&id>=0&&id<=7),'金牛盘面须为十格，空白为0，符号为1～7。');
 if(mode==='free')ensure(board[0]>=1&&board[0]<=6&&SIDES.every(i=>board[i]===board[0]),'特殊盘面左右六格必须为同一种普通图标。');
 return evaluate(board);
}
export function oxSkeleton(config:OxConfig,board:number[],mode:OxMode):OxSkeleton {
 const result=evaluateOx(config,board,mode),fixed=new Set([...result.winningPositions,...(mode==='free'?SIDES:[])]);
 return {cells:[...fixed].sort((a,b)=>a-b).flatMap(i=>[i,board[i]])};
}
export function inspectOxSkeleton(s:OxSkeleton,c:OxConfig,mode:OxMode){
 ensure(object(s));keys(s,['cells']);ensure(Array.isArray(s.cells)&&s.cells.length>0&&s.cells.length<=20&&s.cells.length%2===0);
 const board=Array<number>(10).fill(0),seen=new Set<number>();
 for(let i=0;i<s.cells.length;i+=2){const p=s.cells[i],id=s.cells[i+1];ensure(Number.isSafeInteger(p)&&p>=0&&p<10&&!seen.has(p)&&Number.isSafeInteger(id)&&id>=1&&id<=7);board[p]=id;seen.add(p);}
 const result=evaluateOx(c,board,mode),necessary=new Set([...result.winningPositions,...(mode==='free'?SIDES:[])]);
 ensure(result.rawPayout>0&&necessary.size===seen.size&&[...seen].every(i=>necessary.has(i)),'骨架只保留中奖必要格与特殊模式左右六格。');
 validateFillable(board);return {...result,board,key:String(result.rawPayout)};
}
function validateFillable(board:number[]){for(const line of LINES){const ids=line.map(p=>board[p-1]);ensure(!(ids.includes(0)&&ids.filter(id=>id===7).length===2),'两个百搭加空格无法补成非中奖线。');}}
function unit(random:()=>number){const n=random();ensure(Number.isFinite(n)&&n>=0&&n<1,'随机源须为[0,1)。');return n;}
function pick<T extends {weight:number}>(rows:T[],random:()=>number){ensure(rows.length>0,'没有可一次补齐的合法图标。');let n=unit(random)*rows.reduce((s,r)=>s+r.weight,0);for(const r of rows){n-=r.weight;if(n<0)return r;}return rows.at(-1)!;}
/** Six ordinary symbols, at most four lines per cell: filtering leaves a legal choice.
 * Filled cells are ordinary symbols, so no later step creates two-Wild dead ends.
 * Every hole consumes exactly one draw; no retries, backtracking or skeleton changes.
 */
function fill(c:OxConfig,board:number[],random:()=>number){
 validateFillable(board);
 for(let pos=0;pos<10;pos++)if(board[pos]===0){
  const allowed=c.symbols.filter(s=>s.role==='normal'&&LINES.every(line=>{
   if(!line.includes(pos+1))return true;
   const ids=line.map(p=>p===pos+1?s.id:board[p-1]);if(ids.includes(0))return true;
   const normal=ids.filter(id=>id!==7);return new Set(normal).size>1;
  }));board[pos]=pick(allowed,random).id;
 }
}
export function fillOxSkeleton(s:OxSkeleton,c:OxConfig,mode:OxMode,random:()=>number=Math.random){
 const before=inspectOxSkeleton(s,c,mode),board=[...before.board];fill(c,board,random);const after=evaluate(board);
 ensure(JSON.stringify({...before,board:undefined,key:undefined})===JSON.stringify(after),'一次补齐改变了奖金。');return board;
}
export function generateOxLoss(c:OxConfig,mode:OxMode,random:()=>number=Math.random){
 validateOxConfig(c);ensure(mode==='base'||mode==='free');const board=Array<number>(10).fill(0);if(mode==='free'){const id=pick(c.symbols.filter(s=>s.role==='normal'),random).id;SIDES.forEach(i=>board[i]=id);}fill(c,board,random);ensure(raw(board)===0);return board;
}
export function oxCoverage(library:{buckets:Record<string,OxSkeleton[]>},rows:WeightRow[]){const required=[...new Set(rows.filter(([m,w])=>m>0&&w>0).map(([m])=>String(m)))],missing=required.filter(m=>!library.buckets[m]?.length);return {required:required.length,covered:required.length-missing.length,missing};}
function validateOptions(o:OxOptions){ensure(object(o));keys(o,['mode','count','seed','perMultiplier','maxRetained']);ensure((o.mode==='base'||o.mode==='free')&&Number.isSafeInteger(o.count)&&o.count>=1&&o.count<=1_000_000&&Number.isSafeInteger(o.seed)&&o.seed>=0&&o.seed<=0xffffffff&&Number.isSafeInteger(o.perMultiplier)&&o.perMultiplier>=1&&o.perMultiplier<=1000&&Number.isSafeInteger(o.maxRetained)&&o.maxRetained>=1&&o.maxRetained<=20000,'生成次数1～100万、种子uint32、每倍率1～1000条、总容量1～20000条。');}
export class OxSkeletonGenerator {
 readonly config:OxConfig;readonly options:OxOptions;readonly targets:number[];readonly buckets:Record<string,OxSkeleton[]>={};
 readonly stats={generated:0,retained:0,duplicates:0,rejected:0,capacitySkipped:0,bytes:0};
 private cursor=0;private seen=new Set<string>();private wanted:Set<number>;private order:number[];private coveredAt=-1;private pairs:number[][]=[];
 constructor(c:OxConfig,o:OxOptions,targets:number[]){validateOxConfig(c);validateOptions(o);ensure(Array.isArray(targets)&&targets.length>0&&targets.length<=20000&&targets.every(m=>Number.isSafeInteger(m)&&m>0&&m<=20000));this.config=structuredClone(c);this.options={...o};this.targets=[...new Set(targets)].sort((a,b)=>a-b);this.wanted=new Set(this.targets);
  // Weighted deterministic permutation affects retained shapes, never numerical weights.
  const random=seededRandom(o.seed),remaining=[...c.symbols];this.order=[];while(remaining.length){const s=pick(remaining,random);this.order.push(s.id);remaining.splice(remaining.indexOf(s),1);}const normals=this.order.filter(id=>id!==7);for(let i=0;i<normals.length;i++)for(let j=i+1;j<normals.length;j++)this.pairs.push([normals[i],normals[j],7]);
 }
 get done(){return this.stats.generated>=this.options.count||this.cursor>=(this.options.mode==='free'?6*7**4:6*7**4+15*3**10)||this.stats.retained>=this.options.maxRetained||(this.coveredAt>=0&&this.stats.generated>=this.coveredAt+100000);}
 step(){
  if(this.done)return;const board=Array<number>(10).fill(0),special=this.cursor<6*7**4;
  if(this.stats.generated===0&&this.options.mode==='base'&&this.wanted.has(20000))board.fill(7);
  else {
   if(special){let code=this.cursor;const id=this.order.filter(id=>id!==7)[Math.floor(code/(7**4))];code%=7**4;SIDES.forEach(i=>board[i]=id);for(const pos of CENTER){board[pos]=this.order[code%7];code=Math.floor(code/7);}}
   else {let code=this.cursor-6*7**4;const palette=this.pairs[Math.floor(code/(3**10))];code%=3**10;for(let pos=0;pos<10;pos++){board[pos]=palette[code%3];code=Math.floor(code/3);}}
   this.cursor++;
  }
  this.stats.generated++;
  const payout=raw(board),key=String(payout);if(!this.wanted.has(payout)){this.stats.rejected++;return;}
  if((this.buckets[key]?.length??0)>=this.options.perMultiplier){this.stats.capacitySkipped++;return;}
  const skeleton=oxSkeleton(this.config,board,this.options.mode),encoded=JSON.stringify(skeleton),signature=key+':'+encoded;
  if(this.seen.has(signature)){this.stats.duplicates++;return;}
  const bytes=new TextEncoder().encode(encoded).length;if(this.stats.bytes+bytes>MAX_BYTES){this.stats.capacitySkipped++;return;}
  inspectOxSkeleton(skeleton,this.config,this.options.mode);(this.buckets[key]??=[]).push(skeleton);this.seen.add(signature);this.stats.retained++;this.stats.bytes+=bytes;
  if(this.coveredAt<0&&this.targets.every(m=>this.buckets[m]?.length))this.coveredAt=this.stats.generated;
 }
 result(stopped=false):OxLibrary{return structuredClone({version:1,format:'ox-skeleton-v1',mode:this.options.mode,config:this.config,options:this.options,targets:this.targets,stats:this.stats,buckets:this.buckets,partial:stopped&&!this.done});}
}
export function validateOxLibrary(value:unknown,c:OxConfig):OxLibrary {
 ensure(object(value));keys(value,['version','format','mode','config','options','targets','stats','buckets','partial','gameRevision']);
 const r=value as unknown as OxLibrary;ensure(r.version===1&&r.format==='ox-skeleton-v1'&&r.mode===r.options?.mode&&JSON.stringify(r.config)===JSON.stringify(c),'骨架配置已改变，请重新生成。');validateOxConfig(c);validateOptions(r.options);
 ensure(Array.isArray(r.targets)&&r.targets.length>0&&r.targets.length<=20000&&new Set(r.targets).size===r.targets.length&&r.targets.every(m=>Number.isSafeInteger(m)&&m>0&&m<=20000));
 const stats=r.stats;ensure(object(stats));keys(stats,['generated','retained','duplicates','rejected','capacitySkipped','bytes']);ensure(Object.keys(stats).length===6&&Object.values(stats).every(n=>Number.isSafeInteger(n)&&n>=0)&&stats.generated>0&&stats.generated<=r.options.count&&stats.retained>0&&stats.retained<=r.options.maxRetained&&stats.retained+stats.duplicates+stats.rejected+stats.capacitySkipped===stats.generated&&stats.bytes<=MAX_BYTES&&typeof r.partial==='boolean');
 ensure(object(r.buckets));let retained=0,bytes=0;const seen=new Set<string>();
 for(const [key,list] of Object.entries(r.buckets)){ensure(r.targets.includes(Number(key))&&String(Number(key))===key&&Array.isArray(list)&&list.length>0&&list.length<=r.options.perMultiplier);for(const s of list){ensure(inspectOxSkeleton(s,c,r.mode).key===key);const encoded=JSON.stringify(s),signature=key+':'+encoded;ensure(!seen.has(signature));seen.add(signature);bytes+=new TextEncoder().encode(encoded).length;retained++;}}
 ensure(retained===stats.retained&&bytes===stats.bytes);return r;
}
