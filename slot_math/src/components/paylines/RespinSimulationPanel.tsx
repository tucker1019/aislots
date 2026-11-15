import {useEffect,useRef,useState} from 'react';
import type {GameFiles,SimulationOptions} from '../../domain/settings';
import type {RespinSimulation} from '../../domain/respinSimulation';
import {AsyncButton} from '../ox/OxShared';
export function RespinSimulationPanel({files,options,onChange}:{files:GameFiles;options:SimulationOptions;onChange:(options:SimulationOptions)=>void}){
 const worker=useRef<Worker|null>(null),[running,setRunning]=useState(false),[error,setError]=useState(''),[stats,setStats]=useState<RespinSimulation['stats']|null>(null),[seed,setSeed]=useState(0),fingerprint=JSON.stringify(files);
 useEffect(()=>{worker.current?.terminate();worker.current=null;setRunning(false);setStats(null);return()=>worker.current?.terminate();},[fingerprint]);
 function start(){if(worker.current)return;const count=Number(options.count),actual=options.seed.trim()?Number(options.seed):crypto.getRandomValues(new Uint32Array(1))[0];if(!Number.isSafeInteger(count)||count<1||count>1e9||!Number.isSafeInteger(actual)||actual<0||actual>0xffffffff){setError('请输入有效局数和整数种子。');return;}
  setError('');setSeed(actual);setStats(null);const w=new Worker(new URL('../../workers/respin.worker.ts',import.meta.url),{type:'module'});worker.current=w;setRunning(true);
  const finish=()=>{w.terminate();if(worker.current===w){worker.current=null;setRunning(false);}};
  w.onmessage=({data})=>{if(worker.current!==w)return;if(data.type==='error'){setError(data.message);finish();}else{setStats(data.stats);if(data.type==='complete')finish();}};
  w.onerror=()=>{if(worker.current!==w)return;setError('模拟工作线程出错。');finish();};w.postMessage({type:'start',files,count,seed:actual});
 }
 return <section className="result-section respin-simulation"><h2>数值模拟</h2><div className="payline-actions"><label>付费局数<input aria-label="模拟付费局数" type="number" value={options.count} disabled={running} onChange={e=>onChange({...options,count:e.target.value})}/></label><label>随机种子<input aria-label="模拟随机种子" value={options.seed} disabled={running} onChange={e=>onChange({...options,seed:e.target.value})}/></label><AsyncButton aria-label="开始模拟" busy={running} onClick={start}>开始模拟</AsyncButton><button disabled={!running} onClick={()=>worker.current?.postMessage({type:'stop'})}>停止并保留</button></div>{error&&<p role="alert">{error}</p>}{stats&&<p role="status">已模拟 {stats.paidSpins.toLocaleString()} 局 · 重转 {stats.featureSpins.toLocaleString()} 局 · 中奖率 {(stats.hitProbability*100).toFixed(4)}% · 返还率 {(stats.rtp*100).toFixed(4)}% · 种子 {seed}</p>}<p>按中奖率和倍率权重开奖，模拟结果不依赖骨架库样本数量。</p></section>;
}
