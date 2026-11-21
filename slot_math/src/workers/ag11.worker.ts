import {parseWeightTable} from '../domain/model';
import {validateGameFiles, type GameFiles} from '../domain/settings';
import {Ag11Simulator, type Ag11SimulationMode} from '../domain/ag11Simulation';
import type {Ag11Parameters} from '../domain/ag11Math';

type Start = {type:'simulate';files:GameFiles;mode:Ag11SimulationMode;count:number;seed:number};
const worker=self as unknown as {onmessage:((event:MessageEvent<Start|{type:'stop'}>)=>void)|null;postMessage(value:unknown):void};
let simulation:Ag11Simulator|null=null,count=0,stopped=false,last=0;
worker.onmessage=({data})=>{
  if(data.type==='stop'){stopped=true;return;}
  try{
    validateGameFiles(data.files);
    if(!Number.isSafeInteger(data.count)||data.count<1||data.count>1_000_000_000||!Number.isSafeInteger(data.seed)||data.seed<0||data.seed>0xffffffff)throw Error('模拟局数或随机种子无效。');
    stopped=false;last=0;count=data.count;
    const p=data.files.config.parameters as unknown as Ag11Parameters;
    simulation=new Ag11Simulator(parseWeightTable(JSON.stringify(data.files.base)),parseWeightTable(JSON.stringify(data.files.free)),p,data.mode,data.seed);
    tick();
  }catch(e){worker.postMessage({type:'error',message:(e as Error).message});}
};
function tick(){
  try{
    const deadline=performance.now()+25;
    while(!stopped&&simulation&&simulation.count<count&&performance.now()<deadline)simulation.step();
    const done=stopped||!simulation||simulation.count>=count;
    if(done||performance.now()-last>250){worker.postMessage({type:done?'complete':'progress',result:simulation?.result()});last=performance.now();}
    if(!done)setTimeout(tick,0);else simulation=null;
  }catch(e){worker.postMessage({type:'error',message:(e as Error).message});simulation=null;}
}
