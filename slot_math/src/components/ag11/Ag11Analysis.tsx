import {useEffect,useMemo,useRef,useState} from 'react';
import {calculateAg11Rtp,type Ag11Parameters} from '../../domain/ag11Math';
import {Ag11Simulator,type Ag11SimulationMode} from '../../domain/ag11Simulation';
import {parseWeightTable,type Parameters,type WeightTable} from '../../domain/model';
import {validateGameFiles,type GameDocument,type GameFiles} from '../../domain/settings';
import {saveGame} from '../../services/gameFiles';
import {WeightTableEditor} from '../WeightTableEditor';
import {RabbitButton,percent,multiple} from '../rabbit/RabbitShared';
import '../rabbit/rabbit.css';
import './ag11.css';

type Ag11Files=GameFiles&{config:GameFiles['config']&{parameters:Ag11Parameters;simulationOptions:{paidSpins:number;seed:number|null}}};
type Editing='base'|'free'|'bet125Base'|'bet125Free'|'purchase';
const number=(n:number,digits=6)=>n.toLocaleString('zh-CN',{maximumFractionDigits:digits});
function getParameters(files:GameFiles){return files.config.parameters as unknown as Ag11Parameters;}
function getTable(rows:unknown[]):WeightTable{return parseWeightTable(JSON.stringify(rows));}

export function Ag11Analysis({document,onDirtyChange,onSavingChange,onSaved}:{document:GameDocument;onDirtyChange:(v:boolean)=>void;onSavingChange:(v:boolean)=>void;onSaved:(v:GameDocument)=>void}){
 const [files,setFiles]=useState<Ag11Files>(()=>structuredClone(document.files) as Ag11Files),[applied,setApplied]=useState<Ag11Files>(()=>structuredClone(document.files) as Ag11Files),[revision,setRevision]=useState(document.revision),[saved,setSaved]=useState(JSON.stringify(document.files)),[mode,setMode]=useState<Ag11SimulationMode>('normal'),[editing,setEditing]=useState<Editing|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const lock=useRef(false),fingerprint=JSON.stringify(files),dirty=fingerprint!==saved,pending=fingerprint!==JSON.stringify(applied),p=getParameters(files),appliedP=getParameters(applied);
 const base=useMemo(()=>getTable(files.base),[files.base]),free=useMemo(()=>getTable(files.free),[files.free]);
 const appliedBase=useMemo(()=>getTable(applied.base),[applied.base]),appliedFree=useMemo(()=>getTable(applied.free),[applied.free]);
 const theory=useMemo(()=>calculateAg11Rtp(appliedBase,appliedFree,appliedP),[appliedBase,appliedFree,appliedP]);
 const sim=useAg11Task(JSON.stringify([applied,mode]));
 useEffect(()=>onDirtyChange(dirty),[dirty,onDirtyChange]);
 function updateTable(kind:Editing,rows:WeightTable['rows']){
  const next=structuredClone(files);
  if(kind==='base')next.base=rows;
  else if(kind==='free')next.free=rows;
  else if(kind==='bet125Base')next.config.parameters.bet125.baseWeights=rows;
  else if(kind==='bet125Free')next.config.parameters.bet125.freeWeights=rows;
  else next.config.parameters.purchaseFreeWeights=rows;
  setFiles(next);
 }
 function changeTrigger(value:number){const next=structuredClone(files);next.config.parameters.freeSpinTriggerProbability=value;setFiles(next);}
 function changeBaseWin(value:number){const next=structuredClone(files);next.config.parameters.baseSpinWinProbability=value;setFiles(next);}
 function changeBet125Probability(kind:'base'|'trigger',value:number){const next=structuredClone(files);if(kind==='base')next.config.parameters.bet125.baseSpinWinProbability=value;else next.config.parameters.bet125.freeSpinTriggerProbability=value;setFiles(next);}
 function changeSimulation(key:'paidSpins'|'seed',value:string){const next=structuredClone(files);if(key==='paidSpins')next.config.simulationOptions.paidSpins=Number(value);else next.config.simulationOptions.seed=value.trim()?Number(value):null;setFiles(next);}
 function apply(){try{validateGameFiles(files);setApplied(structuredClone(files));setError('');}catch(e){setError((e as Error).message);}}
 async function save(){if(lock.current||!dirty)return;lock.current=true;setSaving(true);onSavingChange(true);setError('');setMessage('');try{validateGameFiles(files);const result=await saveGame(document.gameId,revision,files);setRevision(result.revision);setSaved(fingerprint);onSaved({gameId:document.gameId,revision:result.revision,files});setMessage('AG11 参数与五张结果权重表已保存。');}catch(e){setError((e as Error).message);}finally{lock.current=false;setSaving(false);onSavingChange(false);}}
 function simulate(){try{validateGameFiles(applied);const {paidSpins,seed}=applied.config.simulationOptions;sim.start({type:'simulate',files:applied,mode,count:paidSpins,seed:seed??crypto.getRandomValues(new Uint32Array(1))[0]});}catch(e){setError((e as Error).message);}}
 const preview=(kind:Editing,table:WeightTable)=>{
  const next=structuredClone(appliedP);
  if(kind==='purchase')next.purchaseFreeWeights=table.rows;
  else if(kind==='bet125Base')next.bet125.baseWeights=table.rows;
  else if(kind==='bet125Free')next.bet125.freeWeights=table.rows;
  const baseTable=kind==='base'?table:appliedBase;
  const freeTable=kind==='free'?table:appliedFree;
  const result=calculateAg11Rtp(baseTable,freeTable,next);
  const bet125=kind==='bet125Base'||kind==='bet125Free';
  return {totalRtp:kind==='purchase'?result.purchaseRtp:bet125?result.bet125Rtp:result.totalRtp,baseRtp:kind==='purchase'?0:bet125?result.bet125BaseRtp:result.baseRtp,freeRtp:kind==='purchase'?result.purchaseRtp:bet125?result.bet125FreeRtp:result.freeRtp,totalVariance:kind==='purchase'?result.purchaseVariance:bet125?result.bet125Variance:result.totalVariance,standardDeviation:Math.sqrt(kind==='purchase'?result.purchaseVariance:bet125?result.bet125Variance:result.totalVariance)};
 };
 const tableFor=(kind:Editing)=>kind==='base'?base:kind==='free'?free:kind==='bet125Base'?getTable(p.bet125.baseWeights):kind==='bet125Free'?getTable(p.bet125.freeWeights):getTable(p.purchaseFreeWeights);
 const otherTableFor=(kind:Editing)=>kind==='base'?free:kind==='free'?base:kind==='bet125Base'?getTable(p.bet125.freeWeights):kind==='bet125Free'?getTable(p.bet125.baseWeights):base;
 const editorKind=(kind:Editing)=>kind==='base'||kind==='bet125Base'?'base':'free';
 const editorName=(kind:Editing)=>kind==='base'?'base.json':kind==='free'?'free.json':kind==='bet125Base'?'1.25 倍普通倍率表':kind==='bet125Free'?'1.25 倍免费倍率表':'purchase-free.json';
 const editValue=editing?tableFor(editing):base;
 const other=editing?otherTableFor(editing):free;
 const activeBaseWin=mode==='bet125'?p.bet125.baseSpinWinProbability:p.baseSpinWinProbability;
 const activeTrigger=mode==='bet125'?p.bet125.freeSpinTriggerProbability:p.freeSpinTriggerProbability;
 const editorParameters={lineCount:1,baseSpinWinProbability:p.baseSpinWinProbability,freeSpinWinProbability:1,freeSpinTriggerProbability:p.freeSpinTriggerProbability} as Parameters;
 const result=sim.result;
 const simulationDetails: Array<[string,string]> = mode==='purchase'
  ? [['模拟 RTP',percent(result?.totalRtp??0)],['购买 RTP',percent(result?.purchaseRtp??0)],['命中率',percent(result?.hitProbability??0)],['约 95% 误差区间',`${percent(Math.max(0,(result?.totalRtp??0)-1.96*(result?.standardError??0)))} ～ ${percent((result?.totalRtp??0)+1.96*(result?.standardError??0))}`],['触发次数',String(result?.triggers??0)],['随机种子',String(result?.seed??'')]]
  : [['模拟 RTP',percent(result?.totalRtp??0)],['普通贡献',percent(result?.baseRtp??0)],['免费贡献',percent(result?.freeRtp??0)],['命中率',percent(result?.hitProbability??0)],['约 95% 误差区间',`${percent(Math.max(0,(result?.totalRtp??0)-1.96*(result?.standardError??0)))} ～ ${percent((result?.totalRtp??0)+1.96*(result?.standardError??0))}`],['触发次数',String(result?.triggers??0)],['随机种子',String(result?.seed??'')]];
 return <div className="analysis-editor rabbit-analysis ag11-analysis">
  {editing&&<WeightTableEditor kind={editorKind(editing)} value={{name:editorName(editing),table:editValue}} other={{name:'对应另一张表',table:other}} parameters={editorParameters} previewModel={table=>preview(editing,table)} onSave={value=>updateTable(editing,value.table.rows)} onClose={()=>setEditing(null)}/>}
  <div className="analysis-file-heading"><span className={dirty?'file-dirty':'file-saved'} role="status">{saving?'正在保存…':dirty?'有未保存修改':'配置与文件一致'}{pending?'；草稿尚未应用':''}</span><div className="actions"><button className="button secondary" disabled={!pending||saving} onClick={apply}>应用配置</button><button className="button primary" disabled={!dirty||saving} onClick={()=>void save()}>保存文件</button></div></div>
  {(error||sim.error)&&<div className="alert" role="alert">{error||sim.error}</div>}{message&&!dirty&&<p role="status" className="game-file-success">{message}</p>}
  <fieldset disabled={saving} className="analysis-editor-fieldset"><div className="workspace">
   <aside className="configuration">
    <section className="config-group"><h2>结果模式</h2><div className="segmented-control" role="tablist" aria-label="AG11 结果模式"><button role="tab" aria-selected={mode==='normal'} className={mode==='normal'?'active':''} onClick={()=>setMode('normal')}>自然投注</button><button role="tab" aria-selected={mode==='bet125'} className={mode==='bet125'?'active':''} onClick={()=>setMode('bet125')}>1.25 倍投注</button><button role="tab" aria-selected={mode==='purchase'} className={mode==='purchase'?'active':''} onClick={()=>setMode('purchase')}>购买免费</button></div>
     <TableBlock title="普通中奖倍率分布" detail={`${base.rows.length.toLocaleString()} 档，空奖由中奖率控制`} onClick={()=>setEditing('base')}/>
     <TableBlock title="自然触发的免费整段结果" detail={`${free.rows.length.toLocaleString()} 档，单项对应完整免费阶段`} onClick={()=>setEditing('free')}/>
     <TableBlock title="1.25 倍普通中奖倍率分布" detail={`${p.bet125.baseWeights.length.toLocaleString()} 档，使用 Lua rates_base_double`} onClick={()=>setEditing('bet125Base')}/>
     <TableBlock title="1.25 倍免费整段结果" detail={`${p.bet125.freeWeights.length.toLocaleString()} 档，使用 Lua rates_free_double`} onClick={()=>setEditing('bet125Free')}/>
     <TableBlock title="购买免费整段结果" detail={`${p.purchaseFreeWeights.length.toLocaleString()} 档；成本 ${p.purchaseCostMultiplier} 倍投注`} onClick={()=>setEditing('purchase')}/>
    </section>
    <section className="config-group"><h2>开奖概率</h2><label className="field"><span>{mode==='bet125'?'1.25 倍普通中奖率':'普通中奖率'}</span><span className="input-wrap"><input type="number" min="0" max="100" step="any" aria-label={mode==='bet125'?'1.25 倍普通中奖率':'普通中奖率'} value={Number((activeBaseWin*100).toPrecision(12))} onChange={e=>mode==='bet125'?changeBet125Probability('base',Number(e.target.value)/100):changeBaseWin(Number(e.target.value)/100)}/><span>%</span></span></label><label className="field"><span>{mode==='bet125'?'1.25 倍免费触发率':'免费阶段触发概率'}</span><span className="input-wrap"><input type="number" min="0" max="100" step="any" aria-label={mode==='bet125'?'1.25 倍免费触发率':'免费阶段触发概率'} value={Number((activeTrigger*100).toPrecision(12))} onChange={e=>mode==='bet125'?changeBet125Probability('trigger',Number(e.target.value)/100):changeTrigger(Number(e.target.value)/100)}/><span>%</span></span></label><p className="input-note">{mode==='bet125'?'1.25 倍投注按 Lua 1026 的 freeMode=2 计算：实际扣款为基础投注的 1.25 倍，普通和免费倍率使用独立 double 表，免费触发率为 0.66666%。':'普通赔率表只保存正倍率；普通空奖由普通中奖率控制。自然免费触发后使用独立的完整免费结果表。'}</p><div className="readonly-rule"><span>初始免费</span><strong>{p.featureSpins} 次</strong><span>追加免费</span><strong>{p.freeRetriggerSpins} 次</strong><span>1.25 倍投注</span><strong>{p.bet125.betMultiplier}×</strong><span>购买成本</span><strong>{p.purchaseCostMultiplier}×</strong></div></section>
    <section className="config-group"><h2>模拟</h2><label className="field"><span>{mode==='normal'?'自然付费局数':mode==='bet125'?'1.25 倍投注局数':'购买免费次数'}</span><input aria-label="模拟局数" type="number" min="1" max="1000000000" step="1" value={files.config.simulationOptions.paidSpins} onChange={e=>changeSimulation('paidSpins',e.target.value)}/></label><label className="field"><span>随机种子</span><input aria-label="随机种子" type="number" min="0" max="4294967295" value={files.config.simulationOptions.seed??''} onChange={e=>changeSimulation('seed',e.target.value)}/></label><RabbitButton busy={sim.running} disabled={pending} onClick={simulate}>开始模拟</RabbitButton>{sim.running&&<RabbitButton onClick={sim.stop}>停止并保留结果</RabbitButton>}<p role="status">已完成 {(result?.count??sim.progress?.count??0).toLocaleString()} 次</p></section>
   </aside>
   <div className="results">{pending&&<p role="status" className="simulation-notice stale">草稿尚未应用；当前理论值使用上次应用配置。</p>}
    <div className="metrics-grid">{(mode==='normal'?[['总 RTP',theory.totalRtp],['普通分布贡献',theory.baseRtp],['免费整段贡献',theory.freeRtp]]:mode==='bet125'?[['1.25 倍投注 RTP',theory.bet125Rtp],['普通分布贡献',theory.bet125BaseRtp],['免费整段贡献',theory.bet125FreeRtp]]:[['购买免费 RTP',theory.purchaseRtp],['免费整段平均结果',theory.purchaseSessionMean],['购买成本',p.purchaseCostMultiplier]]).map(([label,value])=><div className="metric" key={label}><span>{label}</span><strong>{label==='购买成本'?`${number(value as number)}×`:label==='免费整段平均结果'?multiple(value as number):percent(value as number)}</strong></div>)}</div>
    {mode==='normal'&&<section className="result-section"><h2>自然投注期望</h2><dl className="detail-grid">{[['普通中奖率',percent(appliedP.baseSpinWinProbability)],['普通中奖倍率均值',multiple(theory.baseMean)],['触发免费概率',percent(appliedP.freeSpinTriggerProbability)],['免费整段平均结果',multiple(theory.freeSessionMean)],['整局标准差',multiple(theory.standardDeviation)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>总 RTP = (1 − 触发率) × 普通中奖率 × 普通正倍率表均值 + 触发率 × 免费整段表均值。</p></section>}
    {mode==='bet125'&&<section className="result-section"><h2>1.25 倍投注期望</h2><dl className="detail-grid">{[['普通中奖率',percent(appliedP.bet125.baseSpinWinProbability)],['普通倍率均值',multiple(theory.bet125BaseMean)],['免费触发概率',percent(appliedP.bet125.freeSpinTriggerProbability)],['免费整段平均结果',multiple(theory.bet125FreeSessionMean)],['投注扣款倍率',multiple(appliedP.bet125.betMultiplier)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>1.25 倍模式的奖金先按 Lua double 表抽取，再除以实际扣款的 1.25 倍；独立表和独立触发率直接决定该模式 RTP。</p></section>}
    {result&&<section className="result-section"><h2>模拟结果</h2><dl className="detail-grid">{simulationDetails.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
    <section className="result-section"><h2>结果口径</h2><p>自然投注使用普通表和自然免费整段表；1.25 倍投注使用 Lua 1026 freeMode=2 的 rates_base_double 与 rates_free_double，并按 1.25 倍实际扣款计算 RTP；购买免费使用独立整段表并除以购买成本。</p><p>倍率权重决定结果分布，骨架数量不改变中奖率或 RTP；空奖由后端实时生成。</p></section>
   </div>
  </div></fieldset>
 </div>;
}

function TableBlock({title,detail,onClick}:{title:string;detail:string;onClick:()=>void}){
 return <div className="upload-block"><div className="upload-heading">{title}</div><p>{detail}</p><button className="edit-table-button" onClick={onClick}>编辑权重表</button></div>;
}

function useAg11Task(snapshot:string){
 const worker=useRef<Worker|null>(null),[running,setRunning]=useState(false),[result,setResult]=useState<ReturnType<Ag11Simulator['result']>|null>(null),[progress,setProgress]=useState<Record<string,number>|null>(null),[error,setError]=useState('');
 useEffect(()=>{worker.current?.terminate();worker.current=null;setRunning(false);setResult(null);setProgress(null);setError('');return()=>{worker.current?.terminate();worker.current=null;};},[snapshot]);
 function start(request:unknown){if(worker.current)return;setError('');setResult(null);setProgress(null);setRunning(true);const w=new Worker(new URL('../../workers/ag11.worker.ts',import.meta.url),{type:'module'});worker.current=w;const fail=(message:string)=>{if(worker.current!==w)return;setError(message);setRunning(false);w.terminate();worker.current=null;};w.onerror=e=>fail(e.message||'AG11 工作线程执行失败。');w.onmessage=({data})=>{if(worker.current!==w)return;if(data.type==='progress')setProgress(data.result);else if(data.type==='error')fail(data.message);else if(data.type==='complete'){setResult(data.result);setRunning(false);w.terminate();worker.current=null;}};w.postMessage(request);}
 return {running,result,progress,error,start,stop:()=>worker.current?.postMessage({type:'stop'})};
}
