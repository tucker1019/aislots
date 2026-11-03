import {NetworkError} from '../../components/feedback/NetworkError';
import {RankReplay} from './RankReplay';
import {useState} from 'react';
import {keepPreviousData,useQuery} from '@tanstack/react-query';
import {t} from '../../i18n';
import {GameFilter} from './GameFilter';
import {useSessionStore} from '../../stores/session';
import {fetchGameRtp,fetchLeaderboard,statisticsMoney} from '../../services/game-statistics';
import type {RtpWindow,RankBoard,RankPeriod} from '../../services/game-statistics';
const windows=[{value:'5m',label:'gamePreview.fiveMinutes'},{value:'1h',label:'gamePreview.oneHour'},{value:'24h',label:'gamePreview.oneDay'}] as const;
const periods=[{value:'today',label:'gamePreview.today'},{value:'week',label:'gamePreview.week'},{value:'all',label:'gamePreview.allTime'}] as const;
const rankings=[{value:'wins',label:'gamePreview.highestWins'},{value:'multiplier',label:'gamePreview.highestMultiplier'},{value:'streak',label:'gamePreview.longestStreak'}] as const;
export function GameInsights({part}:{part:'rtp'|'ranking'}){
 const uid=useSessionStore(state=>state.session?.uid);const [window,setWindow]=useState<RtpWindow>('1h');const [ranking,setRanking]=useState<RankBoard>('wins');const [period,setPeriod]=useState<RankPeriod>('today');
 const rtp=useQuery({queryKey:['game-rtp','AG1',window,uid],enabled:part==='rtp',queryFn:({signal})=>fetchGameRtp(window,signal),retry:false,staleTime:0,refetchInterval:false,refetchOnWindowFocus:false,refetchOnReconnect:false,placeholderData:keepPreviousData});
 const rank=useQuery({queryKey:['game-leaderboard','AG1',ranking,period,uid],enabled:part==='ranking',queryFn:({signal})=>fetchLeaderboard(ranking,period,signal),retry:false,staleTime:0,refetchInterval:false,refetchOnWindowFocus:false,refetchOnReconnect:false,placeholderData:keepPreviousData});
 if(part==='rtp')return <section className="game-rtp-card" aria-label={t('gamePreview.rtp')} aria-busy={rtp.isFetching}>
 <div className="game-metrics">
 <div className="game-metric game-metric-live"><GameFilter label={t('gamePreview.rtpTime')} value={window} displayValue={rtp.data?.hasData?rtp.data.percent+'%':rtp.isPending?'…':'—'} onChange={value=>{const next=windows.find(item=>item.value===value);if(next)setWindow(next.value);}} options={windows.map(row=>({value:row.value,label:t(row.label)}))}/><span>{t('gamePreview.liveRtp')}</span></div>
 <div className="game-metric"><strong>97%</strong><span>{t('gamePreview.realRtp')}</span></div>
 <div className="game-metric"><strong>{t('gamePreview.medium')}</strong><span>{t('gamePreview.volatility')}</span></div>
 <div className="game-metric"><strong>{t('gamePreview.unlimited')}</strong><span>{t('gamePreview.maxWin')}</span></div>
 </div>
 {rtp.isError&&<div className="game-metrics-error" role="alert"><span>{t('statistics.failed')}</span><button type="button" disabled={rtp.isFetching} onClick={()=>void rtp.refetch()}>{t('statistics.retry')}</button></div>}
 </section>;
 return <section className="game-ranking-card" aria-label={t('gamePreview.leaderboard')}><div className="game-section-title"><h2>{t('gamePreview.ranking')}</h2><GameFilter label={t('gamePreview.rankingTime')} value={period} onChange={value=>{const next=periods.find(item=>item.value===value);if(next)setPeriod(next.value);}} options={periods.map(row=>({value:row.value,label:t(row.label)}))}/></div><div className="game-ranking-tabs" role="tablist" aria-label={t('gamePreview.rankingType')}>{rankings.map(row=><button type="button" role="tab" key={row.value} aria-selected={ranking===row.value} aria-controls="game-ranking-panel" id={`ranking-${row.value}`} onClick={()=>setRanking(row.value)}>{t(row.label)}</button>)}</div><div role="tabpanel" id="game-ranking-panel" aria-labelledby={`ranking-${ranking}`}>
 {rank.isPending?<p className="game-ranking-empty" role="status">{t('statistics.loading')}</p>:!rank.data?<NetworkError disabled={rank.isFetching} onRetry={()=>void rank.refetch()}/>:<>
 {rank.data.items.length?<ol className="game-rank-list">{rank.data.items.map(row=><li key={row.rank+':'+row.betId}><span className="game-rank-position">{row.rank}</span><img src={`/assets/profile/avatar/${row.avatarId}.png`} alt=""/><div><strong>{row.nickname}</strong><p>{t('statistics.bet',{amount:statisticsMoney(row.betAmount)})}</p><time dateTime={row.occurredAt}>{new Date(row.occurredAt).toLocaleString()}</time></div><b>{ranking==='wins'?statisticsMoney(row.winAmount):ranking==='multiplier'?row.multiplier+'×':t('statistics.streak',{count:row.streak})}</b>{ranking!=='streak'&&row.platformOrderId&&<RankReplay orderId={row.platformOrderId} board={ranking} period={period}/>}</li>)}</ol>:<p className="game-ranking-empty">{t('statistics.empty')}</p>}
 {rank.isError&&<p role="alert">{t('statistics.refreshFailed')}</p>}
 </>}
 </div></section>;
}
