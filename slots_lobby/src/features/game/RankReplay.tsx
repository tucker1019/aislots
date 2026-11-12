import {AsyncButton} from '../../components/buttons/AsyncButton';
import {overlayContainer} from '../../app/designViewport';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import {useMutation} from '@tanstack/react-query';
import {message,Modal} from 'antd';
import {fetchRankReplay,type RankBoard,type RankPeriod} from '../../services/game-statistics';
import {t} from '../../i18n';
import {RankOrderNumber} from './RankOrderNumber';

export function RankReplay({orderId,betId,board,period,shareTarget,gameId='AG1'}:{orderId:string;betId:string;board:RankBoard;period:RankPeriod;shareTarget?:HTMLElement|null;gameId?:string}) {
 const [panel,setPanel]=useState<'replay'|'share'>();
 const [toast,holder]=message.useMessage({getContainer:overlayContainer,maxCount:1,classNames:{list:'lobby-toast-list'}});
 const query=useMutation<string,Error,'replay'|'share'>({
  mutationFn:()=>fetchRankReplay(orderId,board,period,gameId),
  retry:false,
  onSuccess:(_url,action)=>{setPanel(action);},
  onError:()=>{void toast.error(t('gamePreview.replayUnavailable'));},
 });
 async function copyLink(url:string) {
  try {
   await navigator.clipboard.writeText(url);
   void toast.success(t('copy.copied'));
  } catch {
   void toast.error(t('gamePreview.shareCopyFailed'));
  }
 }
 const shareButton=<AsyncButton className="game-rank-share-trigger" aria-label={t('gamePreview.share')}
   loading={query.isPending&&query.variables==='share'} type="button"
   disabled={query.isPending} onClick={()=>query.mutate('share')}>
   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M14 3v5C8 8 4 12 2 19c4-4 7-5 12-5v5l8-8-8-8Z"/>
   </svg>
  </AsyncButton>;
 return <div className="game-rank-replay">
  {holder}
  <RankOrderNumber betId={betId}/>
  <div className="game-rank-actions">
   <AsyncButton loading={query.isPending&&query.variables==='replay'} type="button" disabled={query.isPending} onClick={()=>query.mutate('replay')}>
    {t('gamePreview.replay')}
   </AsyncButton>
  </div>
  {shareTarget ? createPortal(shareButton,shareTarget) : shareTarget===undefined && shareButton}
  <Modal getContainer={overlayContainer} open={!!panel}
   title={t(panel==='share'?'gamePreview.share':'gamePreview.replayTitle')}
   footer={null} onCancel={()=>setPanel(undefined)} destroyOnHidden width={430} className="game-rank-replay-modal">
   {panel==='replay'&&query.data&&<iframe title={t('gamePreview.replayTitle')} src={query.data} allow="autoplay; fullscreen; clipboard-write" referrerPolicy="no-referrer"/>}
   {panel==='share'&&query.data&&<div className="game-rank-share">
    <input aria-label={t('gamePreview.shareLink')} value={query.data} readOnly onFocus={event=>event.currentTarget.select()}/>
    <button type="button" onClick={()=>{if(query.data)void copyLink(query.data);}}>{t('copy.copy')}</button>
   </div>}
  </Modal>
 </div>;
}
