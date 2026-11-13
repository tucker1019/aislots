import { PaylinePage } from './paylines/PaylinePage';
import { useEffect, useRef, useState } from 'react';
import { PersistentDetails } from './PersistentDetails';
import { PageNav } from './PageNav';
import { GameFilesBar } from './GameFilesBar';
import { useGameWorkspace } from '../state/GameWorkspace';
import { readBoard, saveBoard } from '../services/gameFiles';
import { fileFromBoard, type BoardDocument } from '../domain/board';
import { useCascadeGame } from './developer/useCascadeGame';
import { BoardStructureSection } from './developer/BoardStructureSection';
import { CascadeFactorsSection } from './developer/CascadeFactorsSection';
import { GoldSection } from './developer/GoldSection';
import { SymbolLibrary } from './developer/SymbolLibrary';
import { BoardFillConfigSection } from './developer/BoardFillConfigSection';
import { BoardFillSection } from './developer/BoardFillSection';
import { BoardLibraryPanel } from './developer/BoardLibraryPanel';
import { BoardPanel, SessionMetrics } from './developer/BoardPanel';
import { CascadeInspector } from './developer/CascadeInspector';
import './developer.css';

export function DeveloperPage({ active }: { active: boolean }) {
  const workspace = useGameWorkspace();
  return workspace.document?.files.config.ruleType === 'paylines_v1' ? <PaylinePage /> : <CascadeDeveloperPage active={active} />;
}
function CascadeDeveloperPage({ active }: { active: boolean }) {
  const workspace = useGameWorkspace();
  const [source, setSource] = useState<BoardDocument | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const gameId = workspace.document?.gameId;
  const ruleType = workspace.document?.files.config.ruleType;
  const supportedRules = ruleType === 'ways_cascade_v1';
  useEffect(() => { workspace.setBoardDirty(dirty); }, [dirty, workspace.setBoardDirty]);
  useEffect(() => {
    const token = ++request.current;
    setSource(null); setDirty(false); setError('');
    if (!gameId) return;
    setLoading(true);
    readBoard(gameId).then(next => {
      if (token === request.current) { setSource(next); setLoadKey(value => value + 1); }
    }).catch(e => { if (token === request.current) setError(e.message); }).finally(() => { if (token === request.current) setLoading(false); });
    return () => { request.current++; };
  }, [gameId, workspace.generation]);
  async function reload() {
    if (!gameId || loading || workspace.saving) return;
    if (dirty && !window.confirm('盘面配置有未保存修改，重新读取 board.json 将丢弃这些修改，是否继续？')) return;
    const token = ++request.current;
    setLoading(true); setError('');
    try {
      const next = await readBoard(gameId);
      if (token === request.current) { setSource(next); setLoadKey(value => value + 1); setDirty(false); }
    } catch (e) { if (token === request.current) setError((e as Error).message); }
    finally { if (token === request.current) setLoading(false); }
  }
  return <div className="developer-page">
    <header className="topbar"><a className="brand" href="#/analysis"><span className="brand-mark">∑</span><span>Slot Math<span className="brand-sub">数值工作台</span></span></a><PageNav page="developer"/><div className="header-status"><span />盘面配置文件</div></header>
    <main>
      <div className="page-heading"><div><h1>盘面生成与检测</h1><p>配置棋盘与图标，检查 Ways 倍率、逐轮消除和补充结果。</p></div></div>
      <GameFilesBar />
      {gameId && <div className="board-file-source"><span>盘面配置：game_configs/{gameId}/board.json</span><button className="button secondary" disabled={loading || workspace.loading || workspace.saving} onClick={() => void reload()}>{loading ? '正在读取盘面…' : '重新读取盘面配置'}</button></div>}
      {error && <div className="dev-alert" role="alert">{error}{source?.gameId === gameId ? ' 当前仍保留上次成功读取的盘面配置。' : ''}</div>}
      {gameId && !supportedRules && <div className="dev-alert" role="alert">当前规则 {ruleType} 尚未实现盘面生成与验证。请在数值分析页选择已实现的规则并保存，不会按 Ways 消除规则处理。</div>}
      {source && source.gameId === gameId && workspace.document && supportedRules ? <fieldset className="analysis-editor-fieldset" disabled={loading || workspace.loading} aria-busy={loading || workspace.loading}><DeveloperEditor key={`${gameId}:${loadKey}`} active={active && !loading && !workspace.loading} source={source} sharedLineCount={workspace.document.files.config.parameters.lineCount} onDirty={setDirty} onSaving={workspace.setBoardSaving} /></fieldset> : <div className="game-file-empty">{!supportedRules && gameId ? '盘面工作区不可用：当前玩法规则尚未实现。' : !gameId ? '先选择并读取游戏，盘面工具会加载该游戏的 board.json。' : loading ? '正在读取盘面配置…' : '无法加载盘面配置，请检查该游戏的 board.json；不会使用浏览器旧配置或默认值。'}</div>}
    </main>
  </div>;
}
function DeveloperEditor({ active, source, sharedLineCount, onDirty, onSaving }: { active: boolean; source: BoardDocument; sharedLineCount: number; onDirty: (dirty: boolean) => void; onSaving: (saving: boolean) => void }) {
  const game = useCascadeGame(active, source.file, source.lineCount, sharedLineCount);
  const [revision, setRevision] = useState(source.revision);
  const [fillComparing, setFillComparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [fileError, setFileError] = useState('');
  const fingerprint = JSON.stringify({ scatterWeightIncrement: game.config.scatterWeightIncrement, fillWeightIncrement: game.config.fillWeightIncrement, gold: game.config.gold, freeGoldColumns: game.config.freeGoldColumns, columnHeights: game.config.columnHeights, cascadeFactors: game.config.cascadeFactors, freeCascadeFactors: game.config.freeCascadeFactors, symbols: game.config.symbols, seed: game.seed, shapeText: game.shapeText });
  const [savedFingerprint, setSavedFingerprint] = useState(fingerprint);
  const dirty = fingerprint !== savedFingerprint;
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  async function save() {
    if (!dirty || saving) return;
    setFileError(''); setMessage('');
    try {
      const shape = game.shapeText.trim().split(/[\s,，×x*]+/).filter(Boolean).map(Number);
      if (JSON.stringify(shape) !== JSON.stringify(game.config.columnHeights)) throw new Error('请先点击「应用列高」，再保存盘面配置。');
      const file = fileFromBoard(game.config, game.seed);
      setSaving(true); onSaving(true);
      const result = await saveBoard(source.gameId, revision, file);
      setRevision(result.revision); setSavedFingerprint(fingerprint); setMessage('board.json 已保存。数值配置和倍率表保持不变。');
    } catch (e) { setFileError((e as Error).message); }
    finally { setSaving(false); onSaving(false); }
  }
  return <>
    <div className="analysis-file-heading"><span className={dirty ? 'file-dirty' : 'file-saved'} role="status">{saving ? '正在保存 board.json…' : dirty ? '盘面配置有未保存修改' : '盘面配置与文件一致'}</span><button className="button primary" disabled={!dirty || saving} onClick={() => void save()}>保存盘面配置</button></div>
    {fileError && <div className="dev-alert" role="alert">{fileError}</div>}
    {message && !dirty && <p className="game-file-success" role="status">{message}</p>}
    {game.error && <div className="dev-alert" role="alert">{game.error}</div>}
    <div className="dev-layout">
      <aside className="dev-config"><BoardStructureSection game={game} /><CascadeFactorsSection game={game} /><GoldSection game={game} /><BoardFillConfigSection game={game} comparing={fillComparing} /></aside>
      <div className="dev-content"><SymbolLibrary game={game} /><BoardPanel game={game} /><BoardFillSection game={game} onRunning={setFillComparing} /><SessionMetrics game={game} /><CascadeInspector game={game} /><BoardLibraryPanel gameId={source.gameId} revision={revision} config={game.config} dirty={dirty} invalid={game.configError} />
        <PersistentDetails className="formula-panel" storageId="developer.盘面检测规则"><summary>盘面检测规则</summary><p>普通图标从最左列连续至少 3 列，只取最长连续列数的赔付。百搭可参与多个普通图标，中奖格子并集只消除一次。金底按原图标计奖，中奖后原位转百搭，再随幸存图标一起下落，顶部按权重补齐。百搭只能由金底转换生成，可手动放置检测。实际倍率 = 原始赔付 ÷ config.json 的线数 × Ways × 本轮加成。</p><p>本工具只生成和检测盘面，不判断免费概率，不赠送或追加免费局。免费图标不进入中奖骨架，不参与 Ways 计奖；补空时按配置权重生成。初始及每轮补充每列最多新增1个，已有图标保留并下落。未中免费整局最多2个，已中免费按目标补3、4、5个；工作区的目标选择仅用于测试表现，不判断免费触发概率。测试盘面和消除记录只保留在当前工作区，不写入 board.json。达到 100 轮消除上限时明确停止，不作为完整结果。</p></PersistentDetails>
      </div>
    </div>
  </>;
}
