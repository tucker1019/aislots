import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameDocument } from '../domain/settings';
import { listGames, readGame } from '../services/gameFiles';
function useWorkspaceState() {
  const [games, setGames] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [document, setDocument] = useState<GameDocument | null>(null);
  const [generation, setGeneration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analysisSaving, setAnalysisSaving] = useState(false);
  const [boardSaving, setBoardSaving] = useState(false);
  const [analysisDirty, setAnalysisDirty] = useState(false);
  const [boardDirty, setBoardDirty] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const saving = analysisSaving || boardSaving;
  function loaded(next: GameDocument) {
    setDocument(next); setGeneration(value => value + 1);
    setAnalysisDirty(false); setBoardDirty(false);
  }
  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const ids = await listGames();
        if (!active) return;
        setGames(ids);
        if (!ids.length) { setError('game_configs 下尚无游戏目录。'); return; }
        let last = '';
        try { last = localStorage.getItem('slot-math.last-game-id') ?? ''; } catch { /* Optional preference only. */ }
        if (!last) return;
        if (!ids.includes(last)) { setError(`上次读取的游戏 ${last} 已不存在，请选择其他游戏。`); return; }
        setSelected(last);
        const token = ++request.current;
        const next = await readGame(last);
        if (active && token === request.current) loaded(next);
      } catch (e) { if (active) setError((e as Error).message); }
      finally { if (active) setLoading(false); }
    }
    void initialize();
    return () => { active = false; request.current++; };
  }, []);
  useEffect(() => {
    if (document) { try { localStorage.setItem('slot-math.last-game-id', document.gameId); } catch { /* Files still work without browser storage. */ } }
  }, [document?.gameId]);
  useEffect(() => {
    if (!analysisDirty && !boardDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [analysisDirty, boardDirty]);
  async function load() {
    if (!selected || loading || saving) return;
    if ((analysisDirty || boardDirty) && !window.confirm('数值分析或盘面工具有未保存的修改。重新读取游戏将丢弃这些修改，是否继续？')) return;
    const token = ++request.current;
    setLoading(true); setError('');
    try { const next = await readGame(selected); if (token === request.current) loaded(next); }
    catch (e) { if (token === request.current) setError((e as Error).message); }
    finally { if (token === request.current) setLoading(false); }
  }
  function analysisSaved(next: GameDocument) {
    setDocument(current => current?.gameId === next.gameId ? next : current);
  }
  return { games, selected, setSelected, document, generation, loading, saving, error, load, analysisSaved, setAnalysisDirty, setBoardDirty, setAnalysisSaving, setBoardSaving };
}
type GameWorkspaceState = ReturnType<typeof useWorkspaceState>;
const GameContext = createContext<GameWorkspaceState | null>(null);
export function GameWorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaceState();
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
export function useGameWorkspace() {
  const context = useContext(GameContext);
  if (!context) throw new Error('游戏工作区尚未初始化。');
  return context;
}
