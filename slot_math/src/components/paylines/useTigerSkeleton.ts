import {useEffect,useRef,useState} from 'react';
import {validatePaylines,type PaylineConfig} from '../../domain/paylines';
import {validateTigerSkeletonOptions,type TigerSkeletonOptions,type TigerSkeletonLibrary,type TigerSkeletonStats,type TigerMode} from '../../domain/tigerSkeleton';
interface Run {result:TigerSkeletonLibrary;elapsedMs:number;gameRevision:string}
type Reply={type:'progress';stats:TigerSkeletonStats;elapsedMs:number}|{type:'complete';result:TigerSkeletonLibrary;elapsedMs:number}|{type:'error';message:string};
export function useTigerSkeleton(config:PaylineConfig,paylineRevision:string,gameRevision:string){
 const worker=useRef<Worker|null>(null),[running,setRunning]=useState(false),[stopping,setStopping]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState<{mode:TigerMode;stats:TigerSkeletonStats;elapsedMs:number;target:number}|null>(null),[results,setResults]=useState<Partial<Record<TigerMode,Run>>>({});
 const fingerprint=JSON.stringify(config);
 useEffect(()=>{worker.current?.terminate();worker.current=null;setResults({});setProgress(null);setRunning(false);setStopping(false);setError('');return()=>{worker.current?.terminate();worker.current=null;};},[fingerprint,paylineRevision,gameRevision]);
 function start(options:TigerSkeletonOptions){if(worker.current)return;try{
  validatePaylines(config);validateTigerSkeletonOptions(options);const w=new Worker(new URL('../../workers/tigerSkeleton.worker.ts',import.meta.url),{type:'module'});worker.current=w;setRunning(true);setStopping(false);setError('');setProgress(null);setResults(old=>({...old,[options.mode]:undefined}));
  const finish=()=>{w.terminate();if(worker.current===w){worker.current=null;setRunning(false);setStopping(false);}};
  w.onmessage=({data}:MessageEvent<Reply>)=>{if(worker.current!==w)return;if(data.type==='error'){setError(data.message);finish();}else if(data.type==='progress'){setProgress({...data,mode:options.mode,target:options.count});}else{setResults(old=>({...old,[options.mode]:{result:data.result,elapsedMs:data.elapsedMs,gameRevision}}));setProgress({mode:options.mode,stats:data.result.stats,elapsedMs:data.elapsedMs,target:options.count});finish();}};
  w.onerror=()=>{if(worker.current===w){setError('骨架生成失败，请减少生成数量后重试。');finish();}};w.postMessage({type:'start',config,options});
 }catch(e){setError((e as Error).message);setRunning(false);}}
 function stop(){if(worker.current&&!stopping){setStopping(true);worker.current.postMessage({type:'stop'});}}
 return {start,stop,running,stopping,error,progress,results};
}
