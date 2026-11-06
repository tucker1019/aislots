import {AsyncAntButton as Button} from '../../components/buttons/AsyncButton';
import {LoadingState} from '../../components/feedback/LoadingState';
import {useRef,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Alert,Select} from 'antd';
import {loadWalletAccounts} from '../../services/wallet-accounts';
import {createWithdrawal} from '../../services/withdrawal';
import type {WithdrawalTier} from '../../services/withdrawal';
import {navigateLobby} from '../../app/useLobbyRoute';
import {betMoney} from '../bet-records/money';
import {t,getLocale} from '../../i18n';
import {isRecord} from '../account/types';
interface Pending {tierId:string;channel:string;requestId:string}
function readPending(key:string):Pending|null{try{const v:unknown=JSON.parse(localStorage.getItem(key)||'null');return isRecord(v)&&typeof v.tierId==='string'&&typeof v.channel==='string'&&typeof v.requestId==='string'?{tierId:v.tierId,channel:v.channel,requestId:v.requestId}:null;}catch{return null;}}
export function WithdrawalForm({uid,coins,tiers,remainingTurnover,turnoverUnavailable=false}:{uid:number;coins:number;tiers:WithdrawalTier[];remainingTurnover:number;turnoverUnavailable?:boolean}){
 const client=useQueryClient();const key='withdrawal-pending-'+uid;
 const [pending,setPending]=useState(()=>readPending(key));
 const pendingRef=useRef(pending);
 const [tierId,setTierId]=useState(pending?.tierId||tiers[0]?.id||'');const [channel,setChannel]=useState(pending?.channel||'');
 const accounts=useQuery({queryKey:['wallet-accounts',uid],queryFn:({signal})=>loadWalletAccounts(signal),retry:false});
 const tier=tiers.find(v=>v.id===tierId);const bound=accounts.data?.filter(v=>v.bound)||[];
 const mutation=useMutation({mutationFn:async()=>{const value=pendingRef.current||{tierId,channel,requestId:crypto.randomUUID()};localStorage.setItem(key,JSON.stringify(value));pendingRef.current=value;setPending(value);return createWithdrawal(value.tierId,value.channel,value.requestId,uid);},onError:()=>{void client.invalidateQueries({queryKey:['withdrawal-turnover',uid]});},onSuccess:order=>{try{localStorage.removeItem(key);}catch{/* The confirmed order remains accessible in records. */}pendingRef.current=null;setPending(null);void client.invalidateQueries({queryKey:['lobby','current-profile']});void client.invalidateQueries({queryKey:['cash-records']});void client.invalidateQueries({queryKey:['wallet-ledger']});navigateLobby('withdrawal',{orderId:order.orderId});}});
 const locked=mutation.isPending||!!pending;
 return <>
 <section className="deposit-card"><h2>{t('withdrawal.amount')}</h2><div className="deposit-tiers">{tiers.map(v=><button type="button" key={v.id} aria-pressed={tierId===v.id} disabled={locked} onClick={()=>setTierId(v.id)}><strong>{betMoney(v.amount)}</strong>{(v.bonus>0||v.fee>0)&&<span className={`deposit-tier-badge ${v.bonus>0?'tier-bonus':'tier-fee'}`}>{v.bonus>0?t('copy.bonus'):t('copy.fee')}{((v.bonus||v.fee)/v.amount*100).toLocaleString(getLocale(),{maximumFractionDigits:4})}%</span>}</button>)}</div></section>
 <section className="deposit-card"><h2>{t('withdrawal.account')}</h2>{accounts.isPending?<LoadingState compact label={t('copy.loading')}/>:accounts.isError?<Button onClick={()=>void accounts.refetch()} loading={accounts.isFetching}>{t('copy.retry')}</Button>:<><Select aria-label={t('withdrawal.channel')} value={channel||undefined} placeholder={t('withdrawal.selectChannel')} disabled={locked} style={{width:'100%'}} onChange={setChannel} options={bound.map(v=>({value:v.channel,label:v.channel+' · '+v.account+' · '+v.name}))}/>{!bound.length&&<p>{t('withdrawal.bindFirst')}</p>}<Button type="link" disabled={mutation.isPending} onClick={()=>navigateLobby('wallet-management')}>{t('copy.walletManagement')}</Button></>}</section>
 {tier&&<section className="deposit-card deposit-summary"><dl><div><dt>{t('withdrawal.turnoverRemaining')}</dt><dd>{betMoney(remainingTurnover)}</dd></div><div><dt>{t('withdrawal.balance')}</dt><dd>{betMoney(coins)}</dd></div><div><dt>{t('withdrawal.debit')}</dt><dd>{betMoney(tier.amount)}</dd></div><div><dt>{t('copy.fee')}</dt><dd>{betMoney(tier.fee)}</dd></div><div><dt>{t('withdrawal.bonus')}</dt><dd>{betMoney(tier.bonus)}</dd></div><div><dt>{t('withdrawal.payout')}</dt><dd>{betMoney(tier.payoutAmount)}</dd></div></dl></section>}
 {remainingTurnover>0&&!pending&&<Alert type="warning" title={t('withdrawal.turnoverRequired',{amount:betMoney(remainingTurnover)})}/>}
 {mutation.isError&&<Alert type="error" title={t('withdrawal.retrySame')}/>}
 {tier&&coins<tier.amount&&!pending&&<p role="alert" className="deposit-error">{t('withdrawal.insufficient')}</p>}
 <Button block size="large" type="primary" loading={mutation.isPending} disabled={(!tier&&!pending)||!channel||(!pending&&(remainingTurnover>0||turnoverUnavailable))||(!pending&&!!tier&&coins<tier.amount)||accounts.isPending||accounts.isError} onClick={()=>mutation.mutate()}>{pending?t('withdrawal.retry'):t('withdrawal.submit')}</Button>
 </>;
}
