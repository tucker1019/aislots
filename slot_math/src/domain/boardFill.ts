import {advanceCascadeRound,createCascadeRound,evaluateWays,symbolDefinitions,type Board,type BoardMode,type CascadeConfig,type CascadeRound,type CascadeStep,type WaysWin} from './cascade';
export type FreeTarget=0|3|4|5;
export interface FillMetrics {scatterCount:number;attempts:number;rejectedCandidates:number;filledCells:number;elapsedMs:number}
export interface FilledRound {round:CascadeRound;metrics:FillMetrics}
const hole='__fill_hole';
const signature=(wins:WaysWin[])=>JSON.stringify(wins.map(w=>[w.symbolId,w.columns,w.ways,[...w.cellIds].sort((a,b)=>a-b)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
export function simulateBoard(config:CascadeConfig,mode:BoardMode,random:()=>number,preset?:Array<Array<string|null>>):CascadeRound {
  let round=createCascadeRound(config,random,preset,mode);
  while(!round.finished&&!round.limited)round=advanceCascadeRound(round,config,random);
  if(round.limited)throw new Error('原始盘面达到100轮上限，请调整配置后重试。');
  return round;
}
function draw(random:()=>number){const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw new Error('随机值必须位于 [0, 1)。');return value;}

/** Preserve the reference winning chain; change only cells which never win. */
export function fillBoard(reference:CascadeRound,config:CascadeConfig,increment:number,random:()=>number,preset?:Array<Array<string|null>>,maxAttempts=64,freeTarget:FreeTarget=0):FilledRound {
  if(!reference.finished||reference.limited)throw new Error('补空需要完整结束的参考盘面。');
  if(!Number.isFinite(increment)||increment<0||increment>1e9||!Number.isSafeInteger(maxAttempts)||maxAttempts<1||maxAttempts>1000)throw new Error('累计加权 n 需为0–10亿，补空尝试上限需为1–1000。');
  if(![0,3,4,5].includes(freeTarget))throw new Error('免费表现目标必须为未中免费，或3、4、5个。');
  const started=performance.now(),definitions=symbolDefinitions(config);
  const rules={...config,symbols:[...config.symbols,{id:hole,name:'空位',role:'scatter' as const,weight:0,color:'#000000',payouts:{}}]};
  const initial=reference.steps[0]?.before??reference.board;
  const needed=new Set(reference.steps.flatMap(step=>step.wins.flatMap(win=>win.cellIds)));
  // A manual board is an explicit user constraint, including its nonwinning cells.
  initial.forEach((column,c)=>column.forEach((cell,r)=>{if(preset?.[c]?.[r]!=null)needed.add(cell.id);}));
  const symbols=config.symbols.filter(s=>(s.role==='normal'||s.role==='scatter')&&s.weight>0);
  const manualFree=initial.flat().filter(cell=>needed.has(cell.id)&&definitions.get(cell.symbolId)?.role==='scatter').length;
  if(initial.some(column=>column.filter(cell=>needed.has(cell.id)&&definitions.get(cell.symbolId)?.role==='scatter').length>1))throw new Error('初始盘面每列最多放一个免费图标。');
  const maximum=freeTarget||2;
  if(manualFree>maximum)throw new Error('已有免费图标超过本次整局数量上限。');
  const stages=[{board:initial,born:new Set(initial.flat().map(c=>c.id))},...reference.steps.map(step=>({board:step.after,born:new Set(step.refillIds)}))];
  const capacity=stages.reduce((sum,stage)=>sum+stage.board.filter((column,c)=>column.some(cell=>stage.born.has(cell.id)&&!needed.has(cell.id))&&!(stage===stages[0]&&initial[c].some(cell=>needed.has(cell.id)&&definitions.get(cell.symbolId)?.role==='scatter'))).length,0);
  if(freeTarget&&(manualFree+capacity<freeTarget||!symbols.some(s=>s.role==='scatter')))throw new Error('骨架外可补位置不足，或免费图标基础权重为0，无法达到指定免费数量。');
  let rejectedCandidates=0;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    const weights=new Map(symbols.filter(s=>s.role==='normal').map(s=>[s.id,s.weight]));let filledCells=0,deadEnd=false,scatterCount=manualFree,remainingGroups=capacity;
    // Look ahead through every later fall: a filler must remain nonwinning for its lifetime.
    const contexts=[...reference.steps.map(step=>({source:step.before,expected:signature(step.wins)})),{source:reference.board,expected:signature([])}].map(context=>({...context,board:context.source.map(column=>column.map(cell=>({...cell,symbolId:needed.has(cell.id)?cell.symbolId:hole})))}));
    const placements=new Map<number,Array<{cell:{id:number;symbolId:string};context:typeof contexts[number]}>>();
    for(const context of contexts)for(const cell of context.board.flat())if(cell.symbolId===hole){const entries=placements.get(cell.id)??[];entries.push({cell,context});placements.set(cell.id,entries);}

    function fill(board:Board,expected:WaysWin[],stageIndex:number){
      const expectedSignature=signature(expected),forbidden=new Set(expected.map(w=>w.symbolId));
      if(signature(evaluateWays(board,rules,0,reference.mode))!==expectedSignature){deadEnd=true;return;}
      // Column-major order; the same weight map persists into later columns and refills.
      for(let c=0;c<board.length;c++){
        const column=board[c];
        let freeAdded=stageIndex===0&&column.some(cell=>cell.symbolId!==hole&&definitions.get(cell.symbolId)?.role==='scatter');
        const hasCapacity=column.some(cell=>cell.symbolId===hole)&&!freeAdded;
        const freeWeight=(base:number)=>base+(stageIndex===0&&c===0?0:config.scatterWeightIncrement);
        for(const cell of column){
        if(cell.symbolId!==hole)continue;
        const forceFree=!!freeTarget&&!freeAdded&&freeTarget-scatterCount>=remainingGroups;
        const candidates=symbols.filter(symbol=>{
          if(symbol.role==='scatter')return !freeAdded&&scatterCount<maximum;
          if(forceFree)return false;
          if(forbidden.has(symbol.id)){rejectedCandidates++;return false;}
          const entries=placements.get(cell.id)!;
          for(const entry of entries)entry.cell.symbolId=symbol.id;
          const safe=entries.every(entry=>signature(evaluateWays(entry.context.board,rules,0,reference.mode))===entry.context.expected);
          for(const entry of entries)entry.cell.symbolId=hole;
          if(!safe)rejectedCandidates++;
          return safe;
        });
        if(!candidates.length){deadEnd=true;return;}
        const candidateWeight=(symbol:typeof symbols[number])=>symbol.role==='scatter'?freeWeight(symbol.weight):weights.get(symbol.id)!;
        const total=candidates.reduce((sum,s)=>sum+candidateWeight(s),0);
        if(!Number.isFinite(total)||total<=0)throw new Error('补空权重超出数值范围。');
        let value=draw(random)*total,selected=candidates.at(-1)!;
        for(const symbol of candidates){value-=candidateWeight(symbol);if(value<0){selected=symbol;break;}}
        cell.symbolId=selected.id;
        const probability=reference.mode==='free'?config.gold.freeProbability:config.gold.baseProbability;
        if(selected.role==='normal'&&config.gold.columns.includes(c+1)&&probability>0&&draw(random)<probability)cell.symbolId=String(Number(selected.id)+1000);
        for(const entry of placements.get(cell.id)!)entry.cell.symbolId=cell.symbolId;
        if(selected.role==='scatter'){freeAdded=true;scatterCount++;}
        else weights.set(selected.id,weights.get(selected.id)!+increment);
        filledCells++;
        }
        if(hasCapacity)remainingGroups--;
      }
      if(signature(evaluateWays(board,config,0,reference.mode))!==expectedSignature)throw new Error('补空产生额外中奖，已拒绝该结果。');
    }
    let current:Board=initial.map(column=>column.map(cell=>({...cell,symbolId:needed.has(cell.id)?cell.symbolId:hole})));
    fill(current,reference.steps[0]?.wins??[],0);
    if(deadEnd)continue;
    const steps:CascadeStep[]=[];
    for(let i=0;i<reference.steps.length;i++){
      const source=reference.steps[i];
      const actual=evaluateWays(current,config,i,reference.mode);
      if(signature(actual)!==signature(source.wins))throw new Error('补空后中奖链偏离骨架。');
      const carried=new Map(current.flat().map(cell=>[cell.id,cell])),born=new Set(source.refillIds),converted=new Set(source.transformedIds);
      const next=source.after.map(column=>column.map(cell=>born.has(cell.id)?{...cell,symbolId:needed.has(cell.id)?cell.symbolId:hole}:converted.has(cell.id)?{...cell}:({...carried.get(cell.id)!})));
      fill(next,reference.steps[i+1]?.wins??[],i+1);
      if(deadEnd)break;
      steps.push({...source,before:current,after:next,wins:actual,payout:actual.reduce((sum,w)=>sum+w.payout,0)});current=next;
    }
    if(deadEnd)continue;
    if(freeTarget&&scatterCount!==freeTarget)continue;
    const totalPayout=steps.reduce((sum,s)=>sum+s.payout,0);
    if(totalPayout!==reference.totalPayout||steps.length!==reference.steps.length||evaluateWays(current,config,steps.length,reference.mode).length)throw new Error('整局补空验证失败，结果未返回。');
    return {round:{...reference,board:current,steps,totalPayout},metrics:{scatterCount,attempts:attempt,rejectedCandidates,filledCells,elapsedMs:performance.now()-started}};
  }
  throw new Error(`补空${maxAttempts}次仍无合法候选，请降低加权或调整图标配置；没有返回额外中奖盘面。`);
}
export interface SceneMetrics {twoFree:number;scenes:number;nearMiss:number;highNearMiss:number;repeated:number;normalCells:number}
export function measureScenes(round:CascadeRound,config:CascadeConfig):SceneMetrics {
  const definitions=symbolDefinitions(config),normals=config.symbols.filter(s=>s.role==='normal'&&(s.payouts[3]??0)>0);
  const high=new Set([...normals].sort((a,b)=>(b.payouts[3]??0)-(a.payouts[3]??0)||a.id.localeCompare(b.id)).slice(0,3).map(s=>s.id));
  const boards=round.steps.length?[round.steps[0].before,...round.steps.map(s=>s.after)]:[round.board];
  const metrics:SceneMetrics={twoFree:0,scenes:boards.length,nearMiss:0,highNearMiss:0,repeated:0,normalCells:0};
  for(const board of boards){
    if(board.flat().filter(cell=>definitions.get(cell.symbolId)?.role==='scatter').length===2)metrics.twoFree++;
    const match=(c:number,id:string)=>board[c]?.some(cell=>{const s=definitions.get(cell.symbolId);return s?.role==='wild'||s?.baseSymbolId===id;});
    const close=normals.filter(s=>match(0,s.id)&&match(1,s.id)&&!match(2,s.id));
    if(close.length)metrics.nearMiss++;
    if(close.some(s=>high.has(s.id)))metrics.highNearMiss++;
    for(const column of board){
      const counts=new Map<string,number>();
      for(const cell of column){const s=definitions.get(cell.symbolId);if(s?.role!=='normal')continue;counts.set(s.baseSymbolId,(counts.get(s.baseSymbolId)??0)+1);metrics.normalCells++;}
      metrics.repeated+=[...counts.values()].reduce((sum,n)=>sum+Math.max(0,n-1),0);
    }
  }
  return metrics;
}
