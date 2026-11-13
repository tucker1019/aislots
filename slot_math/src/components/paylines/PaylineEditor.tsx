import { useEffect, useState } from 'react';
import { generatePaylineBoard, gridCells, validatePaylines, type PaylineConfig, type PaylineDocument } from '../../domain/paylines';
import { evaluateFortuneTiger } from '../../domain/fortuneTiger';
import {TigerSkeletonPanel} from './TigerSkeletonPanel';
import {TigerGenerationSettings} from './TigerGenerationSettings';
import { savePaylines } from '../../services/gameFiles';
import { PaylineBoard } from './PaylineBoard';
export function PaylineEditor({document,onDirty,onSaving}:{document:PaylineDocument;onDirty:(v:boolean)=>void;onSaving:(v:boolean)=>void}) {
  const [config,setConfig]=useState<PaylineConfig>(()=>structuredClone(document.file));
  const [shape,setShape]=useState(config.columnHeights.join(' '));
  const [revision,setRevision]=useState(document.revision),[saved,setSaved]=useState(JSON.stringify(config));
  const [librarySaving,setLibrarySaving]=useState(false);
  const [saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [selected,setSelected]=useState<number[]>([]),[editing,setEditing]=useState<number|null>(null);
  const [board,setBoard]=useState<number[]>(()=>gridCells(config.columnHeights).map(()=>0));
  const [bet,setBet]=useState('10');
  const fingerprint=JSON.stringify(config),dirty=fingerprint!==saved||shape!==config.columnHeights.join(' ');
  useEffect(()=>onDirty(dirty),[dirty,onDirty]);
  let invalid='';try{validatePaylines(config);}catch(e){invalid=(e as Error).message;}
  let result:ReturnType<typeof evaluateFortuneTiger>|null=null;
  if(!invalid)try{result=evaluateFortuneTiger(config,board);}catch(e){invalid=(e as Error).message;}
  function attempt(action:()=>void){setError('');setMessage('');try{action();}catch(e){setError((e as Error).message);}}
  function applyShape(){attempt(()=>{
    const heights=shape.trim().split(/[\s,，/]+/).map(Number);
    const changed=JSON.stringify(heights)!==JSON.stringify(config.columnHeights);
    if(changed&&config.lines.length&&!window.confirm('修改列高将清空原中奖组合和测试盘面，避免格子编号错配。是否继续？'))return;
    // Check shape before clearing existing configuration.
    if(!heights.length||heights.length>12||heights.some(h=>!Number.isSafeInteger(h)||h<1||h>12))throw new Error('每列 1～12 格，最多 12 列。');
    setConfig({...config,columnHeights:heights,lines:changed?[]:config.lines});setShape(heights.join(' '));
    if(changed){setBoard(gridCells(heights).map(()=>0));setSelected([]);setEditing(null);}
  });}
  function commitGroup(){attempt(()=>{
    const next={...config,lines:editing===null?[...config.lines,[...selected]]:config.lines.map((line,i)=>i===editing?[...selected]:line)};
    validatePaylines(next);setConfig(next);setSelected([]);setEditing(null);
  });}
  async function save(){if(saving)return;setError('');setMessage('');try{
    if(shape!==config.columnHeights.join(' '))throw new Error('请先应用列高。');
    validatePaylines(config);setSaving(true);onSaving(true);
    const next=await savePaylines(document.gameId,revision,config);setRevision(next.revision);setSaved(fingerprint);setMessage('连线配置已保存。');
  }catch(e){setError((e as Error).message);}finally{setSaving(false);onSaving(false);}}
  const updateSymbol=(index:number,patch:Partial<PaylineConfig['symbols'][number]>)=>setConfig({...config,symbols:config.symbols.map((s,i)=>i===index?{...s,...patch}:s)});
  return <>
    <div className="analysis-file-heading"><span>{dirty?'连线配置有未保存修改':'连线配置与文件一致'}</span><button className="button primary" disabled={!dirty||saving||librarySaving||!!invalid} onClick={()=>void save()}>{saving?'保存中…':'保存连线配置'}</button></div>
    {(error||invalid)&&<div className="dev-alert" role="alert">{error||invalid}</div>}{message&&<p className="game-file-success" role="status">{message}</p>}
    <fieldset disabled={saving||librarySaving} className="analysis-editor-fieldset"><div className="payline-layout">
      <section className="payline-card"><h2>盘面与中奖组合</h2><label className="field">每列格数<input aria-label="每列格数" value={shape} onChange={e=>setShape(e.target.value)}/></label><button className="button secondary" onClick={applyShape}>应用列高</button>
        <p>格子从 1 开始，按列从左到右、每列从上到下编号。点击格子选择中奖组合，编号与符号 ID 是两回事。</p>
        <div className="payline-grid" style={{gridTemplateColumns:`repeat(${config.columnHeights.length}, minmax(52px,1fr))`}}>{gridCells(config.columnHeights).map(cell=><button key={cell.id} style={{gridColumn:cell.column+1,gridRow:cell.row+1}} className={selected.includes(cell.id)?'selected':''} aria-pressed={selected.includes(cell.id)} aria-label={`格子 ${cell.id}`} onClick={()=>setSelected(current=>current.includes(cell.id)?current.filter(id=>id!==cell.id):[...current,cell.id])}>{cell.id}</button>)}</div>
        <p>当前选择：{selected.join('、')||'未选择'}</p><div className="payline-actions"><button className="button primary" onClick={commitGroup} disabled={selected.length<2}>{editing===null?'添加中奖组合':'更新中奖组合'}</button><button className="button secondary" onClick={()=>{setSelected([]);setEditing(null);}}>取消选择</button></div>
        <ol className="payline-groups">{config.lines.map((line,i)=><li key={i}><button onClick={()=>{setSelected([...line]);setEditing(i);}} aria-label={`编辑组合 ${i+1}`}>{line.join(' · ')}</button><button aria-label={`删除组合 ${i+1}`} onClick={()=>{if(window.confirm(`删除第 ${i+1} 个中奖组合？`)){setConfig({...config,lines:config.lines.filter((_,index)=>index!==i)});setSelected([]);setEditing(null);}}}>删除</button></li>)}</ol>
      </section>
      <div><section className="payline-card"><h2>符号与每线赔率</h2><p>生成权重用于普通盘面生成；当前权重尚未调 RTP。空白 ID 0 不参与中奖。</p><div className="payline-table"><table><thead><tr><th>ID</th><th>符号</th><th>类型</th><th>每线赔率</th><th>生成权重</th><th>操作</th></tr></thead><tbody>{config.symbols.map((s,i)=><tr key={i}>
        <td><input aria-label={`符号 ${i+1} ID`} type="number" value={Number.isFinite(s.id)?s.id:''} onChange={e=>updateSymbol(i,{id:e.target.valueAsNumber})}/></td>
        <td><input aria-label={`符号 ${i+1} 名称`} value={s.name} onChange={e=>updateSymbol(i,{name:e.target.value})}/></td>
        <td><select aria-label={`符号 ${i+1} 类型`} value={s.role} onChange={e=>updateSymbol(i,{role:e.target.value as 'normal'|'wild'})}><option value="normal">普通</option><option value="wild">Wild</option></select></td>
        <td><input aria-label={`符号 ${i+1} 赔率`} type="number" min="0" value={Number.isFinite(s.payout)?s.payout:''} onChange={e=>updateSymbol(i,{payout:e.target.valueAsNumber})}/></td>
        <td><input aria-label={`符号 ${i+1} 权重`} type="number" min="0" value={Number.isFinite(s.weight)?s.weight:''} onChange={e=>updateSymbol(i,{weight:e.target.valueAsNumber})}/></td>
        <td><button onClick={()=>{if(window.confirm(`删除符号 ${s.name}？`)){setConfig({...config,symbols:config.symbols.filter((_,index)=>index!==i)});setBoard(board.map(id=>id===s.id?0:id));}}}>删除</button></td></tr>)}</tbody></table></div>
        <button className="button secondary" onClick={()=>setConfig({...config,symbols:[...config.symbols,{id:Math.max(0,...config.symbols.map(s=>s.id))+1,name:'新符号',role:'normal',payout:0,weight:1}]})}>添加符号</button>
      </section>
      <TigerGenerationSettings config={config} onChange={setConfig}/>
      <TigerSkeletonPanel config={config} gameId={document.gameId} revision={revision} dirty={dirty} onSaving={v=>{setLibrarySaving(v);onSaving(v);}}/>
      <PaylineBoard config={config} board={board} setBoard={setBoard} result={result} bet={bet} setBet={setBet} randomize={()=>attempt(()=>setBoard(generatePaylineBoard(config)))}/>
      </div>
    </div></fieldset>
  </>;
}
