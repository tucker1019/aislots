import type {ReactNode} from 'react';
import {Modal} from 'antd';
import {overlayContainer} from '../../app/designViewport';
import {getLocale,t} from '../../i18n';
import {statisticsMoney} from '../../services/game-statistics';
import {RankOrderNumber} from './RankOrderNumber';
import '../../styles/game-detail.css';
import '../../styles/recent-wins.css';

export interface WinDetailData {
  betId:string; betAmount:string; winAmount:string; multiplier:string; avatarId:number;
  nickname:string; uid:string; anonymous:boolean; occurredAt:string;
  gameName:string; gameNameEn:string; cover:string; provider?:string;
}
export function WinDetailModal({data,open,onClose,titleExtra,replay,playAction}:{data:WinDetailData;open:boolean;onClose:()=>void;titleExtra?:ReactNode;replay:ReactNode;playAction:ReactNode}) {
 const title=getLocale()!=='zh-TW'&&data.gameNameEn?data.gameNameEn:data.gameName;
 return <Modal open={open} centered getContainer={overlayContainer} onCancel={onClose} footer={null} width={390} className="recent-win-detail game-rank-sheet" destroyOnHidden transitionName="" maskTransitionName="" title={<div className="recent-win-detail-title"><span>{t('gamePreview.betSlip')}</span>{titleExtra}</div>}>
  <div className="recent-win-detail-summary game-rank-sheet-summary"><span>{t('gamePreview.payout')}</span><strong>{statisticsMoney(data.winAmount)}</strong><dl><div><dt>{t('copy.betAmount')}</dt><dd>{statisticsMoney(data.betAmount)}</dd></div><div><dt>{t('gamePreview.multiplier')}</dt><dd>{data.multiplier}×</dd></div></dl></div>
  <div className="game-rank-sheet-info">
   <div className="game-rank-sheet-player recent-win-detail-player"><img src={`/assets/profile/avatar/${data.avatarId}.png`} alt=""/><div><strong>{data.anonymous?t('recentWins.anonymous'):data.nickname}</strong><small className="game-rank-sheet-uid">UID {data.uid}</small><time dateTime={data.occurredAt}>{new Date(data.occurredAt).toLocaleString(getLocale())}</time></div></div>
   <div className="game-rank-replay recent-win-detail-order"><RankOrderNumber betId={data.betId}/><div className="game-rank-actions">{replay}</div></div>
   <div className="game-rank-sheet-game recent-win-detail-game"><img src={data.cover} alt=""/><div><strong>{title}</strong>{data.provider&&<span>{data.provider}</span>}</div>{playAction}</div>
  </div>
 </Modal>;
}
