import {useEffect,useRef,useState} from 'react';
import {useQueries} from '@tanstack/react-query';
import {t} from '../../i18n';
import {useSessionStore} from '../../stores/session';
import {fetchGameRtp} from '../../services/game-statistics';
import {NetworkError} from '../../components/feedback/NetworkError';
const periods=[{value:'5m',label:'gamePreview.fiveMinutes'},{value:'1h',label:'gamePreview.oneHour'},{value:'24h',label:'gamePreview.oneDay'}] as const;
const theoreticalRtp=97;
export function RtpSummary({gameId='AG1'}:{gameId?:string}){
 const uid=useSessionStore(state=>state.session?.uid);
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);
 const queries=useQueries({queries:periods.map(period=>({queryKey:['game-rtp',gameId,period.value,uid],queryFn:({signal}:{signal:AbortSignal})=>fetchGameRtp(period.value,signal,gameId),retry:false,refetchInterval:false as const,refetchOnWindowFocus:false,refetchOnReconnect:false}))});
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
 // Prefer the shortest populated window once every shorter window has resolved.
 const selected=queries.find((query,index)=>query.data?.hasData&&queries.slice(0,index).every(previous=>!previous.isPending));
 const pending=queries.some(query=>query.isPending);
 const percent=selected?.data?.percent ?? (pending ? undefined : null);
 const [lastHeadline,setLastHeadline]=useState<{uid:typeof uid;percent:string|null}>();
 const previous=lastHeadline?.uid===uid ? lastHeadline?.percent : undefined;
 const headline=previous!==undefined&&queries.some(query=>query.isFetching) ? previous : percent;
 if(headline!==undefined&&headline!==previous)setLastHeadline({uid,percent:headline});
 const amount=(value:string|null|undefined)=>{
  if(value==null)return <span>{value===undefined?'…':'—'}</span>;
  const direction=Number(value)>theoreticalRtp?'up':Number(value)<theoreticalRtp?'down':'equal';
  return <strong className={`rtp-${direction}`}>{value}%<span className="rtp-direction" aria-hidden="true">{direction==='up'?' ↗':direction==='down'?' ↘':''}</span></strong>;
 };
 return <section className="game-rtp-card" aria-label={t('gamePreview.rtp')}><div className="game-metrics">
 <div className="game-metric game-metric-live"><div className="rtp-summary" ref={root} onKeyDown={event=>{if(event.key==='Escape')setOpen(false);}}><div className="rtp-summary-value"><span className="rtp-headline">{amount(headline)}</span><button type="button" aria-label={t('gamePreview.rtpTime')} aria-expanded={open} onClick={()=>setOpen(!open)}>ⓘ</button></div>{open&&<div className="rtp-popover" role="region" aria-label={t('gamePreview.rtpTime')}>{periods.map((period,index)=><div className="rtp-period" key={period.value}><span>{t(period.label)}</span>{amount(queries[index].data?.hasData?queries[index].data?.percent:queries[index].isPending?undefined:null)}</div>)}{queries.some(query=>query.isError)&&<NetworkError disabled={queries.some(query=>query.isFetching)} onRetry={()=>{queries.filter(query=>query.isError).forEach(query=>void query.refetch());}}/>}</div>}</div><span>{t('gamePreview.liveRtp')}</span></div>
 <div className="game-metric"><strong>{theoreticalRtp}%</strong><span>{t('gamePreview.realRtp')}</span></div><div className="game-metric"><strong>{t('gamePreview.medium')}</strong><span>{t('gamePreview.volatility')}</span></div><div className="game-metric"><strong>{t('gamePreview.unlimited')}</strong><span>{t('gamePreview.maxWin')}</span></div></div></section>;
}
