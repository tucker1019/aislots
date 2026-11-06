import {AsyncButton} from '../../components/buttons/AsyncButton';
import { overlayContainer } from '../../app/designViewport';
import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {Modal} from 'antd';
import {fetchRankReplay} from '../../services/game-statistics';
import type {RankBoard,RankPeriod} from '../../services/game-statistics';
import {t} from '../../i18n';
export function RankReplay({orderId,betId,board,period}:{orderId:string;betId:string;board:RankBoard;period:RankPeriod}){
 const [open,setOpen]=useState(false);
 const query=useMutation({mutationFn:()=>fetchRankReplay(orderId,board,period),retry:false,onSuccess:()=>setOpen(true)});
 return <div className="game-rank-replay"><span className="game-rank-order"><span className="game-rank-order-number" title={betId}>{t('gamePreview.betId',{id:betId})}</span><span className="game-platform-verified" title={t('gamePreview.platformVerified')} aria-label={t('gamePreview.platformVerified')}><svg width="13" height="15" viewBox="0 0 16 18" fill="none" aria-hidden="true"><path d="M8 1 14.5 3.5V8c0 4.1-2.8 6.9-6.5 9C4.3 14.9 1.5 12.1 1.5 8V3.5L8 1Z" fill="currentColor"/><path d="m4.8 8.8 2.1 2.1 4.3-4.4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{t('gamePreview.platformVerified')}</span></span></span><AsyncButton loading={query.isPending} type="button" disabled={query.isPending} aria-busy={query.isPending} aria-label={t('gamePreview.replay')} onClick={()=>query.mutate()}><span className="game-replay-label">{t('gamePreview.replay')}</span></AsyncButton>
 {query.isError&&<span role="alert">{t('gamePreview.replayUnavailable')}</span>}
 <Modal getContainer={overlayContainer} open={open} title={t('gamePreview.replayTitle')} footer={null} onCancel={()=>setOpen(false)} destroyOnHidden width={430} className="game-rank-replay-modal">{open&&query.data&&<iframe title={t('gamePreview.replayTitle')} src={query.data} allow="autoplay; fullscreen; clipboard-write" referrerPolicy="no-referrer"/>}</Modal></div>;
}
