import {AsyncButton} from '../components/buttons/AsyncButton';
import {ledgerLabel} from '../i18n/server-labels';
import {LoadingState} from '../components/feedback/LoadingState';
import {NetworkError} from '../components/feedback/NetworkError';
import { t, getLocale } from '../i18n';
import { RecordsLayout } from '../components/records/RecordsLayout';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { fetchLedger } from '../services/wallet-ledger';
import { useSessionStore } from '../stores/session';
import { recordRange, periodLabels } from '../features/cash-records/range';
import type { RecordPeriod } from '../features/cash-records/range';
import { betMoney } from '../features/bet-records/money';
import { LedgerDetail } from '../features/wallet-ledger/LedgerDetail';
import { navigateLobby } from '../app/useLobbyRoute';
import { isRecord } from '../features/account/types';
export function WalletLedgerPage({onBack,id}:{onBack:()=>void;id?:string}){
 const [category,setCategory]=useState('');const [period,setPeriod]=useState<RecordPeriod>('today');const [panel,setPanel]=useState<'category'|'period'|null>(null);
 const uid=useSessionStore(state=>state.session?.uid);const range=useMemo(()=>recordRange(period),[period]);
 const query=useInfiniteQuery({queryKey:['wallet-ledger',uid,range.from,range.to,category],initialPageParam:'',queryFn:({pageParam,signal})=>fetchLedger(range.from,range.to,category,pageParam,signal),getNextPageParam:last=>last.nextCursor||undefined,retry:false});
 const categories=query.data?.pages[0]?.categories??[];const items=Array.from(new Map(query.data?.pages.flatMap(page=>page.items).map(row=>[row.id,row])??[]).values());
 const scroll=useRef(0);const previous=useRef(id);
 useEffect(()=>{if(previous.current&&!id){const frame=requestAnimationFrame(()=>document.getElementById('root')?.scrollTo({top:scroll.current}));previous.current=id;return ()=>cancelAnimationFrame(frame);}previous.current=id;},[id]);
 function open(value:string){scroll.current=document.getElementById('root')?.scrollTop??0;navigateLobby('wallet-ledger',{orderId:value});}
 function close(){const state:unknown=window.history.state;if(isRecord(state)&&state.lobbyFrom==='/wallet-ledger')window.history.back();else navigateLobby('wallet-ledger');}
 if(id)return <LedgerDetail id={id} onBack={close}/>;
 return <RecordsLayout title={t('copy.walletTransactions')} backLabel={t('copy.backToMyAccount')} onBack={onBack} filters={
 <div className="cash-filter-container" onKeyDown={event=>{if(event.key==='Escape')setPanel(null);}}><div className="cash-filter-bar">
 <button type="button" aria-expanded={panel==='category'} onClick={()=>setPanel(panel==='category'?null:'category')}>{ledgerLabel(category,categories.find(row=>row.id===category)?.name||t('copy.all'))}<span aria-hidden="true">{panel==='category'?'▴':'▾'}</span></button>
 <button type="button" aria-expanded={panel==='period'} onClick={()=>setPanel(panel==='period'?null:'period')}>{periodLabels()[period]}<span aria-hidden="true">{panel==='period'?'▴':'▾'}</span></button></div>
 {panel&&<><button className="cash-filter-backdrop" type="button" aria-label={t('copy.closeFilters')} onClick={()=>setPanel(null)}/><div className="cash-filter-options ledger-filter-options" aria-label={panel==='category'?t('copy.transactionType'):t('copy.recordDate')}>{panel==='category'?[{id:'',name:t('copy.all')},...categories].map(row=><button type="button" key={row.id} aria-pressed={category===row.id} onClick={()=>{setCategory(row.id);setPanel(null);}}>{ledgerLabel(row.id,row.name)}</button>):(Object.keys(periodLabels()) as RecordPeriod[]).map(value=><button type="button" key={value} aria-pressed={period===value} onClick={()=>{setPeriod(value);setPanel(null);}}>{periodLabels()[value]}</button>)}</div></>}
 </div>}>
 {query.isPending?<LoadingState label={t('copy.loadingWalletTransactions')}/>:query.isError&&!query.data?<NetworkError disabled={query.isFetching} onRetry={()=>void query.refetch()}/>:<>
 {items.length===0?<div className="cash-records-empty"><Icon name="list" size={42}/><p>{t('copy.noWalletTransactions')}</p></div>:<div className="ledger-list">{items.map(row=><button className="ledger-row" type="button" key={row.id} onClick={()=>open(row.id)}><span className="cash-record-icon"><Icon name="wallet" size={20}/></span><span className="ledger-description"><strong>{ledgerLabel(row.categoryId,row.type)}</strong><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString(getLocale(),{hour12:false})}</time></span><span className="ledger-result"><strong className={row.amount<0?'bet-loss':'bet-gain'}>{row.amount>0?'+':''}{betMoney(row.amount)}</strong><span>{t('copy.accountBalance')} {betMoney(row.balance)}</span></span><Icon name="chevron" size={14}/></button>)}</div>}
 {query.isError&&<p className="cash-records-feedback" role="alert">{t('copy.loadingFailedExistingRecordsArePreserved')}</p>}
 {query.hasNextPage?<AsyncButton loading={query.isFetchingNextPage} type="button" className="cash-load-more" disabled={query.isFetching} onClick={()=>void query.fetchNextPage()}>{query.isError?t('copy.retryLoading'):t('copy.loadMore')}</AsyncButton>:items.length>0&&<p className="cash-records-end">{t('copy.allRecordsLoaded')}</p>}
 </>}
 </RecordsLayout>;
}
