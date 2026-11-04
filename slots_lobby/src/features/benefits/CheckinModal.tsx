import {LoadingState} from '../../components/feedback/LoadingState';
import {NetworkError} from '../../components/feedback/NetworkError';
import { t } from '../../i18n';
import { useClaimToast } from '../rewards/useClaimToast';
import { Modal } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { claimCheckin, loadCheckinInfo } from '../../services/checkin';
import { useSessionStore } from '../../stores/session';
import { betMoney } from '../bet-records/money';
import { Icon } from '../../components/Icon';
export function CheckinModal({ onClose }: { onClose: () => void }) {
 const uid = useSessionStore(state => state.session?.uid);
 const client = useQueryClient();
 const {notify,holder}=useClaimToast();
 const info = useQuery({queryKey:['lobby','checkin-detail',uid],queryFn:({signal})=>loadCheckinInfo(signal),retry:false,staleTime:0,refetchOnWindowFocus:false});
 const claim = useMutation({mutationFn:claimCheckin,retry:false,onSuccess:()=>{
  notify();
  client.setQueryData(['lobby','checkin-detail',uid], info.data ? {...info.data,claimed:true,canClaim:false} : undefined);
  void client.invalidateQueries({queryKey:['lobby','current-profile']});
 }});
 const data = info.data;
 const claimedDays = data ? data.currentDay - (data.claimed ? 0 : 1) : 0;
 return <>{holder}<Modal open centered footer={null} closable={false} width={350} onCancel={() => {if (!claim.isPending) onClose();}} maskClosable={!claim.isPending} keyboard={!claim.isPending} className="checkin-modal" title={null}>
  <section className="checkin-panel" aria-label={t('copy.dailyCheckInRewards')}>
   <header><span className="checkin-eyebrow">DAILY REWARDS</span><h2>{t('copy.dailyCheckInRewards')}</h2><span className="checkin-header-icon" aria-hidden="true"><Icon name="calendar" size={40} /></span></header>
   {info.isPending ? <LoadingState compact label={t('copy.loadingCheckInRewards')}/> : !data ? <NetworkError disabled={info.isFetching} onRetry={()=>void info.refetch()}/> : <>
    <div className="checkin-rewards"><div className="checkin-stats"><span>{t('copy.consecutiveCheckIns')} <b>{claimedDays}</b> {t('copy.days')}</span><span>{t('copy.todaySReward')} <b>{betMoney(data.current.reward)}</b></span></div>
     <div className={`checkin-days${data.days.length === 7 ? ' checkin-seven' : ''}`}>
      {data.days.map(row => { const done=row.day<=claimedDays; const current=row.day===data.currentDay; return <div key={row.day} className={`checkin-day${current ? ' current' : ''}${done ? ' claimed' : ''}`} aria-label={t('copy.dayValueRewardValueValue', {p0: row.day, p1: betMoney(row.reward), p2: done ? t('copy.claimed') : current ? t('copy.current') : ''})}>
       <span>{t('checkin.dayLabel',{day:row.day})}</span><Icon name={done?'shield':'coin'} size={27} /><strong>{betMoney(current ? data.current.reward : row.reward)}</strong>
      </div>;})}
     </div>
    </div>
    <div className="checkin-progress"><p>{t('copy.walletDeposits')} <b className={data.rechargeAmount>=data.current.requiredRecharge?'met':''}>{betMoney(data.rechargeAmount)}</b> / {betMoney(data.current.requiredRecharge)}</p><p>{t('copy.requiredBets')} <b className={data.validBet>=data.current.requiredBet?'met':''}>{betMoney(data.validBet)}</b> / {betMoney(data.current.requiredBet)}</p></div>
    {claim.isError && <p className="checkin-error" role="alert">{claim.error.message}</p>}
    <button className="checkin-claim" type="button" disabled={claim.isPending || data.claimed || !data.canClaim || info.isFetching} onClick={()=>claim.mutate(data.activityDate)}>{claim.isPending?t('copy.checkingIn'):data.claimed?t('copy.checkedInToday'):!data.canClaim?t('copy.meetDepositAndBettingRequirementsToCheck'):t('copy.checkInNow')}</button>
   </>}
  </section>
  <button className="checkin-close" type="button" aria-label={t('copy.closeCheckIn')} disabled={claim.isPending} onClick={onClose}>×</button>
 </Modal></>;
}
