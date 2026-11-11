import type { GameId } from '../../app/games';
import {RtpSummary} from './RtpSummary';
import {LoadingState} from '../../components/feedback/LoadingState';
import {NetworkError} from '../../components/feedback/NetworkError';
import {RankBetSheet} from './RankBetSheet';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {t} from '../../i18n';
import {GameFilter} from './GameFilter';
import {useSessionStore} from '../../stores/session';
import {fetchLeaderboard,statisticsMoney} from '../../services/game-statistics';
import type {LeaderboardRow,RankBoard,RankPeriod} from '../../services/game-statistics';
const periods=[{value:'today',label:'gamePreview.today'},{value:'week',label:'gamePreview.week'},{value:'all',label:'gamePreview.allTime'}] as const;
const rankings=[{value:'wins',label:'gamePreview.highestWins'},{value:'multiplier',label:'gamePreview.highestMultiplier'},{value:'streak',label:'gamePreview.longestStreak'}] as const;
export function GameInsights({part,gameId='AG1'}:{part:'rtp'|'ranking';gameId?:GameId}){
 const uid=useSessionStore(state=>state.session?.uid);const [ranking,setRanking]=useState<RankBoard>('wins');const [period,setPeriod]=useState<RankPeriod>('all');
 const [selected,setSelected]=useState<LeaderboardRow>();
 const rank=useQuery({queryKey:['game-leaderboard',gameId,ranking,period,uid],enabled:part==='ranking',queryFn:({signal})=>fetchLeaderboard(ranking,period,signal,gameId),retry:false,staleTime:0,refetchInterval:false,refetchOnWindowFocus:false,refetchOnReconnect:false});
 if(part==='rtp')return <RtpSummary gameId={gameId}/>;
 return <section className="game-ranking-card" aria-label={t('gamePreview.leaderboard')}><div className="game-section-title"><h2>{t('gamePreview.ranking')}</h2><GameFilter label={t('gamePreview.rankingTime')} value={period} onChange={value=>{const next=periods.find(item=>item.value===value);if(next)setPeriod(next.value);}} options={periods.map(row=>({value:row.value,label:t(row.label)}))}/></div><div className="game-ranking-tabs" role="tablist" aria-label={t('gamePreview.rankingType')}>{rankings.map(row=><button type="button" role="tab" key={row.value} aria-selected={ranking===row.value} aria-controls="game-ranking-panel" id={`ranking-${row.value}`} onClick={()=>setRanking(row.value)}>{t(row.label)}</button>)}</div><div role="tabpanel" id="game-ranking-panel" aria-labelledby={`ranking-${ranking}`}>
 {rank.isPending?<LoadingState compact label={t('statistics.loading')}/>:!rank.data?<NetworkError disabled={rank.isFetching} onRetry={()=>void rank.refetch()}/>:<>
 {rank.data.items.length?<ol className="game-rank-list">{rank.data.items.map(row=>{
  const content=<>
    <span className="game-rank-position">{row.rank}</span>
    <img src={`/assets/profile/avatar/${row.avatarId}.png`} alt=""/>
    <span className="game-rank-player">
     <strong>{row.nickname}</strong>
     {ranking==='streak'
      ? <span className="game-rank-streak-summary">
       <b className="game-rank-streak">{t('statistics.streak',{count:row.streak})}</b>
       {row.occurredAt && <time dateTime={row.occurredAt}>
        {new Date(row.occurredAt).toLocaleString(undefined, {
         timeZone: rank.data.timezone,
         year: 'numeric', month: '2-digit', day: '2-digit',
         hour: '2-digit', minute: '2-digit', hour12: false,
        })}
       </time>}
      </span>
      : <>
       <span className="game-rank-wager">{t('statistics.bet',{amount:statisticsMoney(row.betAmount)})}</span>
       <span className="game-rank-result">{t('gamePreview.payout')} <b>+{statisticsMoney(row.winAmount)}</b> <small>{row.multiplier}×</small></span>
      </>}
    </span>
  </>;
  return <li key={row.rank+':'+row.betId}>
   {ranking==='streak'
    ? <div className="game-rank-row">{content}</div>
    : <button className="game-rank-row" type="button" onClick={()=>setSelected(row)}>{content}</button>}
  </li>;
 })}</ol>:<p className="game-ranking-empty">{t('statistics.empty')}</p>}
 {rank.isError&&<p role="alert">{t('statistics.refreshFailed')}</p>}
 </>}
 </div>
 {selected&&<RankBetSheet gameId={gameId} row={selected} board={ranking} period={period} onClose={()=>setSelected(undefined)}/>}
 </section>;
}
