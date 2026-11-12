import { gameDisplay, type GameId } from '../app/games';
import {AsyncButton} from '../components/buttons/AsyncButton';
import { createPortal } from 'react-dom';
import { t } from '../i18n';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { forgetGameEntry,launchGame,readGameEntry,rememberGameEntry } from '../services/game-entry';
import { FloatingGameMenu } from '../features/game/FloatingGameMenu';
import { useLobbyGames } from '../features/home/useLobbyGames';
import { NetworkError } from '../components/feedback/NetworkError';
import { GameInsights } from '../features/game/GameInsights';
export function GamePage({onBack,gameId='AG1'}:{onBack:()=>void;gameId?:GameId}){
 const catalog=useLobbyGames();
 const entry=catalog.data?.find(game=>game.id===gameId);
 const allowed=entry?.enabled===true;
 const game=gameDisplay(gameId,entry);
 const [url,setUrl]=useState(()=>readGameEntry(gameId));const [preparing,setPreparing]=useState(false);const [expanded,setExpanded]=useState(false);const [error,setError]=useState('');
 const [menuOpen,setMenuOpen]=useState(false);
 const frameRef=useRef<HTMLIFrameElement>(null);
 const busy=useRef(false);const alive=useRef(true);const started=useRef(false);const client=useQueryClient();
 const reopen=useCallback(async()=>{
  if(busy.current||!allowed)return;busy.current=true;setPreparing(true);setError('');
  try{const next=await launchGame(gameId);if(!alive.current)return;rememberGameEntry(next,gameId);setUrl(next);}
  catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:t('copy.unableToEnterTheGamePleaseRetry'));}
  finally{busy.current=false;if(alive.current)setPreparing(false);}
 },[gameId,allowed]);
 useEffect(()=>{alive.current=true;void client.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'none'});if(allowed&&!url&&!started.current){started.current=true;void reopen();}return()=>{alive.current=false;};},[client,reopen,url,allowed]);
 useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){if(menuOpen)setMenuOpen(false);else setExpanded(false);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[menuOpen]);
 useEffect(()=>{
  if(!url||!allowed)return;
  const origin=new URL(url,window.location.href).origin;
  const receive=(event:MessageEvent<unknown>)=>{
   if(event.source!==frameRef.current?.contentWindow||event.origin!==origin)return;
   const data=event.data;
   if(!data||typeof data!=='object'||!('type' in data)||!('gameId' in data)||data.type!=='aislots:exit'||data.gameId!==gameId)return;
   forgetGameEntry(gameId);void client.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'all'});onBack();
  };
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[url,allowed,gameId,client,onBack]);
 function close(){forgetGameEntry(gameId);void client.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'all'});onBack();}
 const content=<section className={`game-detail-shell${expanded?' game-detail-expanded':''}`} role="dialog" aria-modal="true" aria-label={t('gamePreview.dialog')}>
  {!expanded&&<header className="game-detail-toolbar"><button type="button" onClick={close}>{t('copy.backToLobby')}</button><span>{t('gamePreview.details')}</span><div><AsyncButton loading={preparing} type="button" disabled={preparing||!allowed} onClick={()=>void reopen()}>{t('copy.reEnter')}</AsyncButton></div></header>}
  {expanded&&<FloatingGameMenu open={menuOpen} onToggle={()=>setMenuOpen(open=>!open)} onExit={close}
   onShrink={()=>{setMenuOpen(false);setExpanded(false);}}/>}
  <div className="game-detail-content">
   <div className="game-detail-identity"><img src={game.cover} alt={t('gamePreview.cover')}/><div><h1>{game.title}</h1><span className="game-provider-label">{game.provider}</span><p>{t('gamePreview.tagline')}</p></div></div>
   {allowed&&<GameInsights part="rtp" gameId={gameId}/>}
   <div className="game-preview"><div className="game-preview-frame">
    {allowed&&url&&<iframe ref={frameRef} key={url} src={url} title={game.frameTitle} allow="autoplay; fullscreen; clipboard-write" allowFullScreen referrerPolicy="no-referrer" onError={()=>{setError(t('copy.gameFailedToLoadPleaseReEnter'));}}/>}
    {catalog.isError&&<NetworkError onRetry={()=>void catalog.refetch()} disabled={catalog.isFetching}/>}
    {catalog.isSuccess&&!allowed&&<p>{t('copy.comingSoon')}</p>}
    {error&&<div className="game-preview-error" role="alert"><p>{error}</p><AsyncButton loading={preparing} type="button" disabled={preparing||!allowed} onClick={()=>void reopen()}>{t('gamePreview.retry')}</AsyncButton></div>}
   </div><div className="game-preview-actions"><span>{t('gamePreview.preview')}</span><button type="button" disabled={!allowed||!url||preparing} onClick={()=>setExpanded(true)}>{t('gamePreview.expand')}</button></div></div>
   {allowed&&<GameInsights part="ranking" gameId={gameId}/>}
  </div>
 </section>;
 return createPortal(content,document.body);
}
