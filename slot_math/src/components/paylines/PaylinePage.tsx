import { useEffect, useRef, useState } from 'react';
import { PageNav } from '../PageNav';
import { GameFilesBar } from '../GameFilesBar';
import { useGameWorkspace } from '../../state/GameWorkspace';
import { readPaylines } from '../../services/gameFiles';
import type { PaylineDocument } from '../../domain/paylines';
import { PaylineEditor } from './PaylineEditor';
import './paylines.css';
export function PaylinePage() {
  const workspace = useGameWorkspace(), gameId = workspace.document!.gameId;
  const [document,setDocument] = useState<PaylineDocument | null>(null);
  const [error,setError] = useState(''), [loading,setLoading] = useState(false), [reload,setReload] = useState(0);
  const [dirty,setDirty] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    const token = ++request.current; setDocument(null);setError('');setLoading(true);setDirty(false);
    void readPaylines(gameId).then(next=>{if(token===request.current)setDocument(next);}).catch((e: Error)=>{if(token===request.current)setError(e.message);}).finally(()=>{if(token===request.current)setLoading(false);});
    return ()=>{request.current++;};
  },[gameId,workspace.generation,reload]);
  useEffect(()=>{workspace.setBoardDirty(dirty);return ()=>workspace.setBoardDirty(false);},[dirty,workspace.setBoardDirty]);
  return <div className="developer-page"><header className="topbar"><a className="brand" href="#/analysis">∑ Slot Math</a><PageNav page="developer"/><span>格子组合连线</span></header><main>
    <div className="page-heading"><div><h1>连线配置与验奖</h1><p>自定义列高与中奖格子组合；每组全部匹配，Wild 替代，每组只支付最高奖。</p></div></div>
    <GameFilesBar />
    <div className="board-file-source"><span>配置：game_configs/{gameId}/paylines.json</span><button className="button secondary" disabled={loading||workspace.saving||workspace.loading} onClick={()=>{if(!dirty||window.confirm('重新读取会丢弃未保存的连线修改，是否继续？'))setReload(v=>v+1);}}>重新读取配置</button></div>
    {error&&<div role="alert" className="dev-alert">{error}<button className="button secondary" onClick={()=>setReload(v=>v+1)}>重试</button></div>}
    {loading&&<div className="game-file-empty">正在读取连线配置…</div>}
    {document&&<fieldset disabled={workspace.loading} className="analysis-editor-fieldset"><PaylineEditor key={`${gameId}:${workspace.generation}:${reload}`} document={document} onDirty={setDirty} onSaving={workspace.setBoardSaving}/></fieldset>}
  </main></div>;
}
