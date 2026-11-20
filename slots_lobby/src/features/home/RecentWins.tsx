import {useCallback,useEffect,useReducer,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {getLocale,t} from '../../i18n';
import {fetchRecentWins,recentWinMoney} from '../../services/recent-wins';
import type {RecentWin} from '../../services/recent-wins';
import {useSessionStore} from '../../stores/session';
import {coverPresentation} from './coverPresentation';
import {emptyWinQueue,recentWinsQueue} from './recentWinsQueue';
import {useWinRail} from './useWinRail';
import {RecentWinDetail} from './RecentWinDetail';
import '../../styles/recent-wins.css';

function Shield() {
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m12 2 8 3v6c0 5-8 10-8 10S4 16 4 11V5Z"/><path d="m8 11 3 3 5-6"/></svg>;
}
function Cover({row}:{row:RecentWin}) {
 const [failed,setFailed]=useState(false);
 const src=failed?row.cover:coverPresentation(row.gameId,row.cover).src;
 const title=getLocale()!=='zh-TW'&&row.gameNameEn?row.gameNameEn:row.gameName;
 return <img src={src} alt={title} onError={()=>setFailed(true)} loading="lazy" draggable={false}/>;
}
export function RecentWins({active=true}:{active?:boolean}) {
 const uid=useSessionStore(state=>state.session?.uid);
 // Reset per-player queues so "you" never leaks across account changes.
 return <RecentWinsFeed key={uid??'guest'} active={active} uid={uid}/>;
}
function RecentWinsFeed({active,uid}:{active:boolean;uid?:number}) {
 const queryClient=useQueryClient();
 const [queue,dispatch]=useReducer(recentWinsQueue,emptyWinQueue);
 const [selected,setSelected]=useState<RecentWin>();
 const query=useQuery({queryKey:['lobby','recent-wins',uid??'guest'],queryFn:({signal})=>fetchRecentWins(signal),
  enabled:active,refetchInterval:q=>active&&q.state.fetchFailureCount<5?60000:false,refetchIntervalInBackground:false,refetchOnMount:'always',refetchOnWindowFocus:false,
  retry:(failures)=>active&&failures<4,retryDelay:attempt=>Math.min((attempt+1)*2000,8000),staleTime:0});
 useEffect(()=>{if(query.data)dispatch({type:'received',items:query.data.items});},[query.data]);
 useEffect(()=>{if(!active)void queryClient.cancelQueries({queryKey:['lobby','recent-wins',uid??'guest'],exact:true});},[active,uid,queryClient]);
 const onNext=useCallback(()=>dispatch({type:'next'}),[]);
 const rail=useWinRail(active&&!selected,queue.visible.length,onNext);
 if(query.isSuccess&&!queue.visible.length&&!query.data?.items.length)return null;
 return <section className="recent-wins" aria-label={t('recentWins.title')}>
  <div className="recent-wins-heading"><h2><Shield/>{t('recentWins.title')}</h2><span className="recent-wins-live"><i/>{t('recentWins.live')}</span></div>
  {!queue.visible.length&&(!query.isSuccess||query.isFetching)&&<div className="recent-wins-skeleton" role="status" aria-label={t('copy.loading')}>
   {Array.from({length:4},(_,i)=><div className="recent-win-skeleton" key={i}><i/><span/><b/></div>)}
  </div>}
  <div className="recent-wins-rail" ref={rail} aria-label={t('recentWins.title')}>
   {queue.visible.map((row,index)=><button type="button" key={queue.cycle+index} className={'recent-win'+(row.isSelf?' recent-win-self':'')}
    aria-label={t('recentWins.details',{name:row.isSelf?t('recentWins.you'):row.nickname})} onClick={()=>setSelected(row)}>
    <span className="recent-win-cover"><Cover row={row}/>
     <svg className="recent-win-play-overlay" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="black" fillOpacity=".24" stroke="white" strokeWidth="2"/><path d="m25 18 22 14-22 14Z" fill="white"/></svg>
     <span className="recent-win-multiplier">{row.multiplier.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')}×</span>
    </span>
    <span className="recent-win-player"><span>{row.isSelf?t('recentWins.you'):row.nickname}</span><span className="recent-win-verified" role="img" aria-label={t('recentWins.verified')} title={t('recentWins.verified')}><Shield/></span></span>
    <span className="recent-win-result"><strong title={'WIN '+recentWinMoney(row.winAmount)}>WIN {recentWinMoney(row.winAmount)}</strong></span>
   </button>)}
  </div>
  {selected&&<RecentWinDetail row={selected} onClose={()=>setSelected(undefined)}/>}
 </section>;
}
