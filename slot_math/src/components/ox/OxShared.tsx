import {useEffect,useRef,useState} from 'react';
export {RabbitButton as AsyncButton,percent,multiple} from '../rabbit/RabbitShared';
export function useOxTask<Result>(snapshot:string){
 const worker=useRef<Worker|null>(null),[running,setRunning]=useState(false),[result,setResult]=useState<Result|null>(null),[progress,setProgress]=useState<Record<string,number>|null>(null),[error,setError]=useState('');
 useEffect(()=>{worker.current?.terminate();worker.current=null;setRunning(false);setResult(null);setProgress(null);setError('');return()=>{worker.current?.terminate();worker.current=null;};},[snapshot]);
 function start(request:unknown){if(worker.current)return;setError('');setResult(null);setProgress(null);setRunning(true);const w=new Worker(new URL('../../workers/ox.worker.ts',import.meta.url),{type:'module'});worker.current=w;
  const fail=(message:string)=>{if(worker.current!==w)return;setError(message);setRunning(false);w.terminate();worker.current=null;};
  w.onerror=e=>fail(e.message||'工作线程执行失败。');w.onmessage=({data})=>{if(worker.current!==w)return;if(data.type==='progress')setProgress(data.result);else if(data.type==='error')fail(data.message);else if(data.type==='complete'){setResult(data.result);setRunning(false);w.terminate();worker.current=null;}};w.postMessage(request);
 }
 return {running,result,progress,error,start,stop:()=>worker.current?.postMessage({type:'stop'})};
}
