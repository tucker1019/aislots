import {useEffect,useRef,useState} from 'react';
import type {CascadeGame} from './useCascadeGame';
interface Totals{success:number;failed:number;mismatches:number;scenes:number;twoFree:number;nearMiss:number;highNearMiss:number;repeated:number;normalCells:number;attempts:number;rejectedCandidates:number;elapsedMs:number}
interface Comparison{completed:number;count:number;seed:number;skipped:number;paired:number;base:Totals;weighted:Totals}
const rate=(n:number,d:number)=>d?`${(n/d*100).toFixed(2)}%`:'—';
export function BoardFillSection({game,onRunning}:{game:CascadeGame;onRunning:(running:boolean)=>void}){
  const {config,mode,freeTarget,fillMetrics}=game;
  const [count,setCount]=useState('1000'),[running,setRunning]=useState(false),[stats,setStats]=useState<Comparison|null>(null),[error,setError]=useState('');
  const worker=useRef<Worker|null>(null),signature=JSON.stringify({config,mode,freeTarget}),previous=useRef(signature);
  useEffect(()=>()=>{worker.current?.terminate();worker.current=null;},[]);
  useEffect(()=>{onRunning(running);return()=>onRunning(false);},[running,onRunning]);
  useEffect(()=>{if(signature===previous.current)return;previous.current=signature;worker.current?.terminate();worker.current=null;setRunning(false);setStats(null);setError('');},[signature]);
  function compare(){
    try{
      const amount=Number(count),seed=game.seed.trim()?Number(game.seed):crypto.getRandomValues(new Uint32Array(1))[0];
      if(!Number.isSafeInteger(amount)||amount<1||amount>10000||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error('对比局数1–10000，随机种子需为uint32或留空。');
      const instance=new Worker(new URL('../../workers/boardFill.worker.ts',import.meta.url),{type:'module'});worker.current=instance;setRunning(true);setStats(null);setError('');
      instance.onmessage=({data})=>{if(worker.current!==instance)return;if(data.type==='error'){setError(data.message);setRunning(false);instance.terminate();worker.current=null;return;}setStats(data.stats);if(data.done){setRunning(false);instance.terminate();worker.current=null;}};
      instance.onerror=()=>{if(worker.current!==instance)return;setError('补空对比线程失败。');setRunning(false);instance.terminate();worker.current=null;};
      instance.postMessage({config:structuredClone(config),mode,count:amount,seed,freeTarget});
    }catch(e){setError((e as Error).message);}
  }
  return <section className="dev-panel fill-panel">
    <div className="panel-heading"><div><h2>补空策略与效果对比</h2><p>同一批骨架对比：普通与免费额外加权均为0，以及左侧当前配置。两组都执行整局检查。</p></div></div>
    <div className="library-controls">
      <label>当前配置加权 n<output aria-label="当前补空累计加权">{config.fillWeightIncrement}</output></label>
      <label>免费换列加权 n<output aria-label="当前免费换列加权">{config.scatterWeightIncrement}</output></label>
      <label>对比局数<input aria-label="补空对比局数" type="number" min="1" max="10000" value={count} disabled={running} onChange={e=>setCount(e.target.value)}/></label>
      <button className="button primary" disabled={running||!!game.configError} onClick={compare}>{running?'正在对比…':'对比补空效果'}</button>
      {running&&<button className="button secondary" onClick={()=>{worker.current?.terminate();worker.current=null;setRunning(false);}}>停止对比</button>}
    </div>
    <p className="library-note">普通图标按列从上到下补空，抽中后权重加 n；换列、下一轮补充不重置，每局重置。免费图标换列恢复基础权重＋独立 n，列内抽中即禁用，不逐列累加。禁止补入当前中奖图标，百搭/金底按实际匹配参与候选排除。免费图标仅在骨架外按权重补入，每轮每列最多新增1个，未中免费整局最多2个。无合法候选时整局重试，最多64次；失败会报错，不返回改奖盘面。n 只读取左侧「补空规则」配置，保存到 board.json。</p>
    {fillMetrics&&<p className="library-note">当前盘面：免费图标 {fillMetrics.scatterCount} 个 · 补空 {fillMetrics.filledCells} 格 · 尝试 {fillMetrics.attempts} 次 · 排除候选 {fillMetrics.rejectedCandidates} 次 · 耗时 {fillMetrics.elapsedMs.toFixed(1)} ms · 整条中奖链及奖金已校验。</p>}
    {error&&<p className="dev-alert" role="alert">{error}</p>}
    {stats&&<>
      <p className="library-note" role="status">已对比 {stats.completed} / {stats.count} 局 · {mode==='base'?'普通':'免费'} · 种子 {stats.seed} · 两组均成功 {stats.paired} 局 · 原始盘面超限跳过 {stats.skipped}</p>
      <div className="library-preview"><table><thead><tr><th>指标</th><th>额外加权为0</th><th>当前配置</th></tr></thead><tbody>
        {([
          ['成功 / 失败',(s:Totals)=>`${s.success} / ${s.failed}`],
          ['两免费图标盘面率',(s:Totals)=>rate(s.twoFree,s.scenes)],
          ['差一列盘面率',(s:Totals)=>rate(s.nearMiss,s.scenes)],
          ['前三高赔差一列率',(s:Totals)=>rate(s.highNearMiss,s.scenes)],
          ['同列重复率',(s:Totals)=>rate(s.repeated,s.normalCells)],
          ['通过样本奖金一致率',(s:Totals)=>rate(s.success-s.mismatches,s.success)],
          ['平均尝试次数',(s:Totals)=>s.success?(s.attempts/s.success).toFixed(2):'—'],
          ['平均补空耗时',(s:Totals)=>s.success?`${(s.elapsedMs/s.success).toFixed(2)} ms`:'—'],
        ] as const).map(([name,format])=><tr key={name}><td>{name}</td><td>{format(stats.base)}</td><td>{format(stats.weighted)}</td></tr>)}
      </tbody></table></div>
    </>}
    <p className="library-note">差一列：非中奖图标在前两列可匹配，第3列不能匹配；按初始及每次补充后的盘面统计。前三高赔按3列原始赔率排序。同列重复率为每种普通图标扣除首个后的格数占比，金底与原图标合并、百搭不计。表现率仅比较两组均成功的同一批骨架；失败率单列报告，效果高低以实际对比为准。</p>
  </section>;
}
