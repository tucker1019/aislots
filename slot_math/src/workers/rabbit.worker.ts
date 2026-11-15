import {parseWeightTable,calculateRabbitModel} from '../domain/model';
import {parametersFromFile,type GameFiles} from '../domain/settings';
import {RabbitSimulator} from '../domain/rabbitSimulation';
import {RabbitSkeletonGenerator,type RabbitConfig} from '../domain/fortuneRabbit';
import {seededRandom} from '../domain/simulation';
type Start={type:'simulate'|'theory';files:GameFiles;count:number;seed:number}|{type:'generate';config:RabbitConfig;options:RabbitSkeletonGenerator['options'];targets:number[]};
const worker=self as unknown as {onmessage:((event:MessageEvent<Start|{type:'stop'}>)=>void)|null;postMessage(value:unknown):void};
let simulation:RabbitSimulator|null=null,generator:RabbitSkeletonGenerator|null=null,count=0,stopped=false,last=0;
worker.onmessage=({data})=>{
 if(data.type==='stop'){stopped=true;return;}
 try{
  stopped=false;last=0;simulation=null;generator=null;
  if(data.type==='generate')generator=new RabbitSkeletonGenerator(data.config,data.options,data.targets,seededRandom(data.options.seed));
  else {const base=parseWeightTable(JSON.stringify(data.files.base)),free=parseWeightTable(JSON.stringify(data.files.free));
   if(data.type==='theory'){worker.postMessage({type:'complete',result:calculateRabbitModel(base,free,parametersFromFile(data.files.config.parameters))});return;}
   if(!Number.isSafeInteger(data.count)||data.count<1||data.count>1e9||!Number.isSafeInteger(data.seed)||data.seed<0||data.seed>0xffffffff)throw Error('模拟次数或种子无效。');
   simulation=new RabbitSimulator(base,free,parametersFromFile(data.files.config.parameters),data.seed);count=data.count;
  }tick();
 }catch(e){worker.postMessage({type:'error',message:(e as Error).message});}
};
function tick(){try{
 const deadline=performance.now()+25;
 while(!stopped&&performance.now()<deadline){if(simulation){if(simulation.count>=count)break;simulation.step();}else if(generator){if(generator.done)break;generator.step();}else return;}
 const done=stopped||(simulation?simulation.count>=count:generator!.done);
 if(done||performance.now()-last>250){worker.postMessage({type:done?'complete':'progress',result:simulation?simulation.result():done?generator!.result(stopped):{generated:generator!.generated,retained:generator!.retained}});last=performance.now();}
 if(!done)setTimeout(tick,0);else {simulation=null;generator=null;}
 }catch(e){worker.postMessage({type:'error',message:(e as Error).message});simulation=null;generator=null;}}
