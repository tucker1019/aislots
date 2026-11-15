import type {WeightRow} from './model';
export interface RabbitSymbol {id:number;name:string;role:'normal'|'wild';payout:number;weight:number}
export interface RabbitReward {id:number;name:string;payout:number;weight:number}
export interface RabbitConfig {version:1;ruleType:'fortune_rabbit_v1';columnHeights:number[];lines:number[][];symbols:RabbitSymbol[];rewards:RabbitReward[];generation:{rewardProbability:number}}
export type RabbitMode='base'|'free';
export interface RabbitSkeleton {cells:number[]}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:string[])=>{if(Object.keys(v).some(k=>!allowed.includes(k)))throw Error('金兔配置包含未知字段。');};
export const RABBIT_LINES=[[1,4,8],[1,5,8],[1,5,9],[2,5,8],[2,5,9],[2,6,9],[2,6,10],[3,6,9],[3,6,10],[3,7,10]];
export function validateRabbitConfig(value:unknown):RabbitConfig {
 if(!object(value)||value.version!==1||value.ruleType!=='fortune_rabbit_v1')throw Error('需要金兔第一版盘面配置。');
 keys(value,['version','ruleType','columnHeights','lines','symbols','rewards','generation']);
 if(JSON.stringify(value.columnHeights)!=='[3,4,3]'||JSON.stringify(value.lines)!==JSON.stringify(RABBIT_LINES))throw Error('金兔固定为三列 3、4、3 格和十条中奖线。');
 const ids=new Set<number>();
 for(const kind of ['symbols','rewards'] as const){
  const entries=value[kind];if(!Array.isArray(entries)||!entries.length||entries.length>32)throw Error('符号与奖励列表需包含 1～32 项。');
  for(const s of entries){if(!object(s))throw Error('符号格式无效。');keys(s,kind==='symbols'?['id','name','role','payout','weight']:['id','name','payout','weight']);
   if(!Number.isSafeInteger(s.id)||(s.id as number)<1||(s.id as number)>1000000||ids.has(s.id as number)||typeof s.name!=='string'||!s.name.trim()||s.name.length>80||!Number.isSafeInteger(s.payout)||(s.payout as number)<1||(s.payout as number)>1000000||typeof s.weight!=='number'||!Number.isFinite(s.weight)||s.weight<0||s.weight>1e12)throw Error('符号编号、名称、整数赔付或生成权重无效。');
   if(kind==='symbols'&&!['normal','wild'].includes(String(s.role)))throw Error('普通符号类型无效。');ids.add(s.id as number);
  }
  if(!entries.some(s=>s.weight>0))throw Error('至少一项生成权重大于零。');
 }
 const c=value as unknown as RabbitConfig;
 if(c.symbols.filter(s=>s.role==='normal').length<3||c.symbols.filter(s=>s.role==='wild').length!==1)throw Error('至少三个普通符号和一个百搭。');
 const degrees=Array<number>(10).fill(0);c.lines.forEach(line=>line.forEach(p=>degrees[p-1]++));
 if(c.symbols.filter(s=>s.role==='normal'&&s.weight>0).length<=Math.max(...degrees))throw Error('一次补齐要求正权重普通符号数大于每格所在线数（当前至少五种）。');
 if(!object(value.generation)||typeof value.generation.rewardProbability!=='number'||!Number.isFinite(value.generation.rewardProbability)||value.generation.rewardProbability<0||value.generation.rewardProbability>1)throw Error('奖励生成概率须为 0～1。');
 keys(value.generation,['rewardProbability']);return c;
}
function evaluate(c:RabbitConfig,board:number[],mode:RabbitMode){
 const wild=new Set(c.symbols.filter(s=>s.role==='wild').map(s=>s.id)),rewardMap=new Map(c.rewards.map(s=>[s.id,s]));
 const wins:{line:number;symbolId:number;payout:number;positions:number[]}[]=[];
 if(mode==='base')c.lines.forEach((line,i)=>{
  const best=c.symbols.filter(s=>line.every(p=>board[p-1]===s.id||wild.has(board[p-1]))).sort((a,b)=>b.payout-a.payout)[0];
  if(best)wins.push({line:i+1,symbolId:best.id,payout:best.payout,positions:line.map(p=>p-1)});
 });
 const rewards=board.flatMap((id,position)=>rewardMap.has(id)?[{position,payout:rewardMap.get(id)!.payout}]:[]);
 const rewardPayout=rewards.length>=5?rewards.reduce((s,r)=>s+r.payout,0):0,linePayout=wins.reduce((s,w)=>s+w.payout,0);
 const winningPositions=[...new Set([...wins.flatMap(w=>w.positions),...(rewardPayout?rewards.map(r=>r.position):[])])].sort((a,b)=>a-b);
 return {rawPayout:linePayout+rewardPayout,linePayout,rewardPayout,rewardCount:rewards.length,wins,winningPositions,totalBetMultiplier:(linePayout+rewardPayout)/10};
}
export function evaluateRabbit(c:RabbitConfig,board:number[],mode:RabbitMode='base'){
 validateRabbitConfig(c);const ids=new Set([...(mode==='base'?c.symbols:[]),...c.rewards].map(s=>s.id));
 if(!['base','free'].includes(mode)||!Array.isArray(board)||board.length!==10||board.some(id=>id!==0&&!ids.has(id)))throw Error('金兔盘面需要十格；特殊转只允许奖励或空白。');
 return evaluate(c,board,mode);
}
export function rabbitSkeleton(c:RabbitConfig,board:number[],mode:RabbitMode):RabbitSkeleton {
 const result=evaluate(c,board,mode);return {cells:result.winningPositions.flatMap(i=>[i,board[i]])};
}
export function inspectRabbitSkeleton(s:RabbitSkeleton,c:RabbitConfig,mode:RabbitMode){
 if(!object(s)||Object.keys(s).length!==1||!Array.isArray(s.cells)||!s.cells.length||s.cells.length%2||s.cells.length>20)throw Error('骨架只允许中奖位置和符号编号。');
 const board=Array<number>(10).fill(0),seen=new Set<number>();
 for(let i=0;i<s.cells.length;i+=2){const pos=s.cells[i],id=s.cells[i+1];if(!Number.isSafeInteger(pos)||pos<0||pos>=10||seen.has(pos)||!Number.isSafeInteger(id)||id<=0)throw Error('骨架位置或符号无效。');seen.add(pos);board[pos]=id;}
 const r=evaluateRabbit(c,board,mode);
 if(r.rawPayout<=0||r.winningPositions.length!==seen.size)throw Error('骨架包含不参与奖金的元素或空奖。');
 return {...r,key:String(r.rawPayout),board};
}
export function fillRabbitSkeleton(s:RabbitSkeleton,c:RabbitConfig,mode:RabbitMode,random:()=>number=Math.random){
 const before=inspectRabbitSkeleton(s,c,mode),board=[...before.board];
 if(mode==='free')return board;
 fillRabbitHoles(c,board,random);
 const after=evaluate(c,board,mode);
 if(after.rawPayout!==before.rawPayout||after.rewardPayout!==before.rewardPayout||JSON.stringify(after.wins)!==JSON.stringify(before.wins))throw Error('一次补齐奖金一致性错误。');return board;
}
function unit(random:()=>number){const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw Error('随机源必须返回 0～1 之间且不含 1 的值。');return n;}
function pick<T extends {weight:number}>(rows:T[],random:()=>number):T {const active=rows.filter(r=>r.weight>0);if(!active.length)throw Error('一次补齐没有合法候选。');let cursor=unit(random)*active.reduce((s,r)=>s+r.weight,0);for(const r of active){cursor-=r.weight;if(cursor<0)return r;}return active.at(-1)!;}
export function validateRabbitFillable(c:RabbitConfig,board:number[]){
 const wild=new Set(c.symbols.filter(s=>s.role==='wild').map(s=>s.id));
 for(const line of c.lines){const ids=line.map(p=>board[p-1]);if(ids.includes(0)&&ids.filter(id=>wild.has(id)).length===2)throw Error('两个百搭和一个空格的骨架不能一次补齐。');}
}
function fillRabbitHoles(c:RabbitConfig,board:number[],random:()=>number){
 validateRabbitFillable(c,board);
 const normals=c.symbols.filter(s=>s.role==='normal'&&s.weight>0),wild=new Set(c.symbols.filter(s=>s.role==='wild').map(s=>s.id)),rewards=new Set(c.rewards.map(s=>s.id));
 for(let position=0;position<10;position++){
  if(board[position]!==0)continue;
  const allowed=normals.filter(s=>c.lines.every(line=>{
   if(!line.includes(position+1))return true;
   const values=line.map(p=>p===position+1?s.id:board[p-1]);
   if(values.some(id=>id===0||rewards.has(id)))return true;
   const ordinary=values.filter(id=>!wild.has(id));return new Set(ordinary).size>1;
  }));
  board[position]=pick(allowed,random).id;
 }
}
export function generateRabbitBoard(c:RabbitConfig,mode:RabbitMode,random:()=>number=Math.random){
 return Array.from({length:10},()=>random()<c.generation.rewardProbability?pick(c.rewards,random).id:mode==='free'?0:pick(c.symbols,random).id);
}
export function generateRabbitLoss(c:RabbitConfig,mode:RabbitMode,random:()=>number=Math.random){
 validateRabbitConfig(c);
 if(!['base','free'].includes(mode))throw Error('未知空奖模式。');
 const board=Array<number>(10).fill(0),p=c.generation.rewardProbability;
 // One count draw; Binomial(4,p) only controls losing-board appearance.
 const count=pick([1,4,6,4,1].map((coefficient,n)=>({n,weight:coefficient*p**n*(1-p)**(4-n)})),random).n,positions=Array.from({length:10},(_,i)=>i);
 for(let i=0;i<count;i++){const index=Math.floor(unit(random)*positions.length),[position]=positions.splice(index,1);board[position]=pick(c.rewards,random).id;}
 if(mode==='base')fillRabbitHoles(c,board,random);
 if(evaluate(c,board,mode).rawPayout!==0)throw Error('一次生成空奖验算失败。');
 return board;
}
export function rabbitCoverage(library:{buckets:Record<string,RabbitSkeleton[]>},table:WeightRow[]){
 const required=[...new Set(table.filter(([m,w])=>m>0&&w>0).map(([m])=>String(m)))],missing=required.filter(k=>!library.buckets[k]?.length);
 return {required:required.length,covered:required.length-missing.length,missing};
}

/** A bounded DP constructs sums. It controls appearance, never payout probability. */
export function rabbitRewardSolver(c:RabbitConfig,maximum:number){
 const limit=Math.min(100000,maximum),states=Array.from({length:11},()=>new Int32Array(limit+1).fill(-1));states[0][0]=0;
 const choices=c.rewards.filter(r=>r.weight>0);
 for(let n=1;n<=10;n++)for(let sum=1;sum<=limit;sum++)for(let i=0;i<choices.length;i++)if(sum>=choices[i].payout&&states[n-1][sum-choices[i].payout]>=0){states[n][sum]=i;break;}
 return (target:number,maxCount:number,offset=0):number[]|null=>{
  if(!Number.isSafeInteger(target)||target<0||target>limit)return null;
  for(let j=0;j<maxCount-4;j++){const n=5+(j+offset)%(maxCount-4);if(states[n][target]<0)continue;const ids=[];let sum=target;for(let k=n;k>0;k--){const r=choices[states[k][sum]];ids.push(r.id);sum-=r.payout;}return ids;}
  return null;
 };
}
export class RabbitSkeletonGenerator {
 readonly buckets:Record<string,RabbitSkeleton[]>={};readonly config:RabbitConfig;
 generated=0;retained=0;duplicates=0;rejected=0;private cursor=0;private signatures=new Set<string>();private solve:ReturnType<typeof rabbitRewardSolver>;
 private patterns:{board:number[];payout:number;holes:number[]}[]=[];
 private lineSolutions=new Map<number,number[]>();
 constructor(c:RabbitConfig,readonly options:{mode:RabbitMode;count:number;perMultiplier:number;maxRetained:number;seed:number},readonly targets:number[],private random:()=>number){
  this.config=validateRabbitConfig(c);
  if(!['base','free'].includes(options.mode)||!Number.isSafeInteger(options.count)||options.count<1||options.count>1e8||!Number.isSafeInteger(options.perMultiplier)||options.perMultiplier<1||options.perMultiplier>10000||!Number.isSafeInteger(options.maxRetained)||options.maxRetained<1||options.maxRetained>20000||!Number.isSafeInteger(options.seed)||options.seed<0||options.seed>0xffffffff||targets.some(m=>!Number.isSafeInteger(m)||m<1||m>1e7))throw Error('骨架生成次数、种子或容量无效。');
  this.solve=rabbitRewardSolver(c,Math.max(0,...targets));
  if(options.mode==='base'){
   // Exhaust the three lowest ordinary symbols (3^10 boards) for rare small sums.
   const symbols=c.symbols.filter(s=>s.role==='normal').sort((a,b)=>a.payout-b.payout).slice(0,3),wanted=new Set(targets),board=Array(10).fill(0);
   for(let code=0;code<symbols.length**10;code++){let value=code;for(let i=0;i<10;i++){board[i]=value%symbols.length;value=Math.floor(value/symbols.length);}let payout=0;
    for(const [a,b,d] of c.lines)if(board[a-1]===board[b-1]&&board[b-1]===board[d-1])payout+=symbols[board[a-1]].payout;
    if(wanted.has(payout)&&!this.lineSolutions.has(payout))this.lineSolutions.set(payout,board.map(i=>symbols[i].id));
   }
  }
  this.patterns.push({board:Array(10).fill(0),payout:0,holes:Array.from({length:10},(_,i)=>i)});
  if(options.mode==='base')for(let mask=1;mask<1024;mask++){
   const positions=Array.from({length:10},(_,i)=>i).filter(i=>mask&(1<<i));if(positions.length<3||positions.length>5)continue;
   for(const symbol of c.symbols){if(symbol.role==='wild')continue;const board=Array(10).fill(0);positions.forEach(i=>board[i]=symbol.id);const r=evaluate(c,board,'base');if(r.rawPayout&&r.winningPositions.length===positions.length)this.patterns.push({board,payout:r.rawPayout,holes:board.flatMap((id,i)=>!id?[i]:[])});}
  }
 }
 get done(){return this.generated>=this.options.count||this.retained>=this.options.maxRetained;}
 step(){
  if(this.done)return;this.generated++;const target=this.targets[this.cursor%this.targets.length];if(this.generated%3!==0)this.cursor++;
  let board:number[]|null=null;
  // Alternate targeted and natural candidates to retain diverse ordinary line shapes.
  if(target!==undefined&&this.generated%3!==0){
   const lineSolution=this.lineSolutions.get(target);if(lineSolution)board=[...lineSolution];
   const start=Math.floor(this.random()*this.patterns.length);
   for(let j=0;!board&&j<this.patterns.length;j++){const p=this.patterns[(j+start)%this.patterns.length];if(p.payout===target){board=[...p.board];break;}const rewards=this.solve(target-p.payout,p.holes.length,this.generated);if(!rewards)continue;
    board=[...p.board];const holes=[...p.holes];for(let k=holes.length-1;k>0;k--){const r=Math.floor(this.random()*(k+1));[holes[k],holes[r]]=[holes[r],holes[k]];}rewards.forEach((id,k)=>board![holes[k]]=id);break;
   }
  }
  board??=this.options.mode==='base'&&this.generated%2?Array.from({length:10},()=>pick(this.config.symbols,this.random).id):generateRabbitBoard(this.config,this.options.mode,this.random);
  const r=evaluate(this.config,board,this.options.mode);if(!r.rawPayout||!this.targets.includes(r.rawPayout)){this.rejected++;return;}
  const key=String(r.rawPayout);if((this.buckets[key]?.length??0)>=this.options.perMultiplier)return;
  const skeleton=rabbitSkeleton(this.config,board,this.options.mode),signature=JSON.stringify(skeleton);
  if(this.signatures.has(signature)){this.duplicates++;return;}
  if(this.options.mode==='base'){try{validateRabbitFillable(this.config,inspectRabbitSkeleton(skeleton,this.config,'base').board);}catch{this.rejected++;return;}}
  fillRabbitSkeleton(skeleton,this.config,this.options.mode,this.random);
  (this.buckets[key]??=[]).push(skeleton);this.signatures.add(signature);this.retained++;
 }
 result(partial=false){return {version:1 as const,format:'rabbit-skeleton-v1' as const,mode:this.options.mode,config:this.config,options:this.options,stats:{generated:this.generated,retained:this.retained,duplicates:this.duplicates,rejected:this.rejected},buckets:this.buckets,partial};}
}
export type RabbitLibrary=ReturnType<RabbitSkeletonGenerator['result']>;
export function validateRabbitLibrary(value:unknown,c:RabbitConfig):RabbitLibrary {
 if(!object(value)||value.version!==1||value.format!=='rabbit-skeleton-v1'||!['base','free'].includes(String(value.mode))||JSON.stringify(value.config)!==JSON.stringify(c)||!object(value.buckets)||!object(value.options)||!object(value.stats)||typeof value.partial!=='boolean')throw Error('金兔骨架库结构或配置快照无效。');
 keys(value,['version','format','mode','config','options','stats','buckets','partial','gameRevision']);
 const library=value as unknown as RabbitLibrary;
 const o=library.options;
 keys(value.options,['mode','count','perMultiplier','maxRetained','seed']);keys(value.stats,['generated','retained','duplicates','rejected']);
 if(o.mode!==library.mode||!Number.isSafeInteger(o.count)||o.count<1||o.count>1e8||!Number.isSafeInteger(o.perMultiplier)||o.perMultiplier<1||o.perMultiplier>10000||!Number.isSafeInteger(o.maxRetained)||o.maxRetained<1||o.maxRetained>20000||!Number.isSafeInteger(o.seed)||o.seed<0||o.seed>0xffffffff)throw Error('骨架生成参数无效。');
 let count=0;const seen=new Set<string>();
 for(const [key,skeletons] of Object.entries(library.buckets)){
  if(!/^[1-9]\d*$/.test(key)||!Array.isArray(skeletons)||!skeletons.length||skeletons.length>o.perMultiplier)throw Error('倍率桶格式无效；不保存空奖。');
  for(const s of skeletons){if(inspectRabbitSkeleton(s,c,library.mode).key!==key)throw Error('骨架奖金与桶键不一致。');fillRabbitSkeleton(s,c,library.mode,()=>.5);const signature=JSON.stringify(s);if(seen.has(signature))throw Error('重复骨架。');seen.add(signature);if(++count>o.maxRetained)throw Error('骨架库超过容量上限。');}
 }
 if(count!==library.stats.retained||!Number.isSafeInteger(library.stats.generated)||library.stats.generated<count||library.stats.generated>o.count||[library.stats.duplicates,library.stats.rejected].some(n=>!Number.isSafeInteger(n)||n<0))throw Error('骨架统计无效。');
 if(JSON.stringify(library.buckets).length>24*1024*1024)throw Error('骨架库超过 24 兆字节。');return library;
}
