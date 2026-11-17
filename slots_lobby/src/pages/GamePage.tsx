import { useGameCardTransition } from '../features/game/useGameCardTransition';
import { useGameDocking } from '../features/game/useGameDocking';
import type { RefObject } from 'react';
import { gameDisplay, type GameId } from '../app/games';
import { createPortal } from 'react-dom';
import { t } from '../i18n';
import { useCallback,useEffect,useLayoutEffect,useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { forgetGameEntry,launchGame,readGameEntry,rememberGameEntry } from '../services/game-entry';
import { FloatingGameMenu } from '../features/game/FloatingGameMenu';
import { useLobbyGames } from '../features/home/useLobbyGames';
import { NetworkError } from '../components/feedback/NetworkError';
import { useGameExpansion } from '../features/game/useGameExpansion';
import { GameInsights } from '../features/game/GameInsights';
export function GamePage({onBack,onMinimize,minimized=false,gameId='AG1',dockRef}:{onBack:()=>void;onMinimize?:()=>void;minimized?:boolean;gameId?:GameId;dockRef?:RefObject<HTMLElement | null>}){
 const shellRef=useGameDocking(minimized,dockRef);
 const {opening,closeToCard}=useGameCardTransition(gameId,shellRef);
 const catalog=useLobbyGames();
 const entry=catalog.data?.find(game=>game.id===gameId);
 const allowed=entry?.enabled===true;
 const game=gameDisplay(gameId,entry);
 const [url,setUrl]=useState(()=>readGameEntry(gameId));const [preparing,setPreparing]=useState(false);const {expanded,transitioning,surfaceRef,changeExpanded}=useGameExpansion();const [error,setError]=useState('');
 const [menuOpen,setMenuOpen]=useState(false);
 const frameRef=useRef<HTMLIFrameElement>(null);
 const contentRef=useRef<HTMLDivElement>(null);const previewRef=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const preview=previewRef.current;const content=contentRef.current;if(!preview||!content)return;
  // Sticky offsets use design pixels; the shared lobby zoom must not be applied twice.
  const measure=()=>content.style.setProperty('--game-preview-block-height',`${preview.offsetHeight}px`);
  measure();if(typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(measure);observer.observe(preview);return()=>observer.disconnect();
 },[expanded]);
 const busy=useRef(false);const alive=useRef(true);const started=useRef(false);const client=useQueryClient();
 const reopen=useCallback(async()=>{
  if(busy.current||!allowed)return;busy.current=true;setPreparing(true);setError('');
  try{const next=await launchGame(gameId);if(!alive.current)return;rememberGameEntry(next,gameId);setUrl(next);}
  catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:t('copy.unableToEnterTheGamePleaseRetry'));}
  finally{busy.current=false;if(alive.current)setPreparing(false);}
 },[gameId,allowed]);
 useEffect(()=>{alive.current=true;void client.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'none'});if(allowed&&!url&&!started.current){started.current=true;void reopen();}return()=>{alive.current=false;};},[client,reopen,url,allowed]);
 useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(!minimized&&event.key==='Escape'){if(menuOpen)setMenuOpen(false);else changeExpanded(false);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[menuOpen,changeExpanded,minimized]);
 useEffect(()=>{
  if(!url||!allowed)return;
  const origin=new URL(url,window.location.href).origin;
  const receive=(event:MessageEvent<unknown>)=>{
   if(event.source!==frameRef.current?.contentWindow||event.origin!==origin)return;
   const data=event.data;
   if(!data||typeof data!=='object'||!('type' in data)||!('gameId' in data)||data.gameId!==gameId)return;
   if(data.type==='aislots:session-expired'){
    forgetGameEntry(gameId);setUrl(undefined);void reopen();return;
   }
   if(data.type!=='aislots:exit')return;
   const finish=()=>{forgetGameEntry(gameId);void client.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'all'});onBack();};
   if(minimized)finish();else closeToCard(finish);
  };
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[url,allowed,gameId,client,onBack,reopen,minimized,closeToCard]);
 function close(){closeToCard(()=>{forgetGameEntry(gameId);void client.invalidateQueries({queryKey:['lobby','current-profile'],refetchType:'all'});onBack();});}
 const content=<section ref={shellRef} className={`game-detail-shell${expanded?' game-detail-expanded':''}${transitioning?' game-detail-transitioning':''}${minimized?' game-detail-minimized':''}`} inert={minimized} aria-hidden={minimized} role="dialog" aria-modal={!minimized} aria-label={t('gamePreview.dialog')}>
  {!expanded&&<header className="game-detail-toolbar"><button className="game-toolbar-icon" type="button" onClick={close} aria-label={t('copy.backToLobby')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><span>{t('gamePreview.details')}</span><button className="game-toolbar-icon" type="button" disabled={transitioning} onClick={onMinimize} aria-label={t('gamePreview.minimize')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg></button></header>}
  {expanded&&<FloatingGameMenu open={menuOpen} onToggle={()=>setMenuOpen(open=>!open)} onExit={close}
   onShrink={()=>{setMenuOpen(false);changeExpanded(false);}}/>}
  <div className="game-detail-content" ref={contentRef}>
   <div className="game-detail-identity"><img src={game.cover} alt={t('gamePreview.cover')}/><div><h1>{game.title}</h1><span className="game-provider-label">{game.provider}</span><p>{t('gamePreview.tagline')}</p></div></div>
   {allowed&&<GameInsights part="rtp" gameId={gameId}/>}
   <div className="game-detail-play-area">
   <div className="game-preview" ref={previewRef}><div className="game-preview-frame" ref={surfaceRef}>
    {!opening&&allowed&&url&&<iframe ref={frameRef} key={url} src={url} title={game.frameTitle} allow="autoplay; fullscreen; clipboard-write" allowFullScreen referrerPolicy="no-referrer" onError={()=>{setError(t('copy.gameFailedToLoadPleaseReEnter'));}}/>}
    {catalog.isError&&<NetworkError onRetry={()=>void catalog.refetch()} disabled={catalog.isFetching}/>}
    {catalog.isSuccess&&!allowed&&<p>{t('copy.comingSoon')}</p>}
    {error&&<NetworkError onRetry={()=>void reopen()} disabled={preparing}/>}
   </div><div className="game-preview-actions"><span>{t('gamePreview.preview')}</span><button type="button" disabled={!allowed||!url||preparing} onClick={()=>changeExpanded(true)}>{t('gamePreview.expand')}</button></div></div>
   {allowed&&<GameInsights part="ranking" gameId={gameId}/>}
   </div>
  </div>
 </section>;
 return createPortal(content,document.body);
}
