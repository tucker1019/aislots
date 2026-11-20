import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {Modal,message} from 'antd';
import {overlayContainer} from '../../app/designViewport';
import {navigateLobby} from '../../app/useLobbyRoute';
import {AsyncButton} from '../../components/buttons/AsyncButton';
import {ShareSheet} from '../../components/share/ShareSheet';
import {getLocale,t} from '../../i18n';
import {fetchRecentWinReplay,type RecentWin} from '../../services/recent-wins';
import {statisticsMoney} from '../../services/game-statistics';
import {RankOrderNumber} from '../game/RankOrderNumber';
import {useLobbyGames} from './useLobbyGames';
import '../../styles/game-detail.css';

export function RecentWinDetail({row,onClose}:{row:RecentWin;onClose:()=>void}) {
 const [panel,setPanel]=useState<'replay'|'share'>();
 const [toast,holder]=message.useMessage({getContainer:overlayContainer,maxCount:1,classNames:{list:'lobby-toast-list'}});
 const catalog=useLobbyGames();
 const game=catalog.data?.find(game=>game.id===row.gameId);
 const title=getLocale()!=='zh-TW'&&row.gameNameEn?row.gameNameEn:row.gameName;
 const replay=useMutation<string,Error,'replay'|'share'>({mutationFn:()=>fetchRecentWinReplay(row.id),retry:false,
  onSuccess:(_url,action)=>setPanel(action),onError:()=>{void toast.error(t('gamePreview.replayUnavailable'));}});
 return <>{holder}
  <Modal open centered getContainer={overlayContainer} onCancel={onClose} footer={null} width={390}
   className="recent-win-detail" title={<div className="recent-win-detail-title"><span>{t('gamePreview.betSlip')}</span>
    <AsyncButton type="button" className="game-rank-share-trigger" aria-label={t('gamePreview.share')}
     loading={replay.isPending&&replay.variables==='share'} disabled={replay.isPending} onClick={()=>replay.mutate('share')}>
     <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 3v5C8 8 4 12 2 19c4-4 7-5 12-5v5l8-8-8-8Z"/></svg>
    </AsyncButton>
   </div>}>
   <div className="recent-win-detail-summary">
    <span>{t('gamePreview.payout')}</span><strong>{statisticsMoney(row.winAmount)}</strong>
    <dl><div><dt>{t('copy.betAmount')}</dt><dd>{statisticsMoney(row.betAmount)}</dd></div>
     <div><dt>{t('gamePreview.multiplier')}</dt><dd>{row.multiplier}×</dd></div></dl>
   </div>
   <div className="game-rank-sheet-player recent-win-detail-player">
    <img src={`/assets/profile/avatar/${row.avatarId}.png`} alt=""/>
    <div><strong>{row.isSelf?t('recentWins.you'):row.nickname}</strong><time dateTime={row.occurredAt}>{new Date(row.occurredAt).toLocaleString(getLocale())}</time></div>
   </div>
   <div className="game-rank-replay recent-win-detail-order"><RankOrderNumber betId={row.betId}/><div className="game-rank-actions">
    <AsyncButton type="button" loading={replay.isPending&&replay.variables==='replay'} disabled={replay.isPending} onClick={()=>replay.mutate('replay')}>{t('gamePreview.replay')}</AsyncButton>
   </div></div>
   <div className="game-rank-sheet-game recent-win-detail-game">
    <img src={row.cover} alt=""/><div><strong>{title}</strong>{game?.provider&&<span>{game.provider}</span>}</div>
    <button type="button" className="game-rank-sheet-play" onClick={()=>{onClose();navigateLobby('game',{gameId:row.gameId});}}>{t('gamePreview.playNow')} ›</button>
   </div>
  </Modal>
  <Modal centered getContainer={overlayContainer} open={panel==='replay'} title={t('gamePreview.replayTitle')} footer={null}
   onCancel={()=>setPanel(undefined)} destroyOnHidden width={430} zIndex={1100} className="game-rank-replay-modal">
   {panel==='replay'&&replay.data&&<iframe title={t('gamePreview.replayTitle')} src={replay.data} allow="autoplay; fullscreen; clipboard-write" referrerPolicy="no-referrer"/>}
  </Modal>
  <ShareSheet content={panel==='share'&&replay.data?{url:replay.data,kind:'replay'}:null} onClose={()=>setPanel(undefined)}/>
 </>;
}
