import { useEffect, useMemo, useRef, useState } from 'react';
import type { CascadeConfig, BoardMode } from '../../domain/cascade';
import { type LibraryResult, type LibraryStats, LIBRARY_LIMITS, auditLibrary } from '../../domain/boardLibrary';
import { useGameWorkspace } from '../../state/GameWorkspace';
import { saveLibrary } from '../../services/gameFiles';

export function BoardLibraryPanel({gameId,revision,config,dirty,invalid}: {gameId:string;revision:string;config:CascadeConfig;dirty:boolean;invalid:string}) {
  const workspace = useGameWorkspace();
  const [mode,setMode]=useState<BoardMode>('base');
  const [count,setCount]=useState('100000');
  const [perMultiplier,setPerMultiplier]=useState('100');
  const [seed,setSeed]=useState('');
  const [status,setStatus]=useState('准备生成');
  const [running,setRunning]=useState(false);
  const [saving,setSaving]=useState(false);
  const [stats,setStats]=useState<LibraryStats|null>(null);
  const [elapsed,setElapsed]=useState(0);
  const [result,setResult]=useState<LibraryResult|null>(null);
  const [error,setError]=useState('');
  const [saved,setSaved]=useState('');
  const worker=useRef<Worker|null>(null);
  const signature=JSON.stringify(config);
  const previous=useRef(signature);
  const generation=useRef(0);
  const captured=useRef({revision,signature});
  useEffect(()=>()=>{worker.current?.terminate();generation.current++;},[]);
  useEffect(()=>{
    if(previous.current===signature)return;
    previous.current=signature;worker.current?.terminate();worker.current=null;generation.current++;
    setRunning(false);setResult(null);setStats(null);setSaved('');setError('');setStatus('配置已改变，请保存配置后重新生成');
  },[signature]);
  function start() {
    try {
      if(dirty)throw new Error('请先保存盘面配置，再生成盘面库。');
      if(invalid)throw new Error(invalid);
      const options={mode,count:Number(count),perMultiplier:Number(perMultiplier),seed:seed.trim()?Number(seed):crypto.getRandomValues(new Uint32Array(1))[0]};
      if(!Number.isSafeInteger(options.count)||options.count<1||options.count>LIBRARY_LIMITS.count||!Number.isSafeInteger(options.perMultiplier)||options.perMultiplier<1||options.perMultiplier>LIBRARY_LIMITS.perMultiplier||!Number.isSafeInteger(options.seed)||options.seed<0||options.seed>0xffffffff)throw new Error('局数需为1–1亿、每倍率保留1–10000条，种子需为uint32或留空。');
      worker.current?.terminate();
      const instance=new Worker(new URL('../../workers/boardLibrary.worker.ts',import.meta.url),{type:'module'});
      worker.current=instance;const token=++generation.current;captured.current={revision,signature};
      setRunning(true);setResult(null);setStats(null);setElapsed(0);setError('');setSaved('');setStatus('正在生成');
      instance.onmessage=({data})=>{
        if(worker.current!==instance||token!==generation.current)return;
        if(data.type==='error'){setError(data.message);setStatus('生成失败');setRunning(false);instance.terminate();worker.current=null;return;}
        setElapsed(data.elapsedMs);
        if(data.type==='progress'){setStats(data.stats);return;}
        setStats(data.result.stats);setResult(data.result);setStatus(data.cancelled?'已停止，可保存已完成结果':'生成完成');setRunning(false);instance.terminate();worker.current=null;
      };
      instance.onerror=()=>{if(worker.current!==instance)return;setError('生成线程异常，请重试。');setRunning(false);setStatus('生成失败');instance.terminate();worker.current=null;};
      instance.postMessage({type:'start',config:structuredClone(config),options});
    }catch(e){setError((e as Error).message);}
  }
  async function save() {
    if(!result||saving)return;
    const token=generation.current;
    try{
      if(dirty||signature!==captured.current.signature||revision!==captured.current.revision)throw new Error('配置已改变，请重新生成。');
      setSaving(true);setError('');
      const value=await saveLibrary(gameId,captured.current.revision,result);
      if(token===generation.current)setSaved(`${value.path}（${(value.bytes/1024).toFixed(1)} KiB）`);
    }catch(e){if(token===generation.current)setError((e as Error).message);}
    finally{setSaving(false);}
  }
  const weights = workspace.document?.gameId === gameId ? workspace.document.files[result?.options.mode ?? mode] : undefined;
  const audit = useMemo(() => result && weights ? auditLibrary(result, config, weights) : null, [result, config, weights]);
  const rows=Object.entries(result?.buckets??{}).sort(([a],[b])=>Number(a)-Number(b));
  return <section className="dev-panel board-library-panel">
    <div className="panel-heading"><div><h2>生成盘面库</h2><p>只保留完整中奖链，按原始累计倍率分桶；实际倍率再除以线数。</p></div><span role="status">{status}</span></div>
    <div className="library-controls">
      <label>生成模式<select aria-label="盘面库生成模式" value={mode} disabled={running||saving} onChange={e=>setMode(e.target.value as BoardMode)}><option value="base">普通</option><option value="free">免费</option></select></label>
      <label>生成局数<input aria-label="盘面库生成局数" type="number" min="1" max={LIBRARY_LIMITS.count} step="1" value={count} disabled={running||saving} onChange={e=>setCount(e.target.value)}/></label>
      <label>每倍率最多保留<input aria-label="每倍率最多保留" type="number" min="1" max={LIBRARY_LIMITS.perMultiplier} step="1" value={perMultiplier} disabled={running||saving} onChange={e=>setPerMultiplier(e.target.value)}/></label>
      <label>随机种子<input aria-label="盘面库随机种子" type="number" placeholder="留空随机" min="0" max="4294967295" value={seed} disabled={running||saving} onChange={e=>setSeed(e.target.value)}/></label>
      <button className="button primary" disabled={running||saving||dirty||!!invalid} onClick={start}>开始生成盘面库</button>
      {running&&<button className="button secondary" onClick={()=>{worker.current?.postMessage({type:'stop'});setStatus('正在停止');}}>停止并保留结果</button>}
      <button className="button secondary" disabled={!result||!result.stats.retained||running||saving||dirty||revision!==captured.current.revision} onClick={()=>void save()}>{saving?'正在保存…':'保存盘面库'}</button>
    </div>
    {dirty&&<p className="library-note">请先保存盘面配置，生成使用已保存配置对应的规则。</p>}
    <p className="library-note">支持生成1亿局。每个倍率去重、限量保留；样本满后随机替换。总保留上限10万条，骨架文本预算32 MiB，达到容量后继续统计但不再增加样本。此处生成的是单次消除链，不执行免费触发或赠送。</p>
    {error&&<p className="dev-alert" role="alert">{error}</p>}
    {stats&&<div className="library-summary"><progress aria-label="盘面库生成进度" value={stats.completed} max={result?.options.count??Number(count)}/><p>已生成 {stats.completed.toLocaleString()} 局 · 中奖 {stats.wins.toLocaleString()} · 未中奖 {stats.losses.toLocaleString()} · 消除超限丢弃 {stats.limited.toLocaleString()}</p><p>已保留 {stats.retained.toLocaleString()} 条 · 发现倍率 {stats.bucketCount.toLocaleString()} 种 · 重复跳过 {stats.duplicates.toLocaleString()} · 容量跳过 {stats.capacitySkipped.toLocaleString()} · 耗时 {(elapsed/1000).toFixed(1)} 秒</p></div>}
    {result&&<p className="library-note">本次模式：{result.options.mode==='base'?'普通':'免费'} · 种子：{result.options.seed} · 已完成 {result.stats.completed.toLocaleString()} / {result.options.count.toLocaleString()} 局</p>}
    {audit && <div className="library-summary" role="status">
      <p>游戏 {gameId} · 列高 {config.columnHeights.join('/')} · {audit.ready ? '验收通过，可作为启用候选' : '验收未通过，仅可保存为候选，不能启用'}</p>
      <p>倍率覆盖 {audit.coveredMultipliers} / {audit.requiredMultipliers}</p>
      {!!audit.missingMultipliers.length && <p>缺失倍率 {audit.missingMultipliers.join('、')}</p>}
      <p>{audit.symbolWins.map(symbol => symbol.name + '中奖骨架 ' + symbol.records.toLocaleString() + ' 条').join(' · ')}</p>
    </div>}
    {saved&&<p className="library-saved" role="status">已保存：{saved}</p>}
    {rows.length>0&&<div className="library-preview"><table><thead><tr><th>原始累计倍率</th><th>保留条数</th><th>骨架示例</th></tr></thead><tbody>{rows.slice(0,50).map(([key,records])=><tr key={key}><td>{key}</td><td>{records.length}</td><td><code>{JSON.stringify(records[0])}</code></td></tr>)}</tbody></table>{rows.length>50&&<p>仅预览前50个倍率，保存包含全部 {rows.length} 个桶。</p>}</div>}
  </section>;
}
