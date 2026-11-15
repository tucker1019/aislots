import * as fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {FileError} from './game-files.mjs';
export function createRabbitLibraryStore(root,paylineStore,gameStore,validate,coverage){
 async function directory(dir){await fs.mkdir(dir,{recursive:true});const stat=await fs.lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw new FileError(400,'骨架库必须使用实际目录。');}
 return {async save(gameId,revision,value){
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(gameId))throw new FileError(400,'游戏编号无效。');
  const current=await paylineStore.read(gameId),game=await gameStore.read(gameId);
  if(current.revision!==revision||game.revision!==value?.gameRevision)throw new FileError(409,'盘面配置或数值表已改变，请重新读取并生成。');
  if(game.files.config.ruleType!=='fortune_rabbit_v1'||current.file.ruleType!=='fortune_rabbit_v1'||game.files.config.parameters.lineCount!==10)throw new FileError(422,'当前游戏不是金兔规则。');
  try{validate(value,current.file);}catch(e){throw new FileError(422,e.message);}
  const mode=value.mode,validation=coverage(value,game.files[mode]),data=JSON.stringify(value.buckets)+'\n',bytes=Buffer.byteLength(data);
  if(bytes>24*1024*1024)throw new FileError(413,'骨架库超过容量限制。');
  await directory(root);const gameRoot=path.join(root,gameId);await directory(gameRoot);const modeRoot=path.join(gameRoot,mode);await directory(modeRoot);
  const runId=`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`,temp=path.join(modeRoot,`.${runId}.tmp`);await fs.mkdir(temp);
  try{
   const manifest={version:1,format:'rabbit-skeleton-v1',gameId,mode,createdAt:new Date().toISOString(),paylineRevision:revision,gameRevision:game.revision,config:current.file,numericalConfig:game.files.config,table:game.files[mode],dataHash:createHash('sha256').update(data).digest('hex'),options:value.options,stats:value.stats,partial:value.partial,candidate:true,validation,multiplierUnit:'raw-before-line-count',positionOrder:'column-major-top-to-bottom-zero-based',unit:mode==='base'?'one-winning-normal-spin':'one-winning-special-spin'};
   await fs.writeFile(path.join(temp,'library.json'),data,{flag:'wx'});await fs.writeFile(path.join(temp,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
   if((await paylineStore.read(gameId)).revision!==revision||(await gameStore.read(gameId)).revision!==game.revision)throw new FileError(409,'保存期间配置发生变化，请重新生成。');
   await fs.rename(temp,path.join(modeRoot,runId));
  }catch(error){await fs.rm(temp,{recursive:true,force:true});throw error;}
  return {path:`game_libraries/${gameId}/${mode}/${runId}/library.json`,bytes,retained:value.stats.retained,validation};
 }};
}
