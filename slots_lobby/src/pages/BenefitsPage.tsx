import { useState } from 'react';
import { CheckinModal } from '../features/benefits/CheckinModal';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { BenefitCard } from '../features/benefits/BenefitCard';
import { loadVipOverview } from '../services/benefits';
import { useSessionStore } from '../stores/session';
import { betMoney } from '../features/bet-records/money';
export function BenefitsPage({ onBack, onComingSoon, onVip }: { onVip?: () => void; onBack: () => void; onComingSoon: () => void }) {
  const uid = useSessionStore(state => state.session?.uid);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const vip = useQuery({ queryKey: ['lobby', 'benefits', 'vip', uid], queryFn: ({ signal }) => loadVipOverview(signal), retry: false, staleTime: 15000 });
  const info = vip.data;
  const growth = info ? info.protecting ? '当前处于保级期，完成保级后继续累计升级进度' : info.nextBet === null ? '已达到最高 VIP 等级' : `升级流水 ${betMoney(info.upgradeBet)} / ${betMoney(info.nextBet)}${info.nextRecharge ? ` · 充值 ${betMoney(info.upgradeRecharge)} / ${betMoney(info.nextRecharge)}` : ''}` : '';
  return <section className="benefits-page"><header className="benefits-heading"><button type="button" aria-label="返回我的" onClick={onBack}><Icon name="chevron" size={20} /></button><h1>福利中心</h1></header>
    <div className="benefits-cards">
      <BenefitCard title="每日签到" icon="calendar" tone="purple" description="每日签到领取丰富奖励" action="签到" onAction={() => setCheckinOpen(true)} />
      {vip.isPending ? <p className="benefits-feedback" role="status">正在加载 VIP 福利…</p> : !info ? <div className="benefits-feedback" role="alert"><p>VIP 福利加载失败</p><button type="button" disabled={vip.isFetching} onClick={() => void vip.refetch()}>重试 VIP 福利</button></div> : <>
        <BenefitCard title="每周礼金" icon="gift" tone="blue" value={betMoney(info.weeklyReward)} description="每周完成指定条件即可领取礼金" action="领取进度" onAction={onComingSoon} />
        <BenefitCard title="每月礼金" icon="calendar" tone="rose" value={betMoney(info.monthlyReward)} description="每月完成指定条件即可领取礼金" action="领取进度" onAction={onComingSoon} />
        <BenefitCard title="晋级奖励" icon="growth" tone="green" value={betMoney(info.upgradeReward)} description={info.upgradeReward > 0 ? '已获得的待领晋级礼金' : '提升 VIP 等级解锁晋级奖励'} action={info.upgradeReward > 0 ? '查看晋级奖励' : '提升VIP领取奖励'} onAction={onComingSoon} />
        <BenefitCard title="VIP中心" icon="crown" tone="gold" value={`VIP${info.level}`} description={growth} action="查看详情" onAction={onVip ?? onComingSoon} />
        <p className="benefits-note">周、月礼金为当前等级预估档位，实际领取以周期结算和达标条件为准。</p>
      </>}
    </div>
    {checkinOpen && <CheckinModal onClose={() => setCheckinOpen(false)} />}
  </section>;
}
