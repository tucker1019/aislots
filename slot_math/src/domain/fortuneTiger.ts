import {evaluatePaylines, generatePaylineBoard, gridCells, validatePaylines, type PaylineConfig} from './paylines';

export function evaluateFortuneTiger(config:PaylineConfig,board:number[]) {
 const result=evaluatePaylines(config,board);
 const bonusMultiplier=config.feature?.type==='fortune_tiger_v1'&&result.wins.length>0&&board[0]!==0&&board.every(id=>id===board[0])?10:1;
 return {...result,bonusMultiplier,totalBetMultiplier:result.totalBetMultiplier*bonusMultiplier};
}
function draw(random:()=>number){const v=random();if(!Number.isFinite(v)||v<0||v>=1)throw new Error('随机源必须返回 [0,1)。');return v;}
function weighted<T>(values:T[],weights:number[],random:()=>number):T{
 const total=weights.reduce((a,b)=>a+b,0);let cursor=draw(random)*total;
 for(let i=0;i<values.length;i++){cursor-=weights[i];if(cursor<0)return values[i];}
 return values[values.length-1];
}
/** Exact decimal fraction, including exponential notation emitted by Number.toString. */
function fraction(value:number):[bigint,bigint]{
 const [mantissa,power='0']=String(value).toLowerCase().split('e');const [a,b='']=mantissa.split('.');
 const scale=b.length-Number(power);const digits=BigInt(a+b);
 return scale>=0?[digits,10n**BigInt(scale)]:[digits*10n**BigInt(-scale),1n];
}
function award(config:PaylineConfig,board:number[],stake:bigint){
 const result=evaluateFortuneTiger(config,board);let numerator=0n,denominator=1n;
 for(const win of result.wins){const [n,d]=fraction(win.payout);numerator=numerator*d+n*denominator;denominator*=d;}
 const win=stake*numerator*BigInt(result.bonusMultiplier)/(denominator*BigInt(config.lines.length));
 return {result,win};
}
export type TigerEndReason='normal'|'filled'|'no_new_symbol';
export interface TigerFrame {board:number[];lockedCellIds:number[];addedCellIds:number[];chargeMinor:string;winMinor:string;done:boolean}
export interface TigerRound {mode:'normal'|'feature';targetSymbolId:number|null;frames:TigerFrame[];endReason:TigerEndReason;betMinor:string;winMinor:string;profitMinor:string;result:ReturnType<typeof evaluateFortuneTiger>}
export function runFortuneTigerRound(config:PaylineConfig,betMinor:bigint,random:()=>number=Math.random,mode:'base'|'free'='base'):TigerRound{
 validatePaylines(config);const feature=config.feature;
 if(!feature||feature.type!=='fortune_tiger_v1')throw new Error('尚未配置 AG4 特殊玩法。');
 if(betMinor<=0n)throw new Error('总投注必须大于 0。');
 const frames:TigerFrame[]=[];
 const snapshot=(board:number[],added:number[],done:boolean):TigerFrame=>({board:[...board],lockedCellIds:board.flatMap((id,i)=>id?[i+1]:[]),addedCellIds:[...added],chargeMinor:frames.length===0?betMinor.toString():'0',winMinor:'0',done});
 let board:number[],targetSymbolId:number|null=null,endReason:TigerEndReason='normal';
 const special=mode==='free';
 if(!special){
  board=generatePaylineBoard(config,random);
  const wild=new Set(config.symbols.filter(s=>s.role==='wild').map(s=>s.id));
  const cells=gridCells(config.columnHeights);const byPosition=new Map(cells.map(c=>[`${c.column}:${c.row}`,c.id-1]));
  // Original normal-spin spreading order is row-major, although config IDs are column-major.
  for(let row=0;row<Math.max(...config.columnHeights);row++)for(let col=0;col<config.columnHeights.length;col++){
   const index=byPosition.get(`${col}:${row}`);if(index===undefined||wild.has(board[index]))continue;
   const symbol=board[index],count=weighted([0,1,2],feature.baseSpreadWeights,random);
   for(let offset=1;offset<=count&&row-offset>=0;offset++)board[byPosition.get(`${col}:${row-offset}`)!]=symbol;
  }
  frames.push(snapshot(board,[],true));
 }else{
  const targets=feature.targetWeights.filter(t=>t.weight>0);targetSymbolId=weighted(targets.map(t=>t.symbolId),targets.map(t=>t.weight),random);
  board=gridCells(config.columnHeights).map(()=>0);frames.push(snapshot(board,[],false));
  // Each successful attempt fills at least one cell; at most cell-count + 1 attempts.
  for(;;){
   const added:number[]=[];const next=[...board];
   for(let i=0;i<next.length;i++)if(next[i]===0&&draw(random)<feature.fillProbability){next[i]=targetSymbolId;added.push(i+1);}
   board=next;
   const full=board.every(id=>id!==0),done=full||added.length===0;
   frames.push(snapshot(board,added,done));
   if(done){endReason=full?'filled':'no_new_symbol';break;}
  }
 }
 const {result,win}=award(config,board,betMinor);frames[frames.length-1].winMinor=win.toString();
 return {mode:special?'feature':'normal',targetSymbolId,frames,endReason,betMinor:betMinor.toString(),winMinor:win.toString(),profitMinor:(win-betMinor).toString(),result};
}
