import { useClaimToast } from '../rewards/useClaimToast';
import { useState } from 'react';
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
 const [success, setSuccess] = useState<number | null>(null);
 const info = useQuery({queryKey:['lobby','checkin-detail',uid],queryFn:({signal})=>loadCheckinInfo(signal),retry:false,staleTime:0,refetchOnWindowFocus:false});
 const claim = useMutation({mutationFn:claimCheckin,retry:false,onSuccess:reward=>{
  notify();
  setSuccess(reward);
  client.setQueryData(['lobby','checkin-detail',uid], info.data ? {...info.data,claimed:true,canClaim:false} : undefined);
  void client.invalidateQueries({queryKey:['lobby','current-profile']});
 }});
 const data = info.data;
 const claimedDays = data ? data.currentDay - (data.claimed ? 0 : 1) : 0;
 return <>{holder}<Modal open centered footer={null} closable={false} width={350} onCancel={() => {if (!claim.isPending) onClose();}} maskClosable={!claim.isPending} keyboard={!claim.isPending} className="checkin-modal" title={null}>
  <section className="checkin-panel" aria-label="每日签到活动">
   <header><span className="checkin-eyebrow">DAILY REWARDS</span><h2>每日签到活动</h2><span className="checkin-header-icon" aria-hidden="true"><Icon name="calendar" size={40} /></span></header>
   {info.isPending ? <p className="checkin-feedback" role="status">正在加载签到奖励…</p> : !data ? <div className="checkin-feedback" role="alert"><p>签到信息加载失败</p><button type="button" disabled={info.isFetching} onClick={()=>void info.refetch()}>重试</button></div> : <>
    <div className="checkin-rewards"><div className="checkin-stats"><span>已连续签到 <b>{claimedDays}</b> 天</span><span>今日奖励 <b>{betMoney(data.current.reward)}</b></span></div>
     <div className={`checkin-days${data.days.length === 7 ? ' checkin-seven' : ''}`}>
      {data.days.map(row => { const done=row.day<=claimedDays; const current=row.day===data.currentDay; return <div key={row.day} className={`checkin-day${current ? ' current' : ''}${done ? ' claimed' : ''}`} aria-label={`第${row.day}天，奖励${betMoney(row.reward)}${done ? '，已领取' : current ? '，当前' : ''}`}>
       <span>第{row.day}天</span><Icon name={done?'shield':'coin'} size={27} /><strong>{betMoney(current ? data.current.reward : row.reward)}</strong>
      </div>;})}
     </div>
    </div>
    <div className="checkin-progress"><p>钱包充值 <b className={data.rechargeAmount>=data.current.requiredRecharge?'met':''}>{betMoney(data.rechargeAmount)}</b> / {betMoney(data.current.requiredRecharge)}</p><p>所需投注 <b className={data.validBet>=data.current.requiredBet?'met':''}>{betMoney(data.validBet)}</b> / {betMoney(data.current.requiredBet)}</p></div>
    {claim.isError && <p className="checkin-error" role="alert">{claim.error.message}</p>}
    {success !== null && <p className="checkin-success" role="status">签到成功，获得 {betMoney(success)}</p>}
    <button className="checkin-claim" type="button" disabled={claim.isPending || data.claimed || !data.canClaim || info.isFetching} onClick={()=>claim.mutate(data.activityDate)}>{claim.isPending?'签到中…':data.claimed?'今日已签到':!data.canClaim?'完成充值与投注条件后签到':'立即签到'}</button>
   </>}
  </section>
  <button className="checkin-close" type="button" aria-label="关闭签到" disabled={claim.isPending} onClick={onClose}>×</button>
 </Modal></>;
}
