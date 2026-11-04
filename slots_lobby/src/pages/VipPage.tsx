import {LoadingState} from '../components/feedback/LoadingState';
import {NetworkError} from '../components/feedback/NetworkError';
import { t, getLocale } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { useAccountProfile } from '../features/account/useAccountProfile';
import { useSessionStore } from '../stores/session';
import { loadVipDetails, type VipDetails } from '../services/vip-details';
import { VipPerks } from '../features/vip/VipPerks';
import { VipCarousel } from '../features/vip/VipCarousel';
import { VipTables } from '../features/vip/VipTables';
import { betMoney } from '../features/bet-records/money';
function VipOverview({ info }: { info: VipDetails }) {
  const profile = useAccountProfile();
  const track = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const {state,levels} = info;
  const tier = levels.find(row => row.level === selected) ?? levels.find(row => row.level === state.level)!;
  useEffect(() => {
    const element = track.current;
    const active = element?.querySelector<HTMLElement>('[aria-pressed=true]');
    if (element && active) element.scrollLeft = Math.max(0, active.offsetLeft - element.offsetLeft - (element.clientWidth - active.offsetWidth) / 2);
  }, [tier.level]);
  const next = levels.find(row => row.level > state.level);
  return <div className="vip-overview">
    <section className="vip-profile"><div><strong>{profile.data?.nickname ?? t('copy.myAccountDetails')}</strong><small>{t('copy.username')}</small></div>{profile.data && <img src={`/assets/profile/avatar/${profile.data.avatarId}.png`} alt={t('copy.userAvatar')} width={62} height={62} />}<div><strong><Icon name="crown" size={17} /> VIP{state.level}</strong><small>{t('copy.currentLevel')}</small></div></section>
    <nav ref={track} className="vip-level-track" aria-label={t('copy.selectVipLevel')}>{levels.map(row => <button type="button" key={row.level} aria-pressed={tier.level === row.level} onClick={() => setSelected(row.level)}><span aria-hidden="true" />VIP{row.level}</button>)}</nav>
    <p className="vip-next">{state.status === 'protecting' ? t('copy.completeLevelProtectionFirstUpgradeProgressResumes') : next ? t('copy.toUnlockVipValueDepositsRemainingValue', {p0: next.level, p1: betMoney(Math.max(0,next.upgradeRecharge-state.upgradeRecharge)), p2: betMoney(Math.max(0,next.upgradeBet-state.upgradeBet))}) : t('copy.highestVipLevelReached')}</p>
    <VipCarousel levels={levels} selected={tier.level} current={state.level} highest={state.highestLevel} onSelect={setSelected} />
    {state.status === 'protecting' && <section className="vip-protection"><h2>{t('copy.levelProtectionProgress')}</h2><p>{t('copy.deposit')} {betMoney(state.protectionRecharge)} / {betMoney(state.protectionRequiredRecharge)}</p><p>{t('copy.eligibleTurnover')} {betMoney(state.protectionBet)} / {betMoney(state.protectionRequiredBet)}</p>{state.protectionEnd && <p>{t('copy.deadline')}{new Date(state.protectionEnd).toLocaleString(getLocale())}</p>}</section>}
    <h2 className="vip-section-title">VIP{tier.level} {t('copy.benefits')}</h2><VipPerks info={info} tier={tier} />
    <section className="vip-rules"><h2>{t('copy.vipTermsAndRules')}</h2><p><strong>{t('copy.upgradeCriteria')}</strong>{t('copy.upgradeWhenCumulativeEligibleBetsAndDeposits')}</p><p><strong>{t('copy.levelUpGifts')}</strong>{t('copy.eachLevelSGiftCanBeClaimed')}</p><p><strong>{t('copy.weeklyMonthlyGifts')}</strong>{t('copy.meetDepositAndEligibleTurnoverRequirementsFor')}</p><p><strong>{t('copy.levelProtection')}</strong>{t('copy.after')} {info.idleDays} {t('copy.daysOfInactivityA')} {info.protectionDays} {t('copy.dayProtectionPeriodBeginsUpgradeProgressResets')}</p><p>{t('copy.statisticsTimezone')}{info.timezone}{t('copy.rewardAmountsAndEligibilityDependOnActual')}</p></section>
  </div>;
}
export function VipPage({ tables, onBack, onTables }: { tables: boolean; onBack: () => void; onTables: () => void }) {
  const uid = useSessionStore(state => state.session?.uid);
  const query = useQuery({queryKey:['lobby','vip-details',uid],queryFn:({signal}) => loadVipDetails(signal),retry:false,staleTime:15000});
  return <section className="vip-page benefits-page"><header className="benefits-heading"><button type="button" aria-label={tables ? t('copy.backToMyVip') : t('copy.backToBenefits')} onClick={onBack}><Icon name="chevron" size={20} /></button><h1>{tables ? t('copy.vipDetails') : t('copy.myVip')}</h1>{!tables && <button type="button" className="vip-details-link" onClick={onTables}>{t('copy.vipDetails')}</button>}</header>{query.isPending ? <LoadingState label={t('copy.loadingVipDetails')}/> : query.isError || !query.data ? <NetworkError disabled={query.isFetching} onRetry={() => void query.refetch()}/> : tables ? <VipTables levels={query.data.levels} current={query.data.state.level} /> : <VipOverview info={query.data} />}</section>;
}
