// Explicit integration fixture. Never modifies game_configs or game_libraries.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../testdata/integration/AG1/',import.meta.url);
await fs.mkdir(root,{recursive:true});
const actual=new URL('../../game_configs/AG1/',import.meta.url);
const board=JSON.parse(await fs.readFile(new URL('board.json',actual),'utf8'));
const config=JSON.parse(await fs.readFile(new URL('config.json',actual),'utf8'));
config.parameters.lossStreakRtpCompensation=false;
config.parameters.freeTriggerRtpCompensation=false;
const one=[3,0,1,4,1,9,1,0],two=[3,0,1,4,1,9,1,3,0,1,4,1,9,1,0];
if(JSON.stringify(board.columnHeights)!==JSON.stringify([4,5,5,5,4])||board.symbols.find(s=>s.id==='1')?.payouts[3]!==2||board.cascadeFactors[0]!==1||board.cascadeFactors[1]!==2||board.freeCascadeFactors[0]!==2||board.freeCascadeFactors[1]!==4)throw new Error('Source rules changed; update integration fixture explicitly');
for(const[name,value]of Object.entries({config,board,base:[[2,3],[6,1]],free:[[4,3],[12,1]]}))await fs.writeFile(new URL(name+'.json',root),JSON.stringify(value,null,2)+'\n');
for(const mode of ['base','free']){
 const dir=new URL('library/'+mode+'/',root);await fs.mkdir(dir,{recursive:true});
 const buckets=mode==='base'?{'2':[one],'6':[two]}:{'4':[one],'12':[two]};const bytes=JSON.stringify(buckets)+'\n';
 const hash=x=>createHash('sha256').update(x).digest('hex');
 const manifest={version:1,format:'winning-skeleton-v1',gameId:'AG1',mode,multiplierUnit:'raw-before-line-count',positionOrder:'column-major-top-to-bottom-zero-based',config:board,configHash:hash(JSON.stringify(board)),dataHash:hash(bytes),integrationFixture:true};
 await fs.writeFile(new URL('library.json',dir),bytes);await fs.writeFile(new URL('manifest.json',dir),JSON.stringify(manifest,null,2)+'\n');
}
