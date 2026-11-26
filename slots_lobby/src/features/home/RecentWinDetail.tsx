import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {Modal,message} from 'antd';
import {overlayContainer} from '../../app/designViewport';
import {navigateLobby} from '../../app/useLobbyRoute';
import {AsyncButton} from '../../components/buttons/AsyncButton';
import {ShareSheet} from '../../components/share/ShareSheet';
import {t} from '../../i18n';
import {fetchRecentWinReplay,type RecentWin} from '../../services/recent-wins';
import {WinDetailModal} from '../game/WinDetailModal';

export function RecentWinDetail({row,onClose}:{row:RecentWin;onClose:()=>void}) {
 const [panel,setPanel]=useState<'replay'|'share'>();
 const [toast,holder]=message.useMessage({getContainer:overlayContainer,maxCount:1,classNames:{list:'lobby-toast-list'}});
 const replay=useMutation<string,Error,'replay'|'share'>({mutationFn:()=>fetchRecentWinReplay(row.id),retry:false,
  onSuccess:(_url,action)=>setPanel(action),onError:()=>{void toast.error(t('gamePreview.replayUnavailable'));}});
 const thirdParty = row.gameId.startsWith('J7_');
 const trigger = (action: 'replay' | 'share') => {
  if (thirdParty) {
   void toast.info(t('gamePreview.replayUnsupportedByProvider'));
   return;
  }
  replay.mutate(action);
 };
 return <>{holder}
  <WinDetailModal open data={row} onClose={onClose} titleExtra={<AsyncButton type="button" className="game-rank-share-trigger" aria-label={t('gamePreview.share')}
     loading={replay.isPending&&replay.variables==='share'} disabled={replay.isPending} onClick={()=>trigger('share')}>
     <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 3v5C8 8 4 12 2 19c4-4 7-5 12-5v5l8-8-8-8Z"/></svg>
    </AsyncButton>}
    replay={<AsyncButton type="button" className="recent-win-detail-replay-button" loading={replay.isPending&&replay.variables==='replay'} disabled={replay.isPending} onClick={()=>trigger('replay')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>{t('gamePreview.replay')}</AsyncButton>}
    playAction={<button type="button" className="game-rank-sheet-play" onClick={()=>{onClose();navigateLobby('game',{gameId:row.gameId});}}>{t('gamePreview.playNow')} <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="m4 2 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}/>
  <Modal centered getContainer={overlayContainer} open={panel==='replay'} title={t('gamePreview.replayTitle')} footer={null}
   onCancel={()=>setPanel(undefined)} destroyOnHidden width={430} zIndex={1100} className="game-rank-replay-modal">
   {panel==='replay'&&replay.data&&<iframe title={t('gamePreview.replayTitle')} src={replay.data} allow="autoplay; fullscreen; clipboard-write" referrerPolicy="no-referrer"/>}
  </Modal>
  <ShareSheet content={panel==='share'&&replay.data?{url:replay.data,kind:'replay'}:null} onClose={()=>setPanel(undefined)}/>
 </>;
}
