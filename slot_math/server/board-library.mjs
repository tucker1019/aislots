import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { FileError } from './game-files.mjs';
export function createLibraryStore(root, boardStore, validate) {
  async function actualDirectory(dir) {
    await fs.mkdir(dir,{recursive:true});
    const stat=await fs.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new FileError(400,'盘面库必须使用实际目录，不能是符号链接。');
  }
  return {
    async save(gameId, revision, value, mode) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(gameId) || !['base','free'].includes(mode)) throw new FileError(400,'游戏 ID 或盘面库模式无效。');
      const current=await boardStore.read(gameId);
      if (current.revision!==revision) throw new FileError(409,'盘面配置已改变，请重新读取并生成盘面库。');
      if (value?.options?.mode!==mode) throw new FileError(422,'盘面库模式不一致。');
      try {validate(value,{...current.file,lineCount:1});}
      catch(error){throw new FileError(422,error.message);}
      const bytes=JSON.stringify(value.buckets)+'\n';
      if (Buffer.byteLength(bytes)>32*1024*1024+1024*1024) throw new FileError(413,'盘面库超过保存容量，请减小保留条数后分批生成。');
      const modeRoot=path.join(root,gameId,mode);
      await actualDirectory(root);await actualDirectory(path.join(root,gameId));await actualDirectory(modeRoot);
      const runId=`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`;
      const temporary=path.join(modeRoot,`.${runId}.tmp`), destination=path.join(modeRoot,runId);
      await fs.mkdir(temporary);
      try {
        const manifest={version:1,format:'winning-skeleton-v1',gameId,mode,createdAt:new Date().toISOString(),boardRevision:revision,configHash:createHash('sha256').update(JSON.stringify(current.file)).digest('hex'),multiplierUnit:'raw-before-line-count',positionOrder:'column-major-top-to-bottom-zero-based',options:value.options,stats:value.stats,partial:value.stats.completed<value.options.count,config:current.file,dataHash:createHash('sha256').update(bytes).digest('hex')};
        await fs.writeFile(path.join(temporary,'library.json'),bytes,{flag:'wx'});
        await fs.writeFile(path.join(temporary,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
        if ((await boardStore.read(gameId)).revision!==revision) throw new FileError(409,'保存期间盘面配置发生变化，请重新生成。');
        await fs.rename(temporary,destination);
      } catch(error){await fs.rm(temporary,{recursive:true,force:true});throw error;}
      return {path:`game_libraries/${gameId}/${mode}/${runId}/library.json`,bytes:Buffer.byteLength(bytes),retained:value.stats.retained};
    },
  };
}
