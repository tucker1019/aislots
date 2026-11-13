import { useQuery } from '@tanstack/react-query';
import { getLocale, t } from '../../i18n';
import { fetchRechargeTiers } from '../../services/recharge';

export function useDepositBonusLabel(uid?: number, enabled = true) {
  const { data } = useQuery({
    queryKey: ['recharge-tiers', uid], enabled: uid !== undefined && enabled,
    queryFn: ({ signal }) => fetchRechargeTiers(signal), retry: false, staleTime: 60000,
  });
  const maxBonus = Math.max(0, ...(data ?? []).map(tier => tier.bonus / tier.amount * 100));
  return maxBonus > 0 ? `${t('copy.bonus')}${maxBonus.toLocaleString(getLocale(), { maximumFractionDigits: 4 })}%` : undefined;
}
