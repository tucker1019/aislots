import {evaluateFortuneTiger} from './fortuneTiger';
import {inspectTigerSkeleton,type TigerSkeleton,type TigerMode} from './tigerSkeleton';
import {validatePaylines,type PaylineConfig} from './paylines';
export {evaluateFortuneTiger as evaluateLeopard} from './fortuneTiger';
function choose(values:number[],weights:number[],random:()=>number){const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw Error('随机源无效。');let cursor=value*weights.reduce((a,b)=>a+b,0);if(!values.length)throw Error('约束补空没有合法候选。');for(let i=0;i<values.length;i++){cursor-=weights[i];if(cursor<0)return values[i];}return values[values.length-1];}
function legal(c:PaylineConfig,board:number[],pos:number,id:number){return c.lines.filter(l=>l.includes(pos+1)).every(line=>{const ids=line.map(cell=>cell===pos+1?id:board[cell-1]),blanks=ids.filter(v=>v===0).length,wilds=ids.filter(v=>v===7).length,normals=ids.filter(v=>v!==0&&v!==7);return !(blanks>0&&wilds===2)&&!(blanks===0&&new Set(normals).size<=1);});}
function fill(c:PaylineConfig,board:number[],allowWild:boolean,random:()=>number){for(let pos=0;pos<board.length;pos++)if(board[pos]===0){const candidates=c.symbols.filter(s=>s.weight>0&&(allowWild||s.role!=='wild')&&legal(c,board,pos,s.id));board[pos]=choose(candidates.map(s=>s.id),candidates.map(s=>s.weight),random);}return board;}
export function fillLeopardSkeleton(s:TigerSkeleton,c:PaylineConfig,mode:TigerMode,random:()=>number=Math.random){
 const inspected=inspectTigerSkeleton(s,c,mode),boards=inspected.boards.map(b=>[...b]);
 if(mode==='base')fill(c,boards[0],false,random);
 const after=evaluateFortuneTiger(c,boards.at(-1)!);
 if(after.rawPayout*after.bonusMultiplier!==Number(inspected.key)||JSON.stringify(after.wins)!==JSON.stringify(inspected.result.wins))throw Error('补空改变了中奖结果。');
 return boards;
}
export function generateLeopardLoss(c:PaylineConfig,mode:TigerMode,random:()=>number=Math.random){
 validatePaylines(c);if(c.feature?.type!=='fortune_leopard_v1')throw Error('需要AG9配置。');
 if(mode==='base')return [fill(c,Array(9).fill(0),true,random)];
 const targets=c.feature.targetWeights.filter(t=>t.weight>0),target=choose(targets.map(t=>t.symbolId),targets.map(t=>t.weight),random),board=Array<number>(9).fill(0),boards=[[...board]];
 for(let stage=0;stage<7;stage++){
  let added=0;
  for(let pos=0;pos<9;pos++)if(!board[pos]&&legal(c,board,pos,target)&&random()<c.feature.fillProbability){const wild=random()<c.feature.wildProbability!;board[pos]=wild&&legal(c,board,pos,7)?7:target;added++;}
  boards.push([...board]);if(!added)break;
 }
 if(evaluateFortuneTiger(c,board).rawPayout!==0)throw Error('空奖构造增加了中奖。');return boards;
}
