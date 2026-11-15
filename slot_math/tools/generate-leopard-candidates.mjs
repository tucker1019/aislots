// Uses exactly the developer worker generator and revision-checked candidate store.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadTypeScript} from '../tests/helpers/typescript.mjs';
import {createGameStore,createPaylineStore} from '../server/game-files.mjs';
import {createTigerLibraryStore} from '../server/tiger-library.mjs';
const {validateGameFiles}=loadTypeScript(new URL('../src/domain/settings.ts',import.meta.url));
const {validatePaylines}=loadTypeScript(new URL('../src/domain/paylines.ts',import.meta.url));
const {LeopardSkeletonGenerator}=loadTypeScript(new URL('../src/domain/leopardSkeleton.ts',import.meta.url));
const {validateTigerSkeletonLibrary,tigerCoverage}=loadTypeScript(new URL('../src/domain/tigerSkeleton.ts',import.meta.url));
const root=fileURLToPath(new URL('../../',import.meta.url)),gameStore=createGameStore(path.join(root,'game_configs'),validateGameFiles),paylineStore=createPaylineStore(path.join(root,'game_configs'),validatePaylines),store=createTigerLibraryStore(path.join(root,'game_libraries'),paylineStore,gameStore,validateTigerSkeletonLibrary,tigerCoverage);
const game=await gameStore.read('AG9'),board=await paylineStore.read('AG9');
for(const mode of (process.argv[2]?[process.argv[2]]:['base','free'])){
 const g=new LeopardSkeletonGenerator(board.file,{mode,count:mode==='base'?7**9:6*3**9,seed:1021,perMultiplier:3,maxRetained:15000});
 while(!g.done)g.step();const result=g.result();validateTigerSkeletonLibrary(result,board.file);
 const coverage=tigerCoverage(result,game.files[mode]);console.log(JSON.stringify({mode,coverage,reachable:Object.keys(result.buckets).sort((a,b)=>Number(a)-Number(b))}));
 const saved=await store.save('AG9',board.revision,{...result,gameRevision:game.revision});console.log(JSON.stringify({mode,...saved,generated:g.stats.generated}));
}
