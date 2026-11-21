import type {WeightRow} from './model';
import {validateAg11Board,type Ag11BoardConfig} from './ag11Math';

export type Ag11SkeletonMode='base'|'free';
export interface Ag11Skeleton {cells:number[]}
export interface Ag11LibraryOptions {mode:Ag11SkeletonMode;count:number;perMultiplier:number;maxRetained:number;seed:number}
export interface Ag11LibraryStats {generated:number;retained:number;duplicates:number;rejected:number}
export interface Ag11Library {version:1;format:'ag11-skeleton-v1';mode:Ag11SkeletonMode;config:Ag11BoardConfig;options:Ag11LibraryOptions;stats:Ag11LibraryStats;buckets:Record<string,Ag11Skeleton[]>;partial:boolean}

const SCALE=20;
const MAX_GENERATION_COUNT=2_000_000_000;
const MAX_RETAINED=50_000;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function invariant(ok:unknown,message:string):asserts ok { if(!ok)throw Error(message); }
const unit=(random:()=>number)=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw Error('随机源必须返回 0～1 之间且不含 1 的值。');return n;};
const key=(value:number)=>String(value);

export interface Ag11BoardResult {rawMultiplier:number;normalPayout:number;scatterPayout:number;factor:number;winningPositions:number[];normalWins:Array<{symbolId:number;count:number;payout:number;positions:number[]}>}
export function evaluateAg11Board(config:Ag11BoardConfig,board:number[]):Ag11BoardResult {
 validateAg11Board(config);invariant(Array.isArray(board)&&board.length===30&&board.every(v=>Number.isSafeInteger(v)&&v>=0&&(v<=11||v>=1002&&v<=1500)),'AG11 盘面必须有 30 个合法图标。');
 const counts=new Map<number,number>(),positions=new Map<number,number[]>(),normal=new Set(config.symbols.filter(s=>s.role==='normal').map(s=>s.id));
 board.forEach((value,index)=>{const id=value;if(value<1002&&normal.has(id)){counts.set(id,(counts.get(id)??0)+1);(positions.get(id)??(positions.set(id,[]),positions.get(id)!)).push(index);}});
 const normalWins:Ag11BoardResult['normalWins']=[];let normalPayout=0;const winning=new Set<number>();
 for(const [id,count] of counts){if(count<config.normalWinCount)continue;const paidCount=Math.min(config.maximumAwardCount,count),payout=config.normalPayouts[String(id)][String(paidCount)];if(!Number.isFinite(payout)||payout<=0)continue;const ids=positions.get(id)!;normalWins.push({symbolId:id,count,payout,positions:ids});normalPayout+=payout;ids.forEach(i=>winning.add(i));}
 const scatterId=config.symbols.find(s=>s.role==='scatter')!.id,scatterPositions=board.map((v,i)=>v===scatterId?i:-1).filter(i=>i>=0),scatterPayout=scatterPositions.length>=4?scatterPositions.length>=6?100:scatterPositions.length===5?5:3:0;
 if(scatterPayout)scatterPositions.forEach(i=>winning.add(i));
 const multiplierPositions=board.map((v,i)=>v>=1002?i:-1).filter(i=>i>=0),factor=normalPayout+scatterPayout>0?multiplierPositions.reduce((sum,i)=>sum+board[i]-1000,0)||1:0;
 multiplierPositions.filter(()=>factor>0).forEach(i=>winning.add(i));
 return {rawMultiplier:(normalPayout+scatterPayout)*factor,normalPayout,scatterPayout,factor,winningPositions:[...winning].sort((a,b)=>a-b),normalWins};
}

export function inspectAg11Skeleton(skeleton:Ag11Skeleton,config:Ag11BoardConfig,mode:Ag11SkeletonMode='base'){
 validateAg11Board(config);invariant(mode==='base'||mode==='free','AG11 骨架模式无效。');invariant(object(skeleton)&&Object.keys(skeleton).length===1&&Array.isArray(skeleton.cells)&&skeleton.cells.length>0&&skeleton.cells.length%2===0&&skeleton.cells.length<=60,'AG11 骨架只保存中奖位置和图标。');
 const board=Array(30).fill(0),seen=new Set<number>();
 for(let i=0;i<skeleton.cells.length;i+=2){const position=skeleton.cells[i],value=skeleton.cells[i+1];invariant(Number.isSafeInteger(position)&&position>=0&&position<30&&!seen.has(position),'AG11 骨架位置无效或重复。');invariant(Number.isSafeInteger(value)&&(value>=1&&value<=11||value>=1002&&value<=1500),'AG11 骨架图标无效。');seen.add(position);board[position]=value;}
 const result=evaluateAg11Board(config,board);invariant(result.rawMultiplier>0,'AG11 骨架必须是中奖结果。');invariant(JSON.stringify(result.winningPositions)===JSON.stringify([...seen].sort((a,b)=>a-b)),'AG11 骨架包含不参与中奖的图标，或缺少必要的中奖图标。');
 return {...result,key:key(result.rawMultiplier),board,mode};
}

export function fillAg11Skeleton(skeleton:Ag11Skeleton,config:Ag11BoardConfig,mode:Ag11SkeletonMode='base',random:()=>number=Math.random){
 const before=inspectAg11Skeleton(skeleton,config,mode),board=[...before.board],winning=new Set(before.winningPositions),used=new Set(before.normalWins.map(w=>w.symbolId)),safe=config.symbols.filter(s=>s.role==='normal'&&!used.has(s.id));
 invariant(safe.length>0,'AG11 骨架没有可用于补空的安全普通图标。');
 const weights=new Map(config.generationWeights[mode].filter(([id,weight])=>safe.some(s=>s.id===id)&&weight>0));
 invariant(weights.size>0,'AG11 骨架没有可用于补空的正权重普通图标。');
 const counts=new Map<number,number>();for(const symbol of safe)counts.set(symbol.id,0);const pickSafe=()=>{const candidates=safe.filter(symbol=>(counts.get(symbol.id)??0)<7&&(weights.get(symbol.id)??0)>0);invariant(candidates.length>0,'AG11 骨架补空没有不会形成新中奖的图标。');let n=unit(random)*candidates.reduce((sum,symbol)=>sum+(weights.get(symbol.id)??0),0);for(const symbol of candidates){n-=weights.get(symbol.id)??0;if(n<0){counts.set(symbol.id,(counts.get(symbol.id)??0)+1);return symbol.id;}}const fallback=candidates[candidates.length-1];counts.set(fallback.id,(counts.get(fallback.id)??0)+1);return fallback.id;};
 for(let i=0;i<board.length;i++)if(!winning.has(i)&&board[i]===0)board[i]=pickSafe();
 const after=evaluateAg11Board(config,board);invariant(Math.abs(after.rawMultiplier-before.rawMultiplier)<1e-9&&JSON.stringify(after.winningPositions)===JSON.stringify(before.winningPositions),'AG11 一次补空产生了额外中奖或改变倍率。');return board;
}

export function generateAg11Loss(config:Ag11BoardConfig,mode:Ag11SkeletonMode='base',random:()=>number=Math.random){
 validateAg11Board(config);const normals=config.symbols.filter(s=>s.role==='normal');invariant(normals.length>=4,'AG11 需要至少四种普通图标才能生成空奖。');const weights=new Map(config.generationWeights[mode].filter(([id,weight])=>normals.some(s=>s.id===id)&&weight>0));invariant(weights.size>=4,'AG11 空奖需要至少四种正权重普通图标。');const counts=new Map<number,number>();const pick=()=>{const candidates=normals.filter(symbol=>(weights.get(symbol.id)??0)>0&&(counts.get(symbol.id)??0)<7);invariant(candidates.length>0,'AG11 空奖没有不会形成中奖的图标。');let n=unit(random)*candidates.reduce((sum,symbol)=>sum+(weights.get(symbol.id)??0),0);for(const symbol of candidates){n-=weights.get(symbol.id)??0;if(n<0){counts.set(symbol.id,(counts.get(symbol.id)??0)+1);return symbol.id;}}const fallback=candidates[candidates.length-1];counts.set(fallback.id,(counts.get(fallback.id)??0)+1);return fallback.id;};const board=Array.from({length:30},pick);invariant(evaluateAg11Board(config,board).rawMultiplier===0,'AG11 空奖生成验算失败。');return board;
}

function targetUnits(value:number){const scaled=Math.round(value*SCALE);return Math.abs(value*SCALE-scaled)<1e-8?scaled:null;}
type Group={id:number;count:number;units:number};type Solution={groups:Group[];factor:number};
function solveTarget(config:Ag11BoardConfig,target:number,mode:Ag11SkeletonMode):Solution[]{
 const units=targetUnits(target);if(units===null||units<=0)return [];
 const factors=[1,...config.multiplierWeights[mode].filter(([,w])=>w>0).map(([m])=>m)].filter((v,i,a)=>a.indexOf(v)===i);
 const symbols=config.symbols.filter(s=>s.role==='normal');
 const solutions:Solution[]=[];
 for(const factor of factors){const raw=units/factor;if(!Number.isInteger(raw)||raw<=0)continue;const options=symbols.flatMap(s=>[8,9,10,11,12].map(count=>({id:s.id,count,units:Math.round(config.normalPayouts[String(s.id)][String(count)]*SCALE)}))).filter(g=>g.units>0);
  const memo=new Map<string,Group[]|null>();
  const dfs=(start:number,remaining:number,groups:number,cells:number):Group[]|null=>{if(remaining===0)return groups?[]:null;if(groups>=3||cells>=24)return null;const memoKey=`${start}:${remaining}:${groups}:${cells}`;if(memo.has(memoKey))return memo.get(memoKey)!;
   for(let i=start;i<options.length;i++){const option=options[i];if(option.units>remaining||cells+option.count>24)continue;const tail=dfs(i+1,remaining-option.units,groups+1,cells+option.count);if(tail){const result=[option,...tail];memo.set(memoKey,result);return result;}}
   memo.set(memoKey,null);return null;
  };
  const groups=dfs(0,raw,0,0);if(groups)solutions.push({groups,factor});
 }
 return solutions;
}
function solutionWeight(config:Ag11BoardConfig,mode:Ag11SkeletonMode,factor:number){if(factor===1){const multiplierWeight=config.generationWeights[mode].find(([id])=>id===11)?.[1]??0;return Math.max(1,1000-multiplierWeight);}return config.multiplierWeights[mode].find(([value])=>value===factor)?.[1]??0;}
function shuffle<T>(value:T[],random:()=>number){for(let i=value.length-1;i>0;i--){const j=Math.floor(unit(random)*(i+1));[value[i],value[j]]=[value[j],value[i]];}return value;}
function buildSkeleton(config:Ag11BoardConfig,solution:Solution,random:()=>number):Ag11Skeleton{
 const positions=shuffle(Array.from({length:30},(_,i)=>i),random),cells:number[]=[];let cursor=0;
 for(const group of solution.groups)for(let i=0;i<group.count;i++){cells.push(positions[cursor++],group.id);}
 if(solution.factor>1)cells.push(positions[cursor++],1000+solution.factor);
 return {cells};
}
function randomWeighted<T extends [number,number]>(rows:T[],random:()=>number){const active=rows.filter(([,weight])=>weight>0);let n=unit(random)*active.reduce((sum,[,weight])=>sum+weight,0);for(const row of active){n-=row[1];if(n<0)return row[0];}return active[active.length-1][0];}
function randomOrdinarySkeleton(config:Ag11BoardConfig,mode:Ag11SkeletonMode,random:()=>number):Ag11Skeleton|null{const board=Array.from({length:30},()=>{const id=randomWeighted(config.generationWeights[mode],random);if(id===11)return 1000+randomWeighted(config.multiplierWeights[mode],random);return id;});const result=evaluateAg11Board(config,board);if(result.rawMultiplier<=0)return null;return {cells:result.winningPositions.flatMap(position=>[position,board[position]])};}

export function validateAg11Library(value:unknown,config:Ag11BoardConfig):asserts value is Ag11Library{
 validateAg11Board(config);invariant(object(value)&&value.version===1&&value.format==='ag11-skeleton-v1'&&(value.mode==='base'||value.mode==='free')&&JSON.stringify(value.config)===JSON.stringify(config)&&object(value.options)&&object(value.stats)&&object(value.buckets)&&typeof value.partial==='boolean','AG11 骨架库结构或配置快照无效。');
 const library=value as unknown as Ag11Library,o=library.options,s=library.stats;invariant(o.mode===library.mode&&Number.isSafeInteger(o.count)&&o.count>=1&&o.count<=MAX_GENERATION_COUNT&&Number.isSafeInteger(o.perMultiplier)&&o.perMultiplier>=1&&o.perMultiplier<=10000&&Number.isSafeInteger(o.maxRetained)&&o.maxRetained>=1&&o.maxRetained<=MAX_RETAINED&&Number.isSafeInteger(o.seed)&&o.seed>=0&&o.seed<=0xffffffff,'AG11 骨架生成参数无效。');
 invariant(Object.values(s).every(n=>Number.isSafeInteger(n)&&n>=0)&&s.generated>=s.retained&&s.generated<=o.count,'AG11 骨架统计无效。');let retained=0;const seen=new Set<string>();
 for(const [bucket,rows] of Object.entries(library.buckets)){invariant(rows.length>0&&rows.length<=o.perMultiplier,'AG11 骨架桶数量无效。');for(const row of rows){const inspected=inspectAg11Skeleton(row,config,library.mode);invariant(inspected.key===bucket,'AG11 骨架与倍率桶不一致。');const signature=JSON.stringify(row);invariant(!seen.has(signature),'AG11 骨架重复。');seen.add(signature);retained++;}}
 invariant(retained===s.retained&&retained<=o.maxRetained,'AG11 保留骨架统计或容量无效。');
}

export function ag11Coverage(library:{buckets:Record<string,Ag11Skeleton[]>},tables:WeightRow[]|WeightRow[][]){const first=(tables as unknown[])[0] as unknown;const rows=Array.isArray(first)&&Array.isArray(first[0])?(tables as WeightRow[][]).flat():(tables as WeightRow[]);const required=[...new Set(rows.filter(([m,w])=>m>0&&w>0).map(([m])=>String(m)))],missing=required.filter(k=>!library.buckets[k]?.length);return {required:required.length,covered:required.length-missing.length,missing};}

export class Ag11SkeletonGenerator{
 readonly buckets:Record<string,Ag11Skeleton[]>={};readonly config:Ag11BoardConfig;readonly options:Ag11LibraryOptions;generated=0;retained=0;duplicates=0;rejected=0;private readonly solutions=new Map<string,Solution[]>();private readonly seen=new Set<string>();
 constructor(config:Ag11BoardConfig,options:Ag11LibraryOptions,readonly targets:number[],private readonly random:()=>number){validateAg11Board(config);this.config=structuredClone(config);this.options=options;invariant(options.mode==='base'||options.mode==='free','AG11 骨架生成模式无效。');invariant(Number.isSafeInteger(options.count)&&options.count>=1&&options.count<=MAX_GENERATION_COUNT&&Number.isSafeInteger(options.perMultiplier)&&options.perMultiplier>=1&&options.perMultiplier<=10000&&Number.isSafeInteger(options.maxRetained)&&options.maxRetained>=1&&options.maxRetained<=MAX_RETAINED&&Number.isSafeInteger(options.seed)&&options.seed>=0&&options.seed<=0xffffffff&&targets.length>0,'AG11 骨架生成参数无效。');for(const target of targets){const solutions=solveTarget(config,target,options.mode);if(solutions.length)this.solutions.set(String(target),solutions);}}
 get done(){return this.generated>=this.options.count||this.retained>=this.options.maxRetained;}
 step(){if(this.done)return;this.generated++;const skeleton=randomOrdinarySkeleton(this.config,this.options.mode,this.random);if(!skeleton){this.rejected++;return;}const inspected=inspectAg11Skeleton(skeleton,this.config,this.options.mode);if(!this.targets.includes(inspected.rawMultiplier)){this.rejected++;return;}const signature=JSON.stringify(skeleton);if(this.seen.has(signature)){this.duplicates++;return;}const bucket=this.buckets[inspected.key]??(this.buckets[inspected.key]=[]);if(bucket.length>=this.options.perMultiplier){this.rejected++;return;}bucket.push(skeleton);this.seen.add(signature);this.retained++;}
 result(partial=false):Ag11Library{return {version:1,format:'ag11-skeleton-v1',mode:this.options.mode,config:this.config,options:this.options,stats:{generated:this.generated,retained:this.retained,duplicates:this.duplicates,rejected:this.rejected},buckets:this.buckets,partial};}
}

export function ag11Targets(config:Ag11BoardConfig,mode:Ag11SkeletonMode,tables:WeightRow[]|WeightRow[][]){validateAg11Board(config);const first=(tables as unknown[])[0] as unknown;const rows=Array.isArray(first)&&Array.isArray(first[0])?(tables as WeightRow[][]).flat():(tables as WeightRow[]);return [...new Set(rows.filter(([m,w])=>m>0&&w>0).map(([m])=>m))].sort((a,b)=>a-b);}
