import {RespinSimulation} from '../domain/respinSimulation';
import type {GameFiles} from '../domain/settings';
const worker=self as unknown as {onmessage:((event:MessageEvent<{type:'start';files:GameFiles;count:number;seed:number}|{type:'stop'}>)=>void)|null;postMessage(value:unknown):void};
let run:RespinSimulation|null=null,stop=false,last=0;
worker.onmessage=({data})=>{if(data.type==='stop'){stop=true;return;}try{run=new RespinSimulation(data.files,data.count,data.seed);stop=false;last=0;tick();}catch(e){worker.postMessage({type:'error',message:(e as Error).message});}};
function tick(){if(!run)return;try{const until=performance.now()+25;while(!stop&&!run.done&&performance.now()<until)run.step();if(stop||run.done){worker.postMessage({type:'complete',stats:run.stats});run=null;return;}if(performance.now()-last>250){last=performance.now();worker.postMessage({type:'progress',stats:run.stats});}setTimeout(tick,0);}catch(e){worker.postMessage({type:'error',message:(e as Error).message});run=null;}}
