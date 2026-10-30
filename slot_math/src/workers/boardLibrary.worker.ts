import { LibraryGenerator, type LibraryOptions } from '../domain/boardLibrary';
import { seededRandom } from '../domain/simulation';
import type { CascadeConfig } from '../domain/cascade';
const worker = self as unknown as {onmessage: ((event: MessageEvent<{type:'start';config:CascadeConfig;options:LibraryOptions}|{type:'stop'}>)=>void)|null;postMessage(value: unknown):void};
let generator: LibraryGenerator | null = null, stop = false, last = 0, started = 0;
worker.onmessage = ({data}) => {
  if (data.type==='stop') {stop=true;return;}
  try {generator=new LibraryGenerator(data.config,data.options,seededRandom(data.options.seed));stop=false;started=performance.now();tick();}
  catch(error){worker.postMessage({type:'error',message:(error as Error).message});}
};
function tick() {
  if (!generator) return;
  try {
    const deadline=performance.now()+25;
    while (!stop && !generator.done && performance.now()<deadline) generator.step();
    const elapsedMs=performance.now()-started;
    if (stop || generator.done) {worker.postMessage({type:'complete',result:generator.result(),cancelled:stop,elapsedMs});generator=null;return;}
    if (performance.now()-last>=200) {worker.postMessage({type:'progress',stats:{...generator.stats},elapsedMs});last=performance.now();}
    setTimeout(tick,0);
  } catch(error){worker.postMessage({type:'error',message:(error as Error).message});generator=null;}
}
