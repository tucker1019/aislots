import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  advanceCascadeRound, createCascadeRound,
  evaluateWays, fixedFreeGold, validateCascadeConfig, symbolDefinitions,
  type BoardMode, type BoardConfig, type CascadeConfig, type CascadeRound, type GameSymbol,
} from '../../domain/cascade';
import {fillBoard,simulateBoard,type FillMetrics,type FreeTarget} from '../../domain/boardFill';
import { seededRandom } from '../../domain/simulation';
import { runtimeBoardConfig, type BoardFile } from '../../domain/board';

interface Resize { column: number; y: number; height: number; pointer: number }

/** All mutable cascade-demo state; the page components stay presentational. */
export function useCascadeGame(active: boolean, initial: BoardFile, lineCount: number, sharedLineCount: number) {
  const [config, setConfig] = useState(() => runtimeBoardConfig(initial, lineCount));
  const [mode, setMode] = useState<BoardMode>('base');
  const [freeTarget,setFreeTarget]=useState<FreeTarget>(0);
  const [placeGold, setPlaceGold] = useState(false);
  const [seed, setSeed] = useState(initial.seed === null ? '' : String(initial.seed));
  const previousSharedLine = useRef(sharedLineCount);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [grid, setGrid] = useState<Array<Array<string | null>>>([]);
  const [shapeText, setShapeText] = useState(config.columnHeights.join(' '));
  const [round, setRound] = useState<CascadeRound | null>(null);
  const [snapshot, setSnapshot] = useState<CascadeConfig | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [view, setView] = useState<'before' | 'after'>('after');
  const [actualSeed, setActualSeed] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [fillMetrics,setFillMetrics]=useState<FillMetrics|null>(null);
  const plan=useRef<CascadeRound|null>(null);
  const previewPlan=useRef<{round:CascadeRound;seed:number;inputSeed:string}|null>(null);
  const random = useRef<() => number>(() => Math.random());
  const resizing = useRef<Resize | null>(null);
  const draggedColumn = useRef<number | null>(null);

  const locked = !!round && !round.finished;
  const rules = snapshot ?? config;
  const definitions = symbolDefinitions(rules);
  const configError = useMemo(() => {
    try { validateCascadeConfig(config); return ''; }
    catch (e) { return (e as Error).message; }
  }, [config]);

  useEffect(() => {
    if (previousSharedLine.current === sharedLineCount) return;
    previousSharedLine.current = sharedLineCount;
    setConfig(current => ({ ...current, lineCount: sharedLineCount }));
    clearPlay();
  }, [sharedLineCount]);
  useEffect(() => { if (!active) setAutoplay(false); }, [active]);
  useEffect(() => {
    if (!autoplay || !active) return;
    if (round?.limited) { setAutoplay(false); return; }
    const timer = setTimeout(() => {
      if (round && !round.finished) nextStep();
      else setAutoplay(false);
    }, 900);
    return () => clearTimeout(timer);
  }, [autoplay, active, round]);

  function clearPlay() {
    plan.current=null;previewPlan.current=null;setFillMetrics(null);
    setAutoplay(false); setRound(null); setSnapshot(null);
    setSelectedStep(null); setActualSeed(null); setError('');
  }
  function changeFreeTarget(value: FreeTarget){if(locked)return;clearPlay();setFreeTarget(value);}
  function changeMode(next: BoardMode) {
    if (locked) return;
    clearPlay();
    setMode(next);
  }
  function changeConfig(patch: Partial<BoardConfig>) {
    if (locked) return;
    plan.current=null;previewPlan.current=null;setFillMetrics(null);
    setConfig(c => ({ ...c, ...patch }));
    setRound(null); setSnapshot(null); setSelectedStep(null); setActualSeed(null); setError('');
  }
  function heights(next: number[]) {
    if (locked) return;
    changeConfig({ columnHeights: next });
    setShapeText(next.join(' '));
    setGrid(previous => next.map((height, i) => {
      const old = previous[i] ?? [];
      return [...Array(Math.max(0, height - old.length)).fill(null), ...old.slice(-height)];
    }));
  }
  function removeColumn(column: number) {
    if (locked) return;
    const next = config.columnHeights.filter((_, i) => i !== column);
    changeConfig({ columnHeights: next });
    setShapeText(next.join(' '));
    setGrid(previous => previous.filter((_, i) => i !== column));
  }
  function moveColumn(from: number, to: number) {
    if (locked) return;
    const next = [...config.columnHeights];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    changeConfig({ columnHeights: next });
    setShapeText(next.join(' '));
    setGrid(previous => {
      const columns = config.columnHeights.map((height, i) => Array.from({ length: height }, (_, r) => previous[i]?.[r] ?? null));
      const [column] = columns.splice(from, 1);
      columns.splice(to, 0, column);
      return columns;
    });
  }
  function applyShape() {
    const values = shapeText.trim().split(/[\s,，×x*]+/).filter(Boolean).map(Number);
    try { validateCascadeConfig({ ...config, columnHeights: values }, true); heights(values); }
    catch (e) { setError((e as Error).message); }
  }
  function updateSymbol(id: string, patch: Partial<GameSymbol>) {
    changeConfig({ symbols: config.symbols.map(symbol => symbol.id === id ? { ...symbol, ...patch } : symbol) });
  }
  function addSymbol() {
    if (locked) return;
    const used = new Set(config.symbols.map(symbol => symbol.id));
    let nextId = 1;
    while (used.has(String(nextId)) && nextId <= 999) nextId++;
    if (nextId > 999) { setError('基础图标 ID 已用完（1–999）。'); return; }
    const id = String(nextId);
    const symbol: GameSymbol = {
      id, name: `图标 ${config.symbols.length + 1}`, weight: 0, role: 'normal',
      color: symbolColors[config.symbols.length % symbolColors.length],
      payouts: {},
    };
    changeConfig({ symbols: [...config.symbols, symbol] });
    setSelectedSymbol(id);
  }
  function removeSymbol(id: string) {
    if (locked) return;
    changeConfig({ symbols: config.symbols.filter(symbol => symbol.id !== id), ...(config.gold.wildSymbolId === id ? { freeGoldColumns: [], gold: { ...config.gold, columns: [], wildSymbolId: null } } : {}) });
    setGrid(previous => previous.map(column => column.map(cell => cell === id || cell === String(Number(id) + 1000) ? null : cell)));
    if (selectedSymbol === id) setSelectedSymbol(null);
  }
  function freshRandom() {
    const value = seed.trim() ? Number(seed) : crypto.getRandomValues(new Uint32Array(1))[0];
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error('种子需为 0–4294967295 的整数或留空。');
    return { value, next: seededRandom(value) };
  }
  function fillPreview() {
    try {
      const rng = freshRandom();
      const source=simulateBoard(config,mode,rng.next);
      const filled=fillBoard(source,config,config.fillWeightIncrement,rng.next,undefined,64,freeTarget);
      previewPlan.current={round:filled.round,seed:rng.value,inputSeed:seed};plan.current=null;setFillMetrics(filled.metrics);
      const preview=filled.round.steps[0]?.before??filled.round.board;
      setGrid(preview.map(column => column.map(cell => cell.symbolId)));
      setRound(null); setSnapshot(null); setSelectedStep(null);
      setActualSeed(rng.value); setError('');
    } catch (e) { setError((e as Error).message); }
  }
  function startSpin(fromGrid: boolean) {
    try {
      if (round && !round.finished) return;
      const settings = structuredClone(config);
      validateCascadeConfig(settings);
      const rng = freshRandom();
      random.current = rng.next; setActualSeed(rng.value); setSnapshot(settings);
      const preset = fromGrid ? settings.columnHeights.map((height, c) => Array.from({length:height}, (_, r) => grid[c]?.[r] ?? null)) : undefined;
      let prepared: CascadeRound;
      if(fromGrid&&previewPlan.current&&previewPlan.current.inputSeed===seed){prepared=previewPlan.current.round;setActualSeed(previewPlan.current.seed);previewPlan.current=null;}
      else{
        const source=simulateBoard(settings,mode,random.current,preset);
        const filled=fillBoard(source,settings,settings.fillWeightIncrement,random.current,preset,64,freeTarget);
        prepared=filled.round;setFillMetrics(filled.metrics);
      }
      plan.current=prepared;
      setRound({...prepared,board:prepared.steps[0]?.before??prepared.board,steps:[],totalPayout:0,finished:false});
      setSelectedStep(null); setView('after'); setError('');
    } catch (e) { setError((e as Error).message); setAutoplay(false); }
  }
  function nextStep() {
    if (!round || round.finished || round.limited || !snapshot) return;
    try {
      const prepared=plan.current;
      const event=prepared?.steps[round.steps.length];
      const next=prepared
        ? event ? {...round,board:event.after,steps:[...round.steps,event],totalPayout:round.totalPayout+event.payout} : {...round,finished:true}
        : advanceCascadeRound(round,snapshot,random.current);
      setRound(next); setSelectedStep(next.steps.length ? next.steps.length - 1 : null); setView('after');
      if (next.limited) {
        setAutoplay(false);
        setError('连续中奖达到 100 轮检测上限，盘面未完整结束。请清空检测并调整图标权重或赔付。');
        return;
      }
    } catch (e) { setError((e as Error).message); setAutoplay(false); }
  }
  function beginResize(event: PointerEvent<HTMLButtonElement>, column: number) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizing.current = { column, y: event.clientY, height: config.columnHeights[column], pointer: event.pointerId };
  }
  function moveResize(event: PointerEvent<HTMLButtonElement>) {
    const drag = resizing.current;
    if (!drag || drag.pointer !== event.pointerId || locked) return;
    const height = Math.max(1, Math.min(12, drag.height + Math.round((drag.y - event.clientY) / 42)));
    if (config.columnHeights[drag.column] !== height) heights(config.columnHeights.map((old, i) => i === drag.column ? height : old));
  }
  function placeSymbol(column: number, row: number) {
    if (locked) return;
    const symbol = activeSymbol;
    if (!symbol) return;
    if (placeGold && (symbol.role !== 'normal' || !/^[1-9]\d{0,2}$/.test(symbol.id) || config.gold.wildSymbolId === null || !(fixedFreeGold(config, mode, column) || (config.gold.columns.includes(column + 1) && (mode !== 'free' || !config.freeGoldColumns?.length))))) {
      setError('金底只能放置在已配置的金底轴，且需选择 ID 为 1–999 的普通图标并配置转换百搭。'); return;
    }
    const symbolId = placeGold ? String(Number(symbol.id) + 1000) : symbol.id;
    plan.current=null;previewPlan.current=null;setFillMetrics(null);
    setError('');
    setRound(null); setSnapshot(null); setSelectedStep(null); setActualSeed(null);
    setGrid(previous => config.columnHeights.map((count, i) =>
      Array.from({ length: count }, (_, j) => i === column && j === row ? symbolId : previous[i]?.[j] ?? null)));
  }
  const step = selectedStep === null ? null : round?.steps[selectedStep] ?? null;
  const board = step ? (view === 'before' ? step.before : step.after) : round?.board;
  const highlights = new Set(step ? (view === 'before' ? step.wins.flatMap(win => win.cellIds) : [...step.refillIds, ...step.transformedIds]) : []);
  const activeSymbol = config.symbols.find(s => s.id === selectedSymbol) ?? config.symbols[0];
  const winningNow = round && !round.finished && !round.limited ? evaluateSafely(round, rules) : [];

  return {
    config, mode, changeMode, freeTarget, changeFreeTarget, fillMetrics, placeGold, setPlaceGold, seed, setSeed, selectedSymbol, setSelectedSymbol, grid,
    shapeText, setShapeText, round, autoplay, setAutoplay,
    selectedStep, setSelectedStep, view, setView, actualSeed, error, setError,
    locked, rules, definitions, configError,
    changeConfig, heights, removeColumn, moveColumn, applyShape, updateSymbol,
    addSymbol, removeSymbol, fillPreview, clearPlay, startSpin, nextStep,
    beginResize, moveResize, resizing, draggedColumn, placeSymbol,
    step, board, highlights, activeSymbol, winningNow,
  };
}

export type CascadeGame = ReturnType<typeof useCascadeGame>;
export const symbolColors = ['#547cbb', '#448f7d', '#b47868', '#9680b8', '#b48d48', '#6296ab'];
export function evaluateSafely(round: CascadeRound, config: CascadeConfig) {
  try { return evaluateWays(round.board, config, round.steps.length, round.mode); }
  catch { return []; }
}
