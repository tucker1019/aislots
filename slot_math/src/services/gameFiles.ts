import { validatePaylines } from '../domain/paylines';
import { validateGameFiles, type GameDocument, type GameFiles } from '../domain/settings';
import { validateBoardFile, type BoardDocument, type BoardFile } from '../domain/board';
const endpoint = '/__game-files/games';
async function request(path: string, options?: RequestInit) {
  let response: Response;
  try { response = await fetch(path, { ...options, cache: 'no-store' }); }
  catch { throw new Error('无法连接本地文件服务，请在 slot_math 中运行 npm run dev。'); }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('本地文件服务不可用，请在 slot_math 中运行 npm run dev 或 npm run preview。'); }
  if (!response.ok) throw new Error(data.error || `文件操作失败（${response.status}）`);
  return data;
}
export async function listGames(): Promise<string[]> {
  const data = await request(endpoint);
  if (!Array.isArray(data.games) || !data.games.every((id: unknown) => typeof id === 'string')) throw new Error('游戏目录列表格式错误。');
  return data.games;
}
export async function readGame(gameId: string): Promise<GameDocument> {
  const data = await request(`${endpoint}/${encodeURIComponent(gameId)}`);
  if (data.gameId !== gameId || typeof data.revision !== 'string') throw new Error('游戏文件响应格式错误。');
  return { gameId, revision: data.revision, files: validateGameFiles(data.files) };
}
export async function saveGame(gameId: string, revision: string, files: GameFiles): Promise<{ revision: string }> {
  return request(`${endpoint}/${encodeURIComponent(gameId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, files }) });
}

export async function readBoard(gameId: string): Promise<BoardDocument> {
  const data = await request(`${endpoint}/${encodeURIComponent(gameId)}/board`);
  if (data.gameId !== gameId || typeof data.revision !== 'string' || !Number.isSafeInteger(data.lineCount) || data.lineCount < 1) throw new Error('盘面配置响应格式错误。');
  return { gameId, revision: data.revision, lineCount: data.lineCount, file: validateBoardFile(data.file) };
}
export async function saveBoard(gameId: string, revision: string, file: BoardFile): Promise<{ revision: string }> {
  return request(`${endpoint}/${encodeURIComponent(gameId)}/board`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, file }) });
}

export async function saveLibrary(gameId: string, revision: string, result: import('../domain/boardLibrary').LibraryResult): Promise<{path:string;bytes:number;retained:number}> {
  return request(`${endpoint}/${encodeURIComponent(gameId)}/library/${result.options.mode}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,file:result})});
}

export async function readPaylines(gameId: string): Promise<import('../domain/paylines').PaylineDocument> {
  const data = await request(`${endpoint}/${encodeURIComponent(gameId)}/paylines`);
  if (data.gameId !== gameId || typeof data.revision !== 'string') throw new Error('连线文件响应格式错误。');
  return { gameId, revision: data.revision, file: validatePaylines(data.file) };
}
export async function savePaylines(gameId: string, revision: string, file: import('../domain/paylines').PaylineConfig): Promise<{revision: string}> {
  validatePaylines(file);
  return request(`${endpoint}/${encodeURIComponent(gameId)}/paylines`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({revision, file})});
}

export async function saveTigerLibrary(gameId:string,revision:string,file:import('../domain/tigerSkeleton').TigerSkeletonLibrary & {gameRevision:string}):Promise<{path:string;bytes:number;retained:number}> {
  return request(`${endpoint}/${encodeURIComponent(gameId)}/paylines/library`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,file})});
}
