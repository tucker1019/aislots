import { t } from '../../i18n';
import { useClaimToast } from '../rewards/useClaimToast';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../components/Icon';
import { useSessionStore } from '../../stores/session';
import { claimVipReward, type VipDetails, type VipLevel, type VipRewardKind } from '../../services/vip-details';
import { betMoney } from '../bet-records/money';
export function VipPerks({ info, tier }: { info: VipDetails; tier: VipLevel }) {
  const client = useQueryClient();
  const {notify,holder} = useClaimToast();
  const uid = useSessionStore(state => state.session?.uid);
  const requests = useRef(new Map<string,string>());
  const busy = useRef(false);
  const [notice,setNotice] = useState('');
  const refresh = async () => { await Promise.all([
    client.invalidateQueries({queryKey:['lobby','vip-details',uid]}),
    client.invalidateQueries({queryKey:['lobby','benefits','vip',uid]}),
    client.invalidateQueries({queryKey:['lobby','current-profile']}),
  ]); };
  const claim = useMutation({mutationFn:({kind,id,rewardId}:{kind:VipRewardKind;id:string;rewardId:string})=>claimVipReward(kind,info.activityDate,id,rewardId), retry:false,
    onSuccess:async (amount,variables)=>{
      notify();
      client.setQueryData<VipDetails>(['lobby','vip-details',uid],old=>old ? variables.kind==='upgrade'
        ? {...old,upgradeRewards:old.upgradeRewards.map(row=>row.rewardId===variables.rewardId?{...row,status:'claimed'}:row)}
        : {...old,[variables.kind]:{...old[variables.kind],status:'claimed'}} : old);
      setNotice(t('copy.claimedValue', {p0: betMoney(amount)}));await refresh();
    },
    onError:async()=>{setNotice(t('copy.claimResultIsUnconfirmedRefreshingNowRetry'));await refresh();},
    onSettled:()=>{busy.current=false;},
  });
  const rows = [
    {kind:'upgrade',icon:'growth',title:t('copy.levelUpReward'),amount:tier.upgradeReward,reward:info.upgradeRewards.find(row=>row.level===tier.level)},
    {kind:'weekly',icon:'gift',title:t('copy.weeklyGift211'),amount:tier.weeklyReward,reward:info.weekly.level===tier.level?info.weekly:undefined},
    {kind:'monthly',icon:'calendar',title:t('copy.monthlyGift212'),amount:tier.monthlyReward,reward:info.monthly.level===tier.level?info.monthly:undefined},
  ] as const;
  return <>{holder}<div className="vip-perks">{rows.map(row=>{
    const received=row.reward?.status==='claimed';
    const canClaim=row.reward?.status==='claimable' && row.reward.amount>0;
    return <article key={row.kind}><Icon name={row.icon} size={27} /><strong>{betMoney(row.reward && (canClaim||received)?row.reward.amount:row.amount)}</strong><span>{row.title}</span><button type="button" className={`vip-claim${received?' vip-claim-received':''}`} disabled={!canClaim||claim.isPending} aria-label={`${row.title}${received?t('copy.claimed076'):canClaim?t('copy.claim'):t('copy.levelBenefits')}`} onClick={()=>{
      if (!canClaim||busy.current) return;
      busy.current=true;setNotice('');
      // Reuse the request after a lost response; do not issue a new claim identity on retry.
      const rewards=row.reward?.rewardId;
      const key=`${uid}:${row.kind}:${info.activityDate}:${rewards}`;
      let id=requests.current.get(key);if (!id) { id=crypto.randomUUID();requests.current.set(key,id); }
      claim.mutate({kind:row.kind,id,rewardId:row.reward!.rewardId});
    }}>{claim.isPending&&claim.variables?.kind===row.kind?t('copy.claiming'):received?t('copy.claimed076'):canClaim?t('copy.claim'):t('copy.levelBenefits')}</button></article>;
  })}</div><p className="benefits-note">{t('vip.claimScope')}</p>{notice&&<p className="vip-claim-notice" role="status">{notice}</p>}</>;
}
