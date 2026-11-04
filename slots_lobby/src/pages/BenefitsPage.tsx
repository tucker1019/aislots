import {LoadingState} from '../components/feedback/LoadingState';
import {NetworkError} from '../components/feedback/NetworkError';
import { t } from '../i18n';
import { SalaryBenefit } from '../features/benefits/SalaryBenefit';
import { VipUpgradeModal } from '../features/benefits/VipUpgradeModal';
import { navigateLobby } from '../app/useLobbyRoute';
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
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const vip = useQuery({ queryKey: ['lobby', 'benefits', 'vip', uid], queryFn: ({ signal }) => loadVipOverview(signal), retry: false, staleTime: 15000 });
  const info = vip.data;
  const growth = info ? info.protecting ? t('copy.completeLevelProtectionBeforeContinuingUpgradeProgress') : info.nextBet === null ? t('copy.youHaveReachedTheHighestVipLevel238') : t('copy.upgradeTurnoverValueValueValue', {p0: betMoney(info.upgradeBet), p1: betMoney(info.nextBet), p2: info.nextRecharge ? t('copy.depositsValueValue', {p0: betMoney(info.upgradeRecharge), p1: betMoney(info.nextRecharge)}) : ''}) : '';
  return <section className="benefits-page"><header className="benefits-heading"><button type="button" aria-label={t('copy.backToMyAccount')} onClick={onBack}><Icon name="chevron" size={20} /></button><h1>{t('copy.benefitsCenter')}</h1></header>
    <div className="benefits-cards">
      <BenefitCard title={t('copy.dailyCheckIn')} icon="calendar" tone="purple" description={t('copy.checkInDailyToEarnRewards')} action={t('copy.checkIn')} onAction={() => setCheckinOpen(true)} />
      {vip.isPending ? <LoadingState label={t('copy.loadingVipBenefits')}/> : !info ? <NetworkError disabled={vip.isFetching} onRetry={() => void vip.refetch()}/> : <>
        <SalaryBenefit kind="weekly" info={info}/>
        <SalaryBenefit kind="monthly" info={info}/>
        <BenefitCard title={t('copy.levelUpReward')} icon="growth" tone="green" value={betMoney(info.nextUpgradeReward ?? 0)} description={info.nextBet === null ? t('copy.youHaveReachedTheHighestVipLevel238') : t('copy.upgradeToVipValueToEarnA', {p0: info.level + 1})} action={info.upgradeReward > 0 ? t('copy.viewLevelUpRewards') : t('copy.upgradeVipForRewards')} onAction={info.upgradeReward > 0 ? (onVip ?? onComingSoon) : () => setUpgradeOpen(true)} />
        <BenefitCard title={t('copy.vipCenter')} icon="crown" tone="gold" value={`VIP${info.level}`} description={growth} action={t('copy.viewDetails')} onAction={onVip ?? onComingSoon} />
        <p className="benefits-note">{t('copy.weeklyAndMonthlyGiftsAreEstimatesFor')}</p>
      </>}
    </div>
    {upgradeOpen && info && <VipUpgradeModal info={info} onClose={() => setUpgradeOpen(false)} onHome={() => { setUpgradeOpen(false); navigateLobby('home'); }} />}
    {checkinOpen && <CheckinModal onClose={() => setCheckinOpen(false)} />}
  </section>;
}
