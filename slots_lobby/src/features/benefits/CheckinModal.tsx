import {ClaimBadge} from '../rewards/ClaimBadge';
import {AsyncButton} from '../../components/buttons/AsyncButton';
import { overlayContainer } from '../../app/designViewport';
import {LoadingState} from '../../components/feedback/LoadingState';
import {NetworkError} from '../../components/feedback/NetworkError';
import { t } from '../../i18n';
import { useClaimToast } from '../rewards/useClaimToast';
import { Modal } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkinDetailKey, claimCheckin, loadCheckinInfo } from '../../services/checkin';
import { useSessionStore } from '../../stores/session';
import { betMoney } from '../bet-records/money';
import { Icon } from '../../components/Icon';
export function CheckinModal({ onClose, open = true, afterClose, checkedOnEntry = false }: {
 onClose: () => void; open?: boolean; afterClose?: () => void; checkedOnEntry?: boolean;
}) {
 const uid = useSessionStore(state => state.session?.uid);
 const client = useQueryClient();
 const {notify,holder}=useClaimToast();
 const info = useQuery({queryKey:checkinDetailKey(uid),queryFn:({signal})=>loadCheckinInfo(signal),retry:false,staleTime:0,refetchOnMount:!checkedOnEntry,refetchOnWindowFocus:false});
 const claim = useMutation({meta:{claimUid:uid,claimIndicator:'checkin'},mutationFn:claimCheckin,retry:false,onSuccess:()=>{
  notify();
  client.setQueryData(checkinDetailKey(uid), info.data ? {...info.data,claimed:true,canClaim:false} : undefined);
  void client.invalidateQueries({queryKey:['lobby','current-profile']});
 }});
 const closeButton = <button className="checkin-close" type="button" aria-label={t('copy.closeCheckIn')} disabled={claim.isPending} onClick={onClose}><Icon name="close" size={24} /></button>;
 const data = info.data;
 const claimedDays = data ? data.currentDay - (data.claimed ? 0 : 1) : 0;
 return <>{holder}<Modal getContainer={overlayContainer} open={open} afterClose={afterClose} centered footer={closeButton} closable={false} width={350} onCancel={() => {if (!claim.isPending) onClose();}} maskClosable={!claim.isPending} keyboard={!claim.isPending} className="checkin-modal" transitionName="checkin-fade" title={null}>
  <section className="checkin-panel" aria-label={t('copy.dailyCheckInRewards')}>
   <header><h2>{t('copy.dailyCheckInRewards')}</h2><span className="checkin-header-icon" aria-hidden="true"><Icon name="calendar" size={26} /></span></header>
   {info.isPending ? <LoadingState compact label={t('copy.loadingCheckInRewards')}/> : !data ? <NetworkError disabled={info.isFetching} onRetry={()=>void info.refetch()}/> : <>
    <div className="checkin-rewards"><div className="checkin-stats"><div><span>{t('copy.consecutiveCheckIns')}</span><strong>{claimedDays} {t('copy.days')}</strong></div><div><span>{t('copy.todaySReward')}</span><strong>{betMoney(data.current.reward)}</strong></div></div>
     <div className={`checkin-days${data.days.length === 7 ? ' checkin-seven' : ''}`}>
      {data.days.map(row => { const done=row.day<=claimedDays; const current=row.day===data.currentDay; return <div key={row.day} className={`checkin-day${current ? ' current' : ''}${done ? ' claimed' : ''}`} aria-label={t('copy.dayValueRewardValueValue', {p0: row.day, p1: betMoney(row.reward), p2: done ? t('copy.claimed') : current ? t('copy.current') : ''})}>
       <span>{t('checkin.dayLabel',{day:row.day})}</span><Icon name={done?'checkCircle':'rupiah'} size={done ? 24 : 28} /><strong>{betMoney(current ? data.current.reward : row.reward)}</strong>
      </div>;})}
     </div>
    </div>
    <div className="checkin-progress"><p><span>{t('copy.walletDeposits')}</span> <span><b className={data.rechargeAmount>=data.current.requiredRecharge?'met':''}>{betMoney(data.rechargeAmount)}</b> / {betMoney(data.current.requiredRecharge)}</span></p><p><span>{t('copy.requiredBets')}</span> <span><b className={data.validBet>=data.current.requiredBet?'met':''}>{betMoney(data.validBet)}</b> / {betMoney(data.current.requiredBet)}</span></p></div>
    {claim.isError && <p className="checkin-error" role="alert">{claim.error.message}</p>}
    <AsyncButton loading={claim.isPending} className="checkin-claim" type="button" disabled={claim.isPending || data.claimed || !data.canClaim || info.isFetching} onClick={()=>claim.mutate(data.activityDate)}>{data.claimed?t('copy.checkedInToday'):!data.canClaim?t('copy.meetDepositAndBettingRequirementsToCheck'):t('copy.checkInNow')}<ClaimBadge active={data.canClaim&&!data.claimed&&data.current.reward>0}/></AsyncButton>
   </>}
  </section>
 </Modal></>;
}
