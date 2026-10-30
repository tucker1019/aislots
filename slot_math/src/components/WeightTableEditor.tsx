import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { calculateModel, type Parameters, type WeightTable } from '../domain/model';
import { type LoadedTable } from '../domain/settings';
import { createWeightDraft, draftRowValues, tableFromDraft, weightFromPosition, type DraftRow } from '../domain/weightDraft';

const number = (x: number, digits = 6) => x.toLocaleString('en-US', { maximumFractionDigits: digits });
const multiplier = (x: number) => `${x > 0 && x < 1e-8 ? x.toExponential(4) : number(x, 8)}×`;
const percent = (x: number) => `${number(x * 100, 4)}%`;
const PAGE_SIZE = 30;
interface Props {
  kind: 'base' | 'free'; value: LoadedTable; other: LoadedTable | null; parameters: Parameters;
  onSave: (value: LoadedTable) => void; onClose: () => void;
}
interface Drag { rowId: number; pointerId: number; top: number; height: number; maximum: number; logarithmic: boolean }

export function WeightTableEditor({ kind, value, other, parameters, onSave, onClose }: Props) {
  const lineCount = parameters.lineCount;
  const [rows, setRows] = useState(() => createWeightDraft(value.table, lineCount));
  const [selectedId, setSelectedId] = useState<number | null>(rows[0]?.id ?? null);
  const nextId = useRef(rows.length + 1);
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<Drag | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [logarithmic, setLogarithmic] = useState(false);
  const [axisMax, setAxisMax] = useState(() => maximumWeight(rows) * 1.25);
  const [newMultiplier, setNewMultiplier] = useState('1');
  const [newWeight, setNewWeight] = useState('1');
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  const draft = useMemo(() => {
    try { return { table: tableFromDraft(rows, lineCount), error: '' }; }
    catch (error) { return { table: null, error: (error as Error).message }; }
  }, [rows, lineCount]);
  const preview = useMemo(() => {
    if (!other) return { current: null, saved: null, error: '读取另一份权重表后可预览完整 RTP。' };
    if (!draft.table) return { current: null, saved: null, error: '' };
    const calculate = (table: WeightTable) => calculateModel(kind === 'base' ? table : other.table, kind === 'free' ? table : other.table, parameters);
    try { return { current: calculate(draft.table), saved: calculate(value.table), error: '' }; }
    catch (error) { return { current: null, saved: null, error: (error as Error).message }; }
  }, [draft.table, other, kind, parameters, value.table]);
  const filtered = useMemo(() => rows.filter(row => !search.trim() || row.multiplierText.includes(search.trim())), [rows, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const selected = rows.find(row => row.id === selectedId) ?? null;
  const dirty = useMemo(() => {
    try { return JSON.stringify(tableFromDraft(rows, lineCount).rows) !== JSON.stringify(value.table.rows); }
    catch { return true; }
  }, [rows, lineCount, value.table]);
  const scaleMaximum = Math.max(axisMax, 1e-10);
  function update(id: number, patch: Partial<DraftRow>) { setRows(previous => previous.map(row => row.id === id ? { ...row, ...patch } : row)); setActionError(''); }
  function editWeight(id: number, text: string) {
    update(id, { weightText: text });
    const amount = Number(text); if (Number.isFinite(amount) && amount > axisMax) setAxisMax(amount * 1.25);
  }
  function deleteRow(id: number) {
    const remaining = rows.filter(row => row.id !== id);
    setRows(remaining); if (selectedId === id) setSelectedId(remaining[0]?.id ?? null); setActionError('');
  }
  function addRow() {
    const row: DraftRow = { id: nextId.current, sourceMultiplier: NaN, multiplierText: newMultiplier, weightText: newWeight };
    try {
      const [raw, weight] = draftRowValues(row, lineCount);
      row.sourceMultiplier = raw;
      row.multiplierText = String(raw / lineCount);
      setRows(previous => [...previous, row]); setSelectedId(row.id); nextId.current++;
      setSearch(''); setPage(Math.floor(rows.length / PAGE_SIZE));
      if (weight > axisMax) setAxisMax(weight * 1.25);
      setActionError('');
    } catch (error) { setActionError((error as Error).message); }
  }
  function reset() { const fresh = createWeightDraft(value.table, lineCount); setRows(fresh); nextId.current = fresh.length + 1; setSelectedId(fresh[0]?.id ?? null); setPage(0); setSearch(''); setAxisMax(maximumWeight(fresh) * 1.25); setActionError(''); }
  function beginDrag(event: PointerEvent<HTMLDivElement>, row: DraftRow) {
    if (event.button !== 0) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    drag.current = { rowId: row.id, pointerId: event.pointerId, top: bounds.top, height: bounds.height, maximum: scaleMaximum, logarithmic };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(row.id);
    moveDrag(event);
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const weight = weightFromPosition(event.clientY, active.top, active.height, active.maximum, active.logarithmic);
    update(active.rowId, { weightText: String(Number(weight.toPrecision(12))) });
  }
  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyboardWeight(event: React.KeyboardEvent<HTMLDivElement>, row: DraftRow) {
    const weight = Number(row.weightText) || 0;
    let next: number;
    const delta = (event.shiftKey ? 0.1 : 0.01) * scaleMaximum;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next = weight + delta;
    else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next = Math.max(0, weight - delta);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = scaleMaximum;
    else return;
    event.preventDefault(); setSelectedId(row.id); editWeight(row.id, String(Number(next.toPrecision(12))));
  }
  const title = kind === 'base' ? '编辑普通局权重表' : '编辑免费局权重表';
  return createPortal(<dialog className={`weight-editor ${kind}`} ref={dialog} aria-labelledby="weight-editor-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="editor-heading"><div><h2 id="weight-editor-title">{title}</h2><p>{value.name} <span>· {rows.length} 条记录 · {lineCount} 线</span></p></div><button className="editor-close" aria-label="关闭并放弃修改" onClick={onClose}>×</button></div>
    <div className="editor-body">
      <div className="editor-preview" aria-live="polite">
        <Preview label="Total RTP" current={preview.current?.totalRtp} saved={preview.saved?.totalRtp} format={percent} />
        <Preview label="Base RTP" current={preview.current?.baseRtp} saved={preview.saved?.baseRtp} format={percent} />
        <Preview label="Free RTP" current={preview.current?.freeRtp} saved={preview.saved?.freeRtp} format={percent} />
        <Preview label="总奖金方差" current={preview.current?.totalVariance} saved={preview.saved?.totalVariance} format={number} />
        <Preview label="标准差" current={preview.current?.standardDeviation} saved={preview.saved?.standardDeviation} format={number} />
      </div>
      <p className="editor-note">草稿实时预览，确认前不会更新工作台；确认后需点击「保存文件」写入 JSON。所有倍率均为实际倍率（文件倍率 ÷ {lineCount}），新增或编辑倍率也按实际倍率输入。</p>
      {(draft.error || actionError || preview.error) && <div className="editor-error" role="alert">{actionError || draft.error || preview.error}</div>}
      <div className="editor-chart-toolbar"><div><h3>倍率与权重分布</h3><p>上下拖动柱形调整权重，点击下方记录可精确编辑。</p></div><div className="editor-chart-tools"><label><input type="checkbox" checked={logarithmic} onChange={event => setLogarithmic(event.target.checked)} />对数纵轴</label><button className="text-button" onClick={() => setAxisMax(maximumWeight(rows) * 1.25)}>适配纵轴</button></div></div>
      <div className="weight-chart"><div className="chart-axis">{[1, 0.75, 0.5, 0.25, 0].map((ratio, index) => <span key={index}>{number(logarithmic ? Math.expm1(ratio * Math.log1p(scaleMaximum)) : ratio * scaleMaximum, 2)}</span>)}</div><div className="chart-scroll"><div className="chart-columns" style={{ minWidth: Math.max(visible.length * 36, 400) }}>{visible.map(row => {
        const weight = Number.isFinite(Number(row.weightText)) ? Math.max(0, Number(row.weightText)) : 0;
        const ratio = logarithmic ? Math.log1p(weight) / Math.log1p(scaleMaximum) : weight / scaleMaximum;
        return <div className={`chart-column ${selectedId === row.id ? 'selected' : ''}`} key={row.id}>
          <div className="chart-track" role="slider" tabIndex={0} aria-label={`${multiplier(Number(row.multiplierText))} 权重（记录 ${row.id}）`} aria-valuemin={0} aria-valuemax={Math.max(scaleMaximum, weight)} aria-valuenow={weight} aria-valuetext={`${number(weight, 8)}`} aria-orientation="vertical" onPointerDown={event => beginDrag(event, row)} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => keyboardWeight(event, row)} onFocus={() => setSelectedId(row.id)} title={`实际倍率 ${multiplier(Number(row.multiplierText))}，权重 ${number(weight, 8)}`}>
            <div className="chart-bar" style={{ height: `${Math.min(1, ratio) * 100}%` }}><span /></div>
          </div><span className="chart-label">{row.multiplierText.trim() && Number.isFinite(Number(row.multiplierText)) ? multiplier(Number(row.multiplierText)) : '—'}</span>
        </div>;
      })}{!visible.length && <p className="chart-empty">没有匹配记录，可以清空搜索或新增倍率。</p>}</div></div></div>
      <div className="editor-table-toolbar"><input className="search" aria-label="编辑器搜索实际倍率" placeholder="搜索实际倍率" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /><span>{filtered.length} 条 · 第 {activePage + 1} / {pageCount} 页</span><button disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>上一页</button><button disabled={activePage >= pageCount - 1} onClick={() => setPage(activePage + 1)}>下一页</button></div>
      <div className="editor-edit-row"><h3>精确编辑</h3>{selected ? <><label>实际倍率<input type="number" min="0" step="any" aria-label="选中记录实际倍率" value={selected.multiplierText} onChange={event => update(selected.id, { multiplierText: event.target.value })} /></label><label>权重<input type="number" min="0" step="any" aria-label="选中记录权重" value={selected.weightText} onChange={event => editWeight(selected.id, event.target.value)} /></label><span className="editor-probability">表内概率 {draft.table ? percent(Number(selected.weightText) / draft.table.totalWeight) : '—'}</span><button className="delete-row" onClick={() => deleteRow(selected.id)}>删除选中倍率</button></> : <p>选择一条记录进行编辑。</p>}</div>
      <div className="editor-row-list" aria-label="倍率记录列表">{visible.map(row => <button key={row.id} className={selectedId === row.id ? 'selected' : ''} onClick={() => setSelectedId(row.id)}><span>{row.multiplierText.trim() && Number.isFinite(Number(row.multiplierText)) ? multiplier(Number(row.multiplierText)) : '—'}</span><span>{row.weightText.trim() && Number.isFinite(Number(row.weightText)) ? number(Number(row.weightText), 8) : '未填写'}</span></button>)}</div>
      <div className="editor-add-row"><h3>新增倍率</h3><label>实际倍率<input type="number" min="0" step="any" aria-label="新增实际倍率" value={newMultiplier} onChange={event => setNewMultiplier(event.target.value)} /></label><label>权重<input type="number" min="0" step="any" aria-label="新增权重" value={newWeight} onChange={event => setNewWeight(event.target.value)} /></label><button className="button secondary" onClick={addRow}>新增倍率</button></div>
    </div>
    <div className="editor-footer"><div><strong>{dirty ? '有未保存的修改' : '尚未修改'}</strong><span>确认后点击工作台「保存文件」写回 JSON。</span></div><button className="text-button" disabled={!dirty} onClick={reset}>重置修改</button><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!draft.table || !dirty} onClick={() => { if (draft.table) { onSave({ name: value.name, table: draft.table }); onClose(); } }}>确认修改</button></div>
  </dialog>, document.body);
}
function maximumWeight(rows: DraftRow[]): number { let max = 0; for (const row of rows) { const value = Number(row.weightText); if (Number.isFinite(value)) max = Math.max(max, value); } return max > 0 ? max : 1; }
function Preview({ label, current, saved, format }: { label: string; current: number | undefined; saved: number | undefined; format: (value: number) => string }) {
  return <div><span>{label}</span><strong>{current === undefined ? '—' : format(current)}</strong><small>{saved === undefined ? '等待完整参数' : `保存前 ${format(saved)}`}</small></div>;
}
