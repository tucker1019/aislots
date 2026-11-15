import {validatePaylines,type PaylineConfig} from './paylines';
import {inspectTigerSkeleton,validateTigerSkeletonOptions,type TigerSkeleton,type TigerSkeletonOptions,type TigerSkeletonStats,type TigerSkeletonLibrary} from './tigerSkeleton';

/** Finite enumeration supplies coverage; enumerated frequency never sets award weights. */
export class LeopardSkeletonGenerator {
 readonly config:PaylineConfig;readonly options:TigerSkeletonOptions;
 readonly stats:TigerSkeletonStats={generated:0,wins:0,losses:0,retained:0,duplicates:0,capacitySkipped:0,bytes:0};
 private buckets:Record<string,TigerSkeleton[]>={};private seen=new Set<string>();private lookup=new Int32Array(512);private horizontals:number[]=[];
 constructor(config:PaylineConfig,options:TigerSkeletonOptions){
  validatePaylines(config);validateTigerSkeletonOptions(options);
  if(config.feature?.type!=='fortune_leopard_v1')throw Error('需要AG9盘面配置。');
  this.horizontals=config.lines.flatMap((l,i)=>l.every(cell=>(cell-1)%3===(l[0]-1)%3)?[i]:[]);
  this.config=structuredClone(config);this.options={...options,count:Math.min(options.count,options.mode==='base'?7**9:6*3**9)};
  const pay=[0,3,5,8,10,25,100,250];
  for(let a=1;a<=7;a++)for(let b=1;b<=7;b++)for(let c=1;c<=7;c++){
   const normal=[a,b,c].filter(v=>v!==7),id=normal[0]??7;
   if(normal.every(v=>v===id))this.lookup[a*64+b*8+c]=pay[id];
  }
 }
 get done(){return this.stats.generated>=this.options.count;}
 step(){
  if(this.done)return;let n=this.stats.generated++,target:number|null=null;const board=Array<number>(9);
  if(this.options.mode==='base'){
   // A seed changes traversal order without omitting any board in a full run.
   n=(n+(this.options.seed%(7**9)))%(7**9);
   for(let i=0;i<9;i++){board[i]=n%7+1;n=Math.floor(n/7);}
  }else{
   target=Math.floor(n/(3**9))+1;n%=3**9;
   for(let i=0;i<9;i++){const d=n%3;board[i]=d===0?0:d===1?target:7;n=Math.floor(n/3);}
  }
  const lines=this.config.lines,pay=lines.map(l=>this.lookup[board[l[0]-1]*64+board[l[1]-1]*8+board[l[2]-1]]);
  const full=this.horizontals.every(i=>pay[i]>0),raw=pay.reduce((a,b)=>a+b,0)*(full?10:1);
  if(!raw){this.stats.losses++;this.stats.capacitySkipped++;return;}this.stats.wins++;
  const key=String(raw);
  if((this.buckets[key]?.length??0)>=this.options.perMultiplier||this.stats.retained>=this.options.maxRetained){this.stats.capacitySkipped++;return;}
  let skeleton:TigerSkeleton;
  if(target===null){
   const fixed=new Set(lines.flatMap((l,i)=>pay[i]>0?l:[]));
   skeleton={target:null,stages:[board.flatMap((id,i)=>fixed.has(i+1)?[i,id]:[])]};
  }else{
   const cells=board.flatMap((id,i)=>id?[i]:[]),stages:number[][]=[];
   // Retain every locked symbol, including those outside final winning lines.
   const shift=this.options.seed%cells.length;cells.push(...cells.splice(0,shift));
   while(cells.length)stages.push(cells.splice(0,2).flatMap(pos=>[pos,board[pos]]));
   if(board.some(id=>!id))stages.push([]);
   skeleton={target,stages};
  }
  const encoded=JSON.stringify(skeleton),signature=key+':'+encoded;
  if(this.seen.has(signature)){this.stats.duplicates++;return;}
  const bytes=new TextEncoder().encode(encoded).length;
  if(this.stats.bytes+bytes>24*1024*1024){this.stats.capacitySkipped++;return;}
  if(inspectTigerSkeleton(skeleton,this.config,this.options.mode).key!==key)throw Error('AG9骨架倍率不一致。');
  this.seen.add(signature);(this.buckets[key]??=[]).push(skeleton);this.stats.retained++;this.stats.bytes+=bytes;
 }
 result():TigerSkeletonLibrary{return structuredClone({version:1,format:'payline-skeleton-v1',mode:this.options.mode,config:this.config,options:this.options,stats:this.stats,buckets:this.buckets,partial:!this.done});}
}
