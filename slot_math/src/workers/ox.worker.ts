import {parseWeightTable} from '../domain/model';
import {type GameFiles,validateGameFiles,parametersFromFile} from '../domain/settings';
import {OxSimulator} from '../domain/oxSimulation';
import {OxSkeletonGenerator,type OxConfig,type OxOptions} from '../domain/fortuneOx';
type Start={type:'simulate';files:GameFiles;count:number;seed:number}|{type:'generate';config:OxConfig;options:OxOptions;targets:number[]};
const worker=self as unknown as {onmessage:((event:MessageEvent<Start|{type:'stop'}>)=>void)|null;postMessage(value:unknown):void};
let simulation:OxSimulator|null=null,generator:OxSkeletonGenerator|null=null,count=0,stopped=false,last=0;
worker.onmessage=({data})=>{
 if(data.type==='stop'){stopped=true;return;}
 try{
  stopped=false;last=0;simulation=null;generator=null;
  if(data.type==='generate')generator=new OxSkeletonGenerator(data.config,data.options,data.targets);
  else {validateGameFiles(data.files);if(!Number.isSafeInteger(data.count)||data.count<1||data.count>1e9)throw Error('模拟次数须为1～10亿。');simulation=new OxSimulator(parseWeightTable(JSON.stringify(data.files.base)),parseWeightTable(JSON.stringify(data.files.free)),parametersFromFile(data.files.config.parameters),data.seed);count=data.count;}
  tick();
 }catch(e){worker.postMessage({type:'error',message:(e as Error).message});}
};
function tick(){try{
 const deadline=performance.now()+25;
 while(!stopped&&performance.now()<deadline){if(simulation){if(simulation.count>=count)break;simulation.step();}else if(generator){if(generator.done)break;generator.step();}else return;}
 const done=stopped||(simulation?simulation.count>=count:generator!.done);
 if(done||performance.now()-last>250){worker.postMessage({type:done?'complete':'progress',result:simulation?simulation.result():done?generator!.result(stopped):generator!.stats});last=performance.now();}
 if(!done)setTimeout(tick,0);else {simulation=null;generator=null;}
 }catch(e){worker.postMessage({type:'error',message:(e as Error).message});simulation=null;generator=null;}}
