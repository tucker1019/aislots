import {ShareSheet} from '../../components/share/ShareSheet';
import { gameDisplay, type GameId } from '../../app/games';
import {useLobbyGames} from '../home/useLobbyGames';
import {useState} from 'react';
import {t} from '../../i18n';
import {type LeaderboardRow,type RankBoard,type RankPeriod} from '../../services/game-statistics';
import {RankReplay} from './RankReplay';
import {WinDetailModal} from './WinDetailModal';

export function RankBetSheet({row,board,period,onClose,gameId='AG1'}:{
 row:LeaderboardRow; board:RankBoard; period:RankPeriod; onClose:()=>void; gameId?:GameId;
}) {
 const catalog=useLobbyGames();
 const game=gameDisplay(gameId,catalog.data?.find(game=>game.id===gameId));
 const [open,setOpen]=useState(true);
 const [shareUrl,setShareUrl]=useState<string>();
 const [sharing,setSharing]=useState(false);
 const [shareTarget,setShareTarget]=useState<HTMLSpanElement|null>(null);
 return <><WinDetailModal open={open} onClose={()=>setOpen(false)} data={{betId:row.betId,betAmount:row.betAmount,winAmount:row.winAmount,multiplier:row.multiplier,avatarId:row.avatarId,nickname:row.nickname,uid:row.userId,anonymous:row.anonymous===true,occurredAt:row.occurredAt,gameName:game.title,gameNameEn:game.title,cover:game.cover,provider:game.provider}} titleExtra={<span className="game-rank-header-share" ref={setShareTarget}/>} replay={row.platformOrderId?<RankReplay gameId={gameId} betId={row.betId} orderId={row.platformOrderId} board={board} period={period} shareTarget={shareTarget} hideOrder onShare={url=>{setShareUrl(url);setSharing(true);setOpen(false);}}/>:<span/>} playAction={<button type="button" className="game-rank-sheet-play" onClick={()=>setOpen(false)}>{t('gamePreview.playNow')} <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="m4 2 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}/>
 <ShareSheet content={sharing&&shareUrl?{url:shareUrl,kind:'replay'}:null} onClose={onClose}/>
 </>;
}
