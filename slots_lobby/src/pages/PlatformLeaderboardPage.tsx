import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AsyncButton } from '../components/buttons/AsyncButton';
import { Icon } from '../components/Icon';
import { ClaimBadge } from '../features/rewards/ClaimBadge';
import { useClaimIndicators } from '../features/rewards/useClaimIndicators';
import { LoadingState } from '../components/feedback/LoadingState';
import { RecordsLayout } from '../components/records/RecordsLayout';
import { RecentWinDetail } from '../features/home/RecentWinDetail';
import { getLocale, t } from '../i18n';
import { useSessionStore } from '../stores/session';
import { claimPlatformLeaderboard, fetchPlatformLeaderboard, platformLeaderboardDate, setPlatformParticipation, type PlatformBoard, type PlatformLeaderboard, type PlatformPeriod, type PlatformRow } from '../services/platform-leaderboard';
import { leaderboardRewardMoney, type RecentWin } from '../services/recent-wins';
import { useClaimToast } from '../features/rewards/useClaimToast';
import '../styles/platform-leaderboard.css';

const guestNickname = String.fromCharCode(20307, 39564, 29609, 23478);

function RulesPage({ rewards, onBack }: { rewards: string[]; onBack: () => void }) {
  return <RecordsLayout title={t('platformLeaderboard.rules')} backLabel={t('copy.backToPlatformLeaderboard')} onBack={onBack} className="platform-leaderboard platform-leaderboard-rules">
    <div className="platform-leaderboard-content">
      <p className="platform-leaderboard-rules-settlement"><strong>{t('platformLeaderboard.settlement')}</strong>{t('platformLeaderboard.settlementText')}</p>
      <div className="platform-reward-list">{rewards.map((amount, index) => <div key={index}><span>{t('platformLeaderboard.rankValue', { p0: index + 1 })}</span><strong>{leaderboardRewardMoney(amount)}</strong></div>)}</div>
    </div>
  </RecordsLayout>;
}

export function PlatformLeaderboardPage({ onBack }: { onBack: () => void }) {
  const session = useSessionStore(s => s.session);
  const rewards = useClaimIndicators();
  const [period, setPeriod] = useState<PlatformPeriod>('today');
  const [board, setBoard] = useState<PlatformBoard>('multiplier');
  const [showRules, setShowRules] = useState(false);
  const [selected, setSelected] = useState<RecentWin>();
  const client = useQueryClient();
  const { toast, holder } = useClaimToast();
  const query = useQuery({ queryKey: ['platform-leaderboard', board, period, session?.uid ?? 'guest'], queryFn: ({ signal }) => fetchPlatformLeaderboard(board, period, signal), enabled: true, staleTime: 0, retry: false });
  const mutation = useMutation({ mutationFn: setPlatformParticipation, onSuccess: participating => { client.setQueriesData<PlatformLeaderboard>({ queryKey: ['platform-leaderboard'] }, old => old ? { ...old, participating } : old); } });
  const claim = useMutation({
    mutationFn: ({ date, rank }: { date: string; rank: number }) => claimPlatformLeaderboard(date, board, rank),
    retry: false,
    onSuccess: (_result, variables) => {
      client.setQueriesData<PlatformLeaderboard>({ queryKey: ['platform-leaderboard'] }, old => old ? { ...old, items: old.items.map(row => row.rank === variables.rank ? { ...row, claimable: false, rewardStatus: 'claimed' } : row) } : old);
      if (session?.uid) client.setQueryData(['claim-indicators', session.uid, 'leaderboard'], { leaderboard: 0 });
      void toast.success(t('copy.claimSuccessful'));
      void client.invalidateQueries({ queryKey: ['lobby', 'current-profile'] });
      void client.invalidateQueries({ queryKey: ['wallet-ledger'] });
    },
    onError: () => { void toast.error(t('copy.claimResultIsUnconfirmedPleaseRetry')); },
  });
  const title = (row: { gameName: string; gameNameEn: string }) => getLocale() !== 'zh-TW' && row.gameNameEn ? row.gameNameEn : row.gameName;
  const detail = (row: PlatformRow): RecentWin => ({ id: row.platformOrderId, betId: row.betId, betAmount: row.betAmount, avatarId: row.avatarId, gameId: row.gameId, gameName: row.gameName, gameNameEn: row.gameNameEn, cover: row.cover, nickname: row.nickname === guestNickname ? t('platformLeaderboard.guest') : row.nickname, uid: row.uid, anonymous: row.anonymous, winAmount: row.winAmount, multiplier: row.multiplier, occurredAt: row.occurredAt, isSelf: Boolean(session && String(session.uid) === row.uid) });
  if (showRules) return <RulesPage rewards={query.data?.rewards ?? []} onBack={() => setShowRules(false)} />;
  return <>{holder}<RecordsLayout title={t('platformLeaderboard.title')} backLabel={t('copy.backToLobby')} onBack={onBack} className="platform-leaderboard">
    <div className="platform-leaderboard-content">
      <div className="platform-leaderboard-tabs"><button className={period === 'today' ? 'active' : ''} onClick={() => setPeriod('today')}>{t('platformLeaderboard.today')}</button><button className={`${period === 'yesterday' ? 'active ' : ''}claim-badge-anchor`} onClick={() => setPeriod('yesterday')}>{t('platformLeaderboard.yesterday')}<ClaimBadge active={rewards.active('leaderboard')}/></button></div>
      <div className="platform-leaderboard-metric-row"><div className="platform-leaderboard-tabs compact"><button className={board === 'multiplier' ? 'active' : ''} onClick={() => setBoard('multiplier')}>{t('platformLeaderboard.multiplier')}</button><button className={board === 'wins' ? 'active' : ''} onClick={() => setBoard('wins')}>{t('platformLeaderboard.wins')}</button></div><button type="button" className="platform-leaderboard-info" aria-label={t('platformLeaderboard.rulesOpen')} onClick={() => setShowRules(true)}><Icon name="info" size={16} /></button></div>
      {query.isFetching ? <LoadingState /> : query.isError ? <div className="platform-leaderboard-error">{t('statistics.failed')}</div> : <div className="platform-leaderboard-list">{query.data?.items.map(row => {
        const self = Boolean(session && !row.anonymous && String(session.uid) === row.uid);
        const canClaim = period === 'yesterday' && row.claimable && self;
        const claimed = period === 'yesterday' && self && row.rewardStatus === 'claimed';
        const issued = period === 'yesterday' && !self && !row.anonymous;
        const open = () => setSelected(detail(row));
        return <div className="platform-leaderboard-item" key={row.rank}>
          <div role="button" tabIndex={0} className={`platform-leaderboard-row rank-${row.rank}`} aria-label={t('platformLeaderboard.openReplay')} onClick={open} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }}>
            <b className="rank">{row.rank}</b><span className="platform-avatar-wrap"><img className="platform-avatar" src={`/assets/profile/avatar/${row.avatarId}.png`} alt="" width={40} height={40} /><span className="platform-replay-indicator" aria-hidden="true">▶</span></span>
            <div className="platform-player"><strong><span className={`platform-player-name${self ? ' platform-player-name-self' : ''}`}>{row.anonymous ? t('recentWins.anonymous') : self ? t('platformLeaderboard.me') : row.nickname === guestNickname ? t('platformLeaderboard.guest') : row.nickname}</span></strong><small>UID {row.uid}</small><em>{title(row)}</em></div>
            <div className="platform-score">{board === 'multiplier' ? <strong className="platform-multiplier">{row.multiplier}×</strong> : <strong className="platform-win">WIN {leaderboardRewardMoney(row.winAmount)}</strong>}{row.anonymous ? <strong className="platform-reward-empty">{t('platformLeaderboard.notParticipating')}</strong> : <><small className="platform-reward-caption">{t('platformLeaderboard.reward')}</small><strong className="platform-reward-value"><span>{t('copy.bonus')}</span> {leaderboardRewardMoney(row.rewardAmount)}</strong></>}{canClaim ? <AsyncButton className="platform-leaderboard-claim" loading={claim.isPending && claim.variables?.rank === row.rank} disabled={claim.isPending} onClick={event => { event.stopPropagation(); claim.mutate({ date: platformLeaderboardDate(period, query.data?.timezone ?? 'UTC'), rank: row.rank }); }}>{t('copy.claim')}<ClaimBadge active={true}/></AsyncButton> : claimed ? <span className="platform-leaderboard-claimed"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none"/><path d="m8 12 2.5 2.5L16 9" fill="none"/></svg>{t('platformLeaderboard.claimed')}</span> : issued ? <span className="platform-leaderboard-claimed"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none"/><path d="m8 12 2.5 2.5L16 9" fill="none"/></svg>{t('platformLeaderboard.issued')}</span> : null}</div>
          </div>
        </div>;
      })}</div>}
      {query.isSuccess && !query.isFetching && <label className="platform-participation" onClick={event => event.stopPropagation()}><span>{t('platformLeaderboard.participate')}</span><input type="checkbox" checked={query.data.participating} disabled={!session || mutation.isPending} onClick={event => event.stopPropagation()} onChange={e => mutation.mutate(e.target.checked)} /></label>}
    </div>
  </RecordsLayout>{selected && <RecentWinDetail row={selected} onClose={() => setSelected(undefined)} />}</>;
}
