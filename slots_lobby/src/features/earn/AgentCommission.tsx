import {ClaimBadge} from '../rewards/ClaimBadge';
import {AsyncButton} from '../../components/buttons/AsyncButton';
import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingState } from '../../components/feedback/LoadingState';
import { NetworkError } from '../../components/feedback/NetworkError';
import { navigateLobby } from '../../app/useLobbyRoute';
import { getLocale, t } from '../../i18n';
import { agentDefaults, claimAgent, fetchAgent, type AgentData } from '../../services/agent';
import { useSessionStore } from '../../stores/session';
import { betMoney } from '../bet-records/money';
import { useClaimToast } from '../rewards/useClaimToast';

export function AgentCommission() {
  const uid = useSessionStore(state => state.session?.uid);
  const client = useQueryClient();
  const requestId = useRef<string | null>(null);
  const { toast, holder } = useClaimToast();
  const key = ['agent', uid, 'center', agentDefaults] as const;
  const info = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchAgent('center', agentDefaults, signal), enabled: !!uid, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const rates = useQuery({ queryKey: ['agent', uid, 'rates', agentDefaults], queryFn: ({ signal }) => fetchAgent('rates', agentDefaults, signal), enabled: !!uid, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const claim = useMutation({meta:{claimUid:uid,claimIndicator:'agent'},
    mutationFn: () => { requestId.current ??= crypto.randomUUID(); return claimAgent(requestId.current); }, retry: false,
    onError: () => { void toast.error(t('agent.claimFailed')); },
    onSuccess: () => {
      requestId.current = null;
      void toast.success(t('agent.claimSuccess'));
      client.setQueryData<AgentData>(key, previous => previous ? { ...previous, summary: { ...previous.summary, claimable: 0 } } : previous);
      for (const queryKey of [['agent'], ['lobby', 'current-profile'], ['wallet-ledger'], ['personal-report']]) void client.invalidateQueries({ queryKey });
    },
  });
  const agRates = rates.data?.items.filter(row => row.provider === 'AG') ?? [];
  const maxRate = agRates.length ? Math.max(...agRates.map(row => row.perTenThousand)) / 100 : null;
  const failed = info.isError || rates.isError;
  return <article className="rebate-card agent-commission-card" aria-label={t('server.commission')}>
    {holder}
    <header><h2>{t('server.commission')}</h2><button type="button" onClick={() => navigateLobby('agent')}>{t('copy.viewRules')}</button></header>
    {failed && <NetworkError disabled={info.isFetching || rates.isFetching} onRetry={() => { if (info.isError) void info.refetch(); if (rates.isError) void rates.refetch(); }} />}
    {!info.data || !rates.data ? !failed && <LoadingState compact label={t('copy.loading')} /> : <>
      <div className="rebate-claim-row"><span>{t('agent.claimable')} <strong>{betMoney(info.data.summary.claimable)}</strong></span>
        <AsyncButton loading={claim.isPending} type="button" disabled={claim.isPending || info.isFetching || info.isError || info.data.summary.claimable <= 0} aria-busy={claim.isPending} onClick={() => claim.mutate()}>{t('agent.claim')}<ClaimBadge active={info.data.summary.claimable>0}/></AsyncButton>
      </div>
      <div className="rebate-platforms"><div><span>AG</span><strong>{maxRate === null ? '—' : `${maxRate.toLocaleString(getLocale(), { maximumFractionDigits: 4 })}%`}</strong></div></div>
    </>}
  </article>;
}
