import {fillBoard,measureScenes,simulateBoard,type FreeTarget} from '../domain/boardFill';
import {seededRandom} from '../domain/simulation';
import type {CascadeConfig,BoardMode} from '../domain/cascade';
const worker=self as unknown as {onmessage:((event:MessageEvent<{config:CascadeConfig;mode:BoardMode;count:number;seed:number;freeTarget:FreeTarget}>)=>void)|null;postMessage(value:unknown):void};
worker.onmessage=({data})=>{
  try{
    if(!Number.isSafeInteger(data.count)||data.count<1||data.count>10000||!Number.isSafeInteger(data.seed)||data.seed<0||data.seed>0xffffffff)throw new Error('对比局数需为1–10000，种子为uint32。');
    const fresh=()=>({success:0,failed:0,mismatches:0,scenes:0,twoFree:0,nearMiss:0,highNearMiss:0,repeated:0,normalCells:0,attempts:0,rejectedCandidates:0,elapsedMs:0});
    const stats={completed:0,skipped:0,paired:0,count:data.count,seed:data.seed,base:fresh(),weighted:fresh()};
    const sourceRandom=seededRandom(data.seed),started=performance.now();let last=0;
    function tick(){
      const deadline=performance.now()+25;
      do{
        let reference;
        try{reference=simulateBoard(data.config,data.mode,sourceRandom);}catch{stats.completed++;stats.skipped++;continue;}
        const accepted: Partial<Record<'base'|'weighted',ReturnType<typeof measureScenes>>>={};
        for(const [name,n]of [['base',0],['weighted',data.config.fillWeightIncrement]] as const){
          const target=stats[name];
          try{
            const result=fillBoard(reference,name==='base'?{...data.config,scatterWeightIncrement:0}:data.config,n,seededRandom((data.seed^Math.imul(stats.completed+1,2654435761))>>>0),undefined,64,data.freeTarget);
            const measured=measureScenes(result.round,data.config);
            accepted[name]=measured;
            target.success++;target.attempts+=result.metrics.attempts;target.rejectedCandidates+=result.metrics.rejectedCandidates;target.elapsedMs+=result.metrics.elapsedMs;
            if(result.round.totalPayout!==reference.totalPayout)target.mismatches++;
          }catch{target.failed++;}
        }
        if(accepted.base&&accepted.weighted){
          stats.paired++;
          for(const name of ['base','weighted'] as const)for(const key of ['scenes','twoFree','nearMiss','highNearMiss','repeated','normalCells'] as const)stats[name][key]+=accepted[name]![key];
        }
        stats.completed++;
      }while(stats.completed<data.count&&performance.now()<deadline);
      if(stats.completed===data.count||performance.now()-last>200){worker.postMessage({type:'progress',stats:structuredClone(stats),done:stats.completed===data.count,elapsedMs:performance.now()-started});last=performance.now();}
      if(stats.completed<data.count)setTimeout(tick,0);
    }
    tick();
  }catch(error){worker.postMessage({type:'error',message:(error as Error).message});}
};
