import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const validId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export class FileError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function createFileStore(root, names, validate, io) {
  let pending = Promise.resolve();
  const serial = action => {
    const result = pending.then(action);
    pending = result.catch(() => {});
    return result;
  };
  const revision = buffers => createHash('sha256').update(Buffer.concat(buffers)).digest('hex');
  async function directory(gameId) {
    if (typeof gameId !== 'string' || !validId.test(gameId)) throw new FileError(400, '游戏 ID 只允许字母、数字、下划线和短横线。');
    const dir = path.join(root, gameId);
    const stat = await io.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new FileError(400, '游戏必须位于 game_configs 下的实际目录。');
    return dir;
  }
  async function readRaw(gameId) {
    const dir = await directory(gameId);
    const buffers = [];
    for (const name of names) {
      const file = path.join(dir, name);
      const stat = await io.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new FileError(400, `${name} 必须是实际 JSON 文件。`);
      buffers.push(await io.readFile(file));
    }
    return { dir, buffers, revision: revision(buffers) };
  }
  function decode(buffers) {
    return Object.fromEntries(names.map((name, index) => {
      try { return [name.slice(0, -5), JSON.parse(buffers[index].toString('utf8').replace(/^\uFEFF/, ''))]; }
      catch { throw new FileError(422, `${name} 不是有效的 JSON 文件。`); }
    }));
  }
  function checked(files) {
    try { return validate(files); }
    catch (error) { throw new FileError(422, error.message); }
  }
  return {
    list: () => serial(async () => {
      let entries;
      try { entries = await io.readdir(root, { withFileTypes: true }); }
      catch (error) { if (error.code === 'ENOENT') return []; throw error; }
      return entries.filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && validId.test(entry.name)).map(entry => entry.name).sort();
    }),
    read: gameId => serial(async () => {
      const raw = await readRaw(gameId);
      return { gameId, revision: raw.revision, files: checked(decode(raw.buffers)) };
    }),
    save: (gameId, expectedRevision, incoming) => serial(async () => {
      if (typeof expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(expectedRevision)) throw new FileError(400, '缺少有效的文件版本，请先读取游戏文件。');
      const files = checked(incoming);
      const raw = await readRaw(gameId);
      if (raw.revision !== expectedRevision) throw new FileError(409, '文件已被其他窗口或外部编辑器修改，请先重新读取文件。当前页面修改仍保留。');
      const buffers = names.map(name => Buffer.from(JSON.stringify(files[name.slice(0, -5)], null, 2) + '\n'));
      const staged = [], replaced = [];
      try {
        for (let index = 0; index < names.length; index++) {
          if (buffers[index].equals(raw.buffers[index])) continue;
          const target = path.join(raw.dir, names[index]);
          const temporary = path.join(raw.dir, `.${names[index]}.${randomUUID()}.tmp`);
          const mode = (await io.stat(target)).mode;
          staged.push({ target, temporary, index });
          await io.writeFile(temporary, buffers[index], { flag: 'wx', mode });
        }
        // Catch external edits made while temporary files were being written.
        if ((await readRaw(gameId)).revision !== expectedRevision) throw new FileError(409, '保存期间文件发生变化，请重新读取；当前页面修改仍保留。');
        for (const entry of staged) { await io.rename(entry.temporary, entry.target); replaced.push(entry); }
      } catch (error) {
        for (const entry of replaced.reverse()) {
          try {
            const temporary = path.join(raw.dir, `.rollback.${randomUUID()}.tmp`);
            staged.push({ temporary });
            await io.writeFile(temporary, raw.buffers[entry.index], { flag: 'wx' });
            await io.rename(temporary, entry.target);
          } catch { throw new FileError(500, '保存失败且无法完整恢复原文件，请检查游戏目录；页面修改仍保留。'); }
        }
        throw error;
      } finally {
        await Promise.all(staged.map(entry => io.unlink(entry.temporary).catch(() => {})));
      }
      return { revision: revision(buffers) };
    }),
  };
}

export function createGameStore(root, validate, io = fs) {
  return createFileStore(root, ['base.json', 'free.json', 'config.json'], validate, io);
}
export function createBoardStore(root, validate, io = fs) {
  const store = createFileStore(root, ['board.json'], files => ({ board: validate(files.board) }), io);
  return {
    async read(gameId) {
      const doc = await store.read(gameId);
      const configPath = path.join(root, gameId, 'config.json');
      const stat = await io.lstat(configPath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new FileError(400, 'config.json 必须是实际 JSON 文件。');
      let config;
      try { config = JSON.parse((await io.readFile(configPath, 'utf8')).replace(/^\uFEFF/, '')); }
      catch { throw new FileError(422, 'config.json 不是有效 JSON。'); }
      const lineCount = config?.parameters?.lineCount;
      if (!Number.isSafeInteger(lineCount) || lineCount < 1) throw new FileError(422, 'config.json 中的线数必须为正整数。');
      if (config.ruleType !== 'ways_cascade_v1') throw new FileError(422, `当前规则 ${config.ruleType ?? '未配置'} 尚未实现盘面生成与验证。`);
      return { gameId, revision: doc.revision, lineCount, file: doc.files.board };
    },
    save: (gameId, revision, file) => store.save(gameId, revision, { board: file }),
  };
}

export function createGameMiddleware(store, boardStore, libraryStore) {
  return async (req, res, next) => {
    const route = (req.url || '').split('?')[0];
    if (route !== '/__game-files/games' && !route.startsWith('/__game-files/games/')) return next();
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    try {
      const remote = req.socket.remoteAddress;
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) throw new FileError(403, '文件服务仅允许本机访问。');
      if (req.headers.origin) {
        let origin;
        try { origin = new URL(req.headers.origin); }
        catch { throw new FileError(403, '文件服务不接受无效来源的请求。'); }
        if (origin.host !== req.headers.host || !['http:', 'https:'].includes(origin.protocol)) throw new FileError(403, '文件服务不接受跨站请求。');
      }
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new FileError(403, '文件服务不接受跨站请求。');
      const libraryRoute = /^([^/]+)\/library\/(base|free)$/.exec(route.slice('/__game-files/games/'.length));
      const boardRoute = /^[^/]+\/board$/.test(route.slice('/__game-files/games/'.length));
      const gameId = libraryRoute ? decodeURIComponent(libraryRoute[1]) : route === '/__game-files/games' ? null : decodeURIComponent(route.slice('/__game-files/games/'.length, boardRoute ? -'/board'.length : undefined));
      const target = libraryRoute ? libraryStore : boardRoute ? boardStore : store;
      if (libraryRoute && req.method !== 'PUT') throw new FileError(405, '盘面库仅支持保存生成结果。');
      if (!target) throw new FileError(503, '盘面文件服务尚未启动。');
      if (req.method === 'GET') return send(200, gameId === null ? { games: await store.list() } : await target.read(gameId));
      if (req.method !== 'PUT' || gameId === null) throw new FileError(405, '不支持的文件操作。');
      if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new FileError(415, '保存需要 application/json。');
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > (libraryRoute ? 40 : 16) * 1024 * 1024) throw new FileError(413, '保存数据超过容量限制，请减小数据量。');
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new FileError(400, '保存内容不是有效 JSON。'); }
      if (!body || typeof body !== 'object') throw new FileError(400, '保存内容格式错误。');
      return send(200, await target.save(gameId, body.revision, boardRoute || libraryRoute ? body.file : body.files, libraryRoute?.[2]));
    } catch (error) {
      const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
      const message = error.code === 'ENOENT' ? '游戏目录或所需 JSON 文件缺失，请检查当前游戏目录。' : error.status ? error.message : '读取或保存文件失败，请检查文件权限和本地终端日志。';
      if (status === 500) console.error('[game-files]', error);
      send(status, { error: message });
    }
  };
}
