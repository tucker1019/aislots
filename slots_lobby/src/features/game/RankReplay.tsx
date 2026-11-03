import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {Modal} from 'antd';
import {fetchRankReplay} from '../../services/game-statistics';
import type {RankBoard,RankPeriod} from '../../services/game-statistics';
import {t} from '../../i18n';
export function RankReplay({orderId,board,period}:{orderId:string;board:RankBoard;period:RankPeriod}){
 const [open,setOpen]=useState(false);
 const query=useMutation({mutationFn:()=>fetchRankReplay(orderId,board,period),retry:false,onSuccess:()=>setOpen(true)});
 return <div className="game-rank-replay"><span>{t('gamePreview.orderId',{id:orderId})}</span><button type="button" disabled={query.isPending} aria-busy={query.isPending} aria-label={t('gamePreview.replay')} onClick={()=>query.mutate()}><span className="game-replay-label">{t('gamePreview.replay')}</span>{query.isPending&&<span className="game-replay-spinner" aria-hidden="true"/>}</button>
 {query.isError&&<span role="alert">{t('gamePreview.replayUnavailable')}</span>}
 <Modal open={open} title={t('gamePreview.replayTitle')} footer={null} onCancel={()=>setOpen(false)} destroyOnHidden width={430} className="game-rank-replay-modal">{open&&query.data&&<iframe title={t('gamePreview.replayTitle')} src={query.data} allow="autoplay; fullscreen; clipboard-write" referrerPolicy="no-referrer"/>}</Modal></div>;
}
