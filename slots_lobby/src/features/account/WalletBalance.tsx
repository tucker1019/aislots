import { t } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { coinsLabel } from './formatCoins';
export function WalletBalance({coins,isFetching,onRefresh}:{coins:number;isFetching:boolean;onRefresh:()=>Promise<unknown>}){
 const [refreshing,setRefreshing]=useState(false);
 const [heldCoins,setHeldCoins]=useState(coins);
 const displayedCoins=refreshing?heldCoins:coins;
 const locked=useRef(false);
 const alive=useRef(true);
 const timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
 const release=useRef<(()=>void) | undefined>(undefined);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;clearTimeout(timer.current);release.current?.();};},[]);
 const busy=refreshing||isFetching;
 async function refresh(){
  if(locked.current||isFetching)return;
  locked.current=true;setHeldCoins(coins);setRefreshing(true);
  const minimum=new Promise<void>(resolve=>{release.current=resolve;timer.current=setTimeout(resolve,500);});
  // Unlock only when both the request and minimum animation duration finish.
  await Promise.allSettled([Promise.resolve().then(onRefresh),minimum]);
  locked.current=false;release.current=undefined;
  if(alive.current)setRefreshing(false);
 }
 return <div className="account-balance" aria-busy={busy}><span className="wallet-amount" aria-live="polite" aria-label={busy?t('copy.refreshingWalletBalance'):t('copy.walletBalanceValue', {p0: coinsLabel(displayedCoins)})}><span className={busy?'wallet-amount-hidden':undefined} aria-hidden={busy}>{coinsLabel(displayedCoins)}</span>{busy&&<span className="wallet-loading-dots" aria-hidden="true">{Array.from({length:3},(_,index)=><span key={index} style={{animationDelay:`${index*0.1}s`}}>.</span>)}</span>}</span><button type="button" aria-label={t('copy.refreshWalletBalance')} disabled={busy} onClick={()=>void refresh()}><span className={busy?'wallet-refresh-spinning':'wallet-refresh-icon'}><Icon name="refresh" size={17}/></span></button></div>;
}
