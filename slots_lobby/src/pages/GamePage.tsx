import { t } from '../i18n';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { forgetGameEntry,launchGame,readGameEntry,rememberGameEntry } from '../services/game-entry';
import { GameInsights } from '../features/game/GameInsights';
export function GamePage({onBack}:{onBack:()=>void}){
 const [url,setUrl]=useState(readGameEntry);const [loading,setLoading]=useState(Boolean(url));const [preparing,setPreparing]=useState(false);const [expanded,setExpanded]=useState(false);const [error,setError]=useState('');
 const busy=useRef(false);const alive=useRef(true);const started=useRef(false);const client=useQueryClient();
 const reopen=useCallback(async()=>{
  if(busy.current)return;busy.current=true;setPreparing(true);setError('');
  try{const next=await launchGame('AG1');if(!alive.current)return;rememberGameEntry(next);setLoading(true);setUrl(next);}
  catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:t('copy.unableToEnterTheGamePleaseRetry'));}
  finally{busy.current=false;if(alive.current)setPreparing(false);}
 },[]);
 useEffect(()=>{alive.current=true;void client.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'none'});if(!url&&!started.current){started.current=true;void reopen();}return()=>{alive.current=false;};},[client,reopen,url]);
 useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpanded(false);};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
 function close(){forgetGameEntry();void client.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'all'});onBack();}
 return <section className={`game-detail-shell${expanded?' game-detail-expanded':''}`} role="dialog" aria-modal="true" aria-label={t('gamePreview.dialog')}>
  <header className="game-detail-toolbar"><button type="button" onClick={close}>{t('copy.backToLobby')}</button><span>{expanded?t('copy.mahjongWays'):t('gamePreview.details')}</span><div>{expanded&&<button type="button" onClick={()=>setExpanded(false)}>{t('gamePreview.shrink')}</button>}<button type="button" disabled={preparing} onClick={()=>void reopen()}>{preparing?t('copy.connecting'):t('copy.reEnter')}</button></div></header>
  <div className="game-detail-content">
   <div className="game-detail-identity"><img src="/assets/lobby/mahjong-cover.jpg" alt={t('gamePreview.cover')}/><div><h1>{t('copy.mahjongWays')}</h1><span className="game-provider-label">AG</span><p>{t('gamePreview.tagline')}</p></div></div>
   <GameInsights part="rtp"/>
   <div className="game-preview"><div className="game-preview-frame">
    {url?<iframe key={url} src={url} title={t('copy.ag1MahjongWays')} allow="autoplay; fullscreen; clipboard-write" allowFullScreen referrerPolicy="no-referrer" onLoad={()=>setLoading(false)} onError={()=>{setLoading(false);setError(t('copy.gameFailedToLoadPleaseReEnter'));}}/>:<p role="status">{preparing?t('gamePreview.connecting'):t('gamePreview.notLoaded')}</p>}
    {loading&&<p className="game-preview-loading" role="status">{t('copy.loadingGame')}</p>}
    {error&&<div className="game-preview-error" role="alert"><p>{error}</p><button type="button" disabled={preparing} onClick={()=>void reopen()}>{t('gamePreview.retry')}</button></div>}
   </div><div className="game-preview-actions"><span>{t('gamePreview.preview')}</span><button type="button" disabled={!url||preparing} onClick={()=>setExpanded(true)}>{t('gamePreview.expand')}</button></div></div>
   <GameInsights part="ranking"/>
  </div>
 </section>;
}
