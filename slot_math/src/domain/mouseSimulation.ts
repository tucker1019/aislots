import {type Parameters,type WeightTable} from './model';
import {seededRandom} from './simulation';
import {calculateMouseModel,MOUSE_LENGTH_WEIGHTS,mouseLossExtra} from './mouseMath';
function draw(rows:readonly (readonly [number,number])[],random:()=>number){let n=random()*rows.reduce((s,r)=>s+r[1],0);for(const [m,w] of rows){n-=w;if(n<0)return m;}return rows.at(-1)![0];}
export function mouseLossCount(raw:number,random:()=>number){return draw(MOUSE_LENGTH_WEIGHTS,random)+mouseLossExtra(raw);}
export class MouseSimulator {
 count=0;private random:()=>number;private total=0;private squared=0;private ordinary=0;private special=0;private hits=0;private triggers=0;private lossBoards=0;
 constructor(private base:WeightTable,private free:WeightTable,private p:Parameters,readonly seed:number){calculateMouseModel(base,free,p);if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('种子须为uint32。');this.random=seededRandom(seed);}
 round(){const feature=this.random()<this.p.freeSpinTriggerProbability,hit=feature||this.random()<this.p.baseSpinWinProbability,raw=hit?draw((feature?this.free:this.base).rows,this.random):0;return {mode:feature?'free' as const:'base' as const,raw,paid:raw/5,lossBoards:feature?mouseLossCount(raw,this.random):0};}
 step(){const r=this.round();this.count++;this.total+=r.paid;this.squared+=r.paid**2;if(r.mode==='free'){this.special+=r.paid;this.triggers++;this.lossBoards+=r.lossBoards;}else this.ordinary+=r.paid;if(r.paid>0)this.hits++;}
 result(){const n=this.count||1,mean=this.total/n,variance=Math.max(0,this.squared/n-mean**2);return {count:this.count,seed:this.seed,totalRtp:mean,baseRtp:this.ordinary/n,freeRtp:this.special/n,hitProbability:this.hits/n,triggers:this.triggers,lossBoards:this.lossBoards,averageFeatureBoards:this.triggers?1+this.lossBoards/this.triggers:0,standardError:Math.sqrt(variance/n)};}
}
