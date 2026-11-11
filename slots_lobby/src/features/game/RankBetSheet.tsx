import { gameDisplay, type GameId } from '../../app/games';
import {useLobbyGames} from '../home/useLobbyGames';
import {useState} from 'react';
import {Drawer} from 'antd';
import {overlayContainer} from '../../app/designViewport';
import {t} from '../../i18n';
import {statisticsMoney,type LeaderboardRow,type RankBoard,type RankPeriod} from '../../services/game-statistics';
import {RankOrderNumber} from './RankOrderNumber';
import {RankReplay} from './RankReplay';

export function RankBetSheet({row,board,period,onClose,gameId='AG1'}:{
 row:LeaderboardRow; board:RankBoard; period:RankPeriod; onClose:()=>void; gameId?:GameId;
}) {
 const catalog=useLobbyGames();
 const game=gameDisplay(gameId,catalog.data?.find(game=>game.id===gameId));
 const [open,setOpen]=useState(true);
 const [shareTarget,setShareTarget]=useState<HTMLSpanElement|null>(null);
 return <Drawer open={open} placement="bottom" title={t('gamePreview.betSlip')} onClose={()=>setOpen(false)}
  afterOpenChange={visible=>{if(!visible)onClose();}}
  getContainer={overlayContainer} rootStyle={{position:'absolute'}} className="game-rank-sheet"
  size="auto" zIndex={950} extra={<span className="game-rank-header-share" ref={setShareTarget}/>} closable={{placement:'start'}}>
  <div className="game-rank-sheet-summary">
   <span>{t('gamePreview.payout')}</span>
   <strong>{statisticsMoney(row.winAmount)}</strong>
   <dl>
    <div><dt>{t('copy.betAmount')}</dt><dd>{statisticsMoney(row.betAmount)}</dd></div>
    <div><dt>{t('gamePreview.multiplier')}</dt><dd>{row.multiplier}×</dd></div>
   </dl>
  </div>
  <div className="game-rank-sheet-info">
   <div className="game-rank-sheet-player">
    <img src={`/assets/profile/avatar/${row.avatarId}.png`} alt=""/>
    <div><strong>{row.nickname}</strong><time dateTime={row.occurredAt}>{new Date(row.occurredAt).toLocaleString()}</time></div>
   </div>
   {board!=='streak' && row.platformOrderId
    ? <RankReplay gameId={gameId} betId={row.betId} orderId={row.platformOrderId} board={board} period={period} shareTarget={shareTarget}/>
    : <RankOrderNumber betId={row.betId}/>}
   <div className="game-rank-sheet-game">
    <img src={game.cover} alt=""/>
    <div><strong>{game.title}</strong><span>{game.provider}</span></div>
    <button type="button" className="game-rank-sheet-play" onClick={()=>setOpen(false)}>
     {t('gamePreview.playNow')}
     <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="m4 2 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
     </svg>
    </button>
   </div>
  </div>
 </Drawer>;
}
