import {Ag11SkeletonGenerator,type Ag11LibraryOptions} from '../domain/ag11Skeleton';
import type {Ag11BoardConfig} from '../domain/ag11Math';
import {seededRandom} from '../domain/simulation';
type Start={type:'generate';config:Ag11BoardConfig;options:Ag11LibraryOptions;targets:number[]}|{type:'stop'};
const worker=self as unknown as {onmessage:((event:MessageEvent<Start>)=>void)|null;postMessage(value:unknown):void};
let generator:Ag11SkeletonGenerator|null=null,stopped=false,last=0;
worker.onmessage=({data})=>{if(data.type==='stop'){stopped=true;return;}try{stopped=false;last=0;generator=new Ag11SkeletonGenerator(data.config,data.options,data.targets,seededRandom(data.options.seed));tick();}catch(e){worker.postMessage({type:'error',message:(e as Error).message});}};
function tick(){try{const deadline=performance.now()+25;while(!stopped&&generator&&!generator.done&&performance.now()<deadline)generator.step();const done=stopped||!generator||generator.done;if(done||performance.now()-last>250){worker.postMessage({type:done?'complete':'progress',result:generator?.result(stopped)});last=performance.now();}if(!done)setTimeout(tick,0);else generator=null;}catch(e){worker.postMessage({type:'error',message:(e as Error).message});generator=null;}}
